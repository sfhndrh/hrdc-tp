import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { runCourseScraper } from "../api.js";
import CourseResultsTable from "../components/CourseResultsTable.jsx";
import PageHeader from "../components/Nav.jsx";

const MAX_URLS = 500;
const MAX_PAGES_CRAWLED = 50;
const MAX_PAGES_FOR_QWEN = 20;

function countUrls(text) {
  return text
    .split(/[\n\r,;]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/**
 * Course Scraper — crawl training websites and extract courses via Qwen.
 */
export default function CourseScraper() {
  const navigate = useNavigate();
  const [urlsText, setUrlsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [courses, setCourses] = useState([]);
  const [meta, setMeta] = useState(null);
  const [runId, setRunId] = useState(0);

  const urlCount = countUrls(urlsText);

  async function handleRun() {
    if (urlCount === 0) {
      setError("Enter at least one website URL.");
      return;
    }
    if (urlCount > MAX_URLS) {
      setError(`Maximum ${MAX_URLS} URLs allowed (you entered ${urlCount}).`);
      return;
    }

    setLoading(true);
    setError("");
    setCourses([]);
    setMeta(null);

    try {
      const result = await runCourseScraper({ urlsText });
      setCourses(result.courses || []);
      setRunId((id) => id + 1);
      setMeta({
        urlCount: result.urlCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        pagesCrawled: result.pagesCrawled,
        pagesSentToQwen: result.pagesSentToQwen,
        results: result.results || [],
        coursesFound: result.coursesFound,
        savedToCsv: result.savedToCsv,
        duplicatesSkipped: result.duplicatesSkipped,
        totalCoursesInCsv: result.totalCoursesInCsv,
      });

      navigate("/", {
        state: {
          fromCourseScraper: true,
          coursesFound: result.coursesFound ?? 0,
          savedToCsv: result.savedToCsv ?? 0,
          refreshedAt: Date.now(),
        },
      });
    } catch (err) {
      setError(err.message || "Course scraper failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Course Scraper" />
      <p className="subtitle">
        Crawl training provider websites (up to <strong>{MAX_URLS}</strong> URLs at
        once, one per line). Each site crawls up to <strong>{MAX_PAGES_CRAWLED}</strong>{" "}
        internal pages; only the top <strong>{MAX_PAGES_FOR_QWEN}</strong> scored
        pages are sent to Alibaba Qwen. New rows are <strong>appended</strong> to{" "}
        <strong>courses-output.csv</strong> (existing rows kept).
      </p>

      <div className="panel">
        <label htmlFor="website-urls">Website URLs</label>
        <textarea
          id="website-urls"
          className="urls-textarea"
          placeholder={"https://example-training.com\nhttps://another-provider.com.my"}
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          disabled={loading}
          rows={8}
        />
        <p className="hint">
          One URL per line (comma or semicolon also works). Max {MAX_URLS} URLs.
          {urlCount > 0 && (
            <>
              {" "}
              — <strong>{urlCount}</strong> URL{urlCount !== 1 ? "s" : ""} detected
            </>
          )}
        </p>

        <div className="actions">
          <button type="button" onClick={handleRun} disabled={loading}>
            {loading ? "Scraping…" : "Run Course Scraper"}
          </button>
        </div>

        {loading && (
          <div className="loading">
            <span className="spinner" aria-hidden />
            Processing {urlCount} URL{urlCount !== 1 ? "s" : ""} sequentially… This
            can take a long time for large batches. Keep this tab open.
          </div>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {meta && !error && (
        <div className="success-meta">
          <p>
            URLs processed: <strong>{meta.urlCount}</strong> — Success:{" "}
            <strong>{meta.successCount}</strong> — Failed:{" "}
            <strong>{meta.failureCount}</strong>
          </p>
          <p>
            Pages crawled: <strong>{meta.pagesCrawled}</strong> — Sent to Qwen (top
            scored): <strong>{meta.pagesSentToQwen ?? 0}</strong> — Courses found:{" "}
            <strong>{meta.coursesFound}</strong> — New rows added:{" "}
            <strong>{meta.savedToCsv}</strong>
            {typeof meta.totalCoursesInCsv === "number" && (
              <>
                {" "}
                — Total in CSV: <strong>{meta.totalCoursesInCsv}</strong>
              </>
            )}
            {meta.duplicatesSkipped > 0 && (
              <>
                {" "}
                — Duplicates skipped: <strong>{meta.duplicatesSkipped}</strong>
              </>
            )}
          </p>
          {meta.results?.some((r) => r.success && r.qwenPageUrls?.length > 0) && (
            <div className="qwen-pages">
              <strong>Top pages sent to Qwen:</strong>
              <ul>
                {meta.results
                  .filter((r) => r.success && r.qwenPageUrls?.length > 0)
                  .map((r, i) => (
                    <li key={i}>
                      <span className="qwen-pages-site">{r.inputUrl}</span>
                      <ul>
                        {r.qwenPageUrls.map((url) => (
                          <li key={url}>
                            <a href={url} target="_blank" rel="noreferrer">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {meta.results?.length > 0 && meta.failureCount > 0 && (
            <div className="failures">
              <strong>Failed URLs:</strong>
              <ul>
                {meta.results
                  .filter((r) => !r.success)
                  .map((r, i) => (
                    <li key={i}>
                      {r.inputUrl}: {r.error}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {courses.length > 0 && (
        <div className="panel">
          <h2>Results (all URLs)</h2>
          <CourseResultsTable key={runId} courses={courses} showWebsiteUrl />
        </div>
      )}
    </>
  );
}
