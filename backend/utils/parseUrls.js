import { normalizeWebsiteUrl } from "./urlNormalize.js";

export const MAX_COURSE_URLS = 500;

/**
 * Parse URL list from request body (single url, urls array, or newline/comma text).
 */
export function parseCourseUrls(body) {
  let list = [];

  if (Array.isArray(body?.urls)) {
    list = body.urls.map((u) => String(u).trim()).filter(Boolean);
  } else if (typeof body?.urlsText === "string" && body.urlsText.trim()) {
    list = body.urlsText
      .split(/[\n\r,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (body?.url) {
    list = [String(body.url).trim()].filter(Boolean);
  }

  if (list.length === 0) {
    return { urls: [], error: "At least one URL is required." };
  }

  if (list.length > MAX_COURSE_URLS) {
    return {
      urls: [],
      error: `Maximum ${MAX_COURSE_URLS} URLs allowed (received ${list.length}).`,
    };
  }

  // Dedupe by normalized URL, preserve first occurrence order
  const seen = new Set();
  const urls = [];
  for (const raw of list) {
    const key = normalizeWebsiteUrl(raw) || raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(raw);
  }

  return { urls, error: null };
}
