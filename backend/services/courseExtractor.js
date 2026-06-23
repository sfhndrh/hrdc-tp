/**
 * Course Scraper orchestration: crawl -> score -> batch Qwen -> dedupe -> CSV.
 * Pipeline-ready: accepts website URL from Provider Discovery output.
 */

import { crawlWebsite } from "./crawlerService.js";
import { extractCoursesFromContent } from "./qwenService.js";
import { appendCoursesToCsv } from "../utils/courseCsvWriter.js";

const MAX_PAGES_FOR_QWEN = Number(process.env.CRAWL_QWEN_TOP_PAGES) || 20;
const CHARS_PER_PAGE = Number(process.env.CRAWL_CHARS_PER_PAGE) || 12_000;
const MAX_BATCH_CHARS = Number(process.env.CRAWL_MAX_BATCH_CHARS) || 80_000;

const COURSE_FIELDS = [
  "course_name",
  "course_module",
  "duration",
  "start_date",
  "end_date",
  "delivery_mode",
  "venue",
  "platform",
  "fee",
  "number_of_participants",
  "trainer",
  "certification",
  "hrdc_claimable",
  "course_url",
  "description",
];

function normalizeCourse(raw, websiteUrl) {
  const course = { website_url: websiteUrl };
  for (const field of COURSE_FIELDS) {
    const val = raw[field];
    course[field] =
      val === null || val === undefined || String(val).trim() === ""
        ? ""
        : String(val).trim();
  }
  if (!course.course_url && raw.url) {
    course.course_url = String(raw.url).trim();
  }
  return course;
}

function dedupeKey(course) {
  const name = (course.course_name || "").toLowerCase().trim();
  const site = (course.website_url || "").toLowerCase().trim();
  return `${site}::${name}`;
}

/**
 * Merge and deduplicate course arrays.
 */
export function dedupeCourses(courses) {
  const seen = new Set();
  const out = [];
  for (const c of courses) {
    if (!c.course_name?.trim()) continue;
    const key = dedupeKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * Build text batches from highest-scoring crawled pages.
 */
function buildContentBatches(pages) {
  const topPages = pages.slice(0, MAX_PAGES_FOR_QWEN);
  const batches = [];
  let current = "";
  let batchPages = [];

  for (const page of topPages) {
    const chunk =
      `\n\n=== PAGE: ${page.url} ===\n` +
      `TITLE: ${page.title}\n` +
      page.text.slice(0, CHARS_PER_PAGE);

    if (current.length + chunk.length > MAX_BATCH_CHARS && current.length > 0) {
      batches.push({ content: current, pageCount: batchPages.length });
      current = chunk;
      batchPages = [page.url];
    } else {
      current += chunk;
      batchPages.push(page.url);
    }
  }

  if (current.trim()) {
    batches.push({ content: current, pageCount: batchPages.length });
  }

  return batches;
}

/**
 * Main entry: scrape courses from a company website URL.
 */
export async function scrapeCoursesFromWebsite(websiteUrl, options = {}) {
  const maxPages = options.maxPages;

  const { pages, pagesCrawled, rootUrl } = await crawlWebsite(websiteUrl, {
    maxPages,
  });

  const topPages = pages.slice(0, MAX_PAGES_FOR_QWEN);
  const pagesSentToQwen = topPages.length;

  if (pages.length === 0) {
    return {
      success: true,
      pagesCrawled: 0,
      pagesSentToQwen: 0,
      qwenPageUrls: [],
      coursesFound: 0,
      courses: [],
      savedToCsv: 0,
      duplicatesSkipped: 0,
    };
  }

  const batches = buildContentBatches(pages);
  console.log(`[courseExtractor] Sending ${batches.length} batch(es) to Qwen`);

  let allRaw = [];

  for (let i = 0; i < batches.length; i++) {
    const { content, pageCount } = batches[i];
    console.log(`[courseExtractor] Qwen batch ${i + 1}/${batches.length} (${pageCount} pages)`);
    try {
      const extracted = await extractCoursesFromContent(rootUrl, content);
      allRaw = allRaw.concat(extracted);
    } catch (err) {
      console.error(`[courseExtractor] Qwen batch ${i + 1} failed:`, err.message);
    }
  }

  const normalized = allRaw.map((c) => normalizeCourse(c, rootUrl));
  const courses = dedupeCourses(normalized);

  const { appended, duplicatesSkipped, total } = await appendCoursesToCsv(courses);

  return {
    success: true,
    pagesCrawled,
    pagesSentToQwen,
    qwenPageUrls: topPages.map((p) => p.url),
    coursesFound: courses.length,
    courses,
    savedToCsv: appended,
    duplicatesSkipped,
    totalCoursesInCsv: total,
    websiteUrl: rootUrl,
  };
}
