import express from "express";
import { scrapeCoursesFromWebsite } from "../services/courseExtractor.js";
import { isApiKeyConfigured } from "../services/qwenService.js";
import { parseCourseUrls } from "../utils/parseUrls.js";
import { writeCombinedCsvFromFiles } from "../utils/combinedCsvWriter.js";
import { readAllCourses } from "../utils/courseCsvWriter.js";

const router = express.Router();

/**
 * POST /api/course-scraper
 * Crawl one or many training provider websites (max 500 URLs).
 * Body: { url } | { urls: [] } | { urlsText: "one per line" }
 */
router.post("/course-scraper", async (req, res) => {
  const { urls, error: parseError } = parseCourseUrls(req.body);

  if (parseError) {
    return res.status(400).json({ success: false, error: parseError });
  }

  if (!isApiKeyConfigured()) {
    return res.status(500).json({
      success: false,
      error: "ALIBABA_API_KEY not configured in backend/.env",
    });
  }

  const maxPages = Number(req.body?.maxPages) || undefined;
  const allCourses = [];
  const perUrl = [];
  let totalPagesCrawled = 0;
  let totalPagesSentToQwen = 0;
  let totalSaved = 0;
  let totalDuplicatesSkipped = 0;
  let successCount = 0;
  let failureCount = 0;

  console.log(`[course-scraper] Batch start: ${urls.length} URL(s)`);

  for (let i = 0; i < urls.length; i++) {
    const inputUrl = urls[i];
    console.log(`[course-scraper] [${i + 1}/${urls.length}] ${inputUrl}`);

    try {
      const result = await scrapeCoursesFromWebsite(inputUrl, { maxPages });

      successCount += 1;
      totalPagesCrawled += result.pagesCrawled;
      totalPagesSentToQwen += result.pagesSentToQwen ?? 0;
      totalSaved += result.savedToCsv;
      totalDuplicatesSkipped += result.duplicatesSkipped;
      allCourses.push(...(result.courses || []));

      perUrl.push({
        inputUrl,
        websiteUrl: result.websiteUrl,
        success: true,
        pagesCrawled: result.pagesCrawled,
        pagesSentToQwen: result.pagesSentToQwen ?? 0,
        qwenPageUrls: result.qwenPageUrls ?? [],
        coursesFound: result.coursesFound,
        savedToCsv: result.savedToCsv,
        duplicatesSkipped: result.duplicatesSkipped,
      });
    } catch (err) {
      failureCount += 1;
      const message = err?.message || String(err);
      console.error(`[course-scraper] Failed ${inputUrl}:`, message);
      perUrl.push({
        inputUrl,
        websiteUrl: "",
        success: false,
        pagesCrawled: 0,
        coursesFound: 0,
        savedToCsv: 0,
        duplicatesSkipped: 0,
        error: message,
      });
    }
  }

  const combined = await writeCombinedCsvFromFiles();
  const totalCoursesInCsv = (await readAllCourses()).length;

  console.log(
    `[course-scraper] Appended ${totalSaved} new course(s); ${totalCoursesInCsv} total in courses-output.csv; ${combined.rowCount} row(s) in combined-providers-courses.csv`
  );

  res.json({
    success: true,
    urlCount: urls.length,
    successCount,
    failureCount,
    pagesCrawled: totalPagesCrawled,
    pagesSentToQwen: totalPagesSentToQwen,
    coursesFound: allCourses.length,
    courses: allCourses,
    savedToCsv: totalSaved,
    duplicatesSkipped: totalDuplicatesSkipped,
    totalCoursesInCsv,
    combinedCsv: combined.path,
    combinedRowCount: combined.rowCount,
    results: perUrl,
  });
});

export default router;
