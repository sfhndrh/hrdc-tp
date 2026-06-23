/** Same-origin in production (Render Web Service). Override with VITE_API_BASE if needed. */
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

/**
 * Run scraper batch (next empty website rows, or single provider if name given).
 * @param {{ providerName?: string }} options
 */
export async function runScraper(options = {}) {
  const body = {};
  if (options.providerName?.trim()) {
    body.providerName = options.providerName.trim();
  }

  const response = await fetch(apiUrl("/api/run"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

/**
 * Fetch CSV progress without running lookups.
 */
export async function fetchStatus() {
  const response = await fetch(apiUrl("/api/status"));
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to load status");
  }
  return data;
}

/**
 * Course Scraper: crawl one or many websites (max 500 URLs).
 * @param {{ urlsText?: string, urls?: string[], url?: string }} options
 */
export async function runCourseScraper(options = {}) {
  const body = {};
  if (options.urls?.length) {
    body.urls = options.urls;
  } else if (options.urlsText?.trim()) {
    body.urlsText = options.urlsText.trim();
  } else if (options.url?.trim()) {
    body.url = options.url.trim();
  }

  const response = await fetch(apiUrl("/api/course-scraper"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

/**
 * Combined results: providers with website + matching courses.
 */
export async function fetchCombinedResults() {
  const response = await fetch(apiUrl("/api/results"), {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Failed to load results");
  }
  return data;
}
