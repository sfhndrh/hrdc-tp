/**
 * Internal website crawler for Course Scraper.
 * Discovers training/course pages via link extraction and scoring.
 * Designed for future pipeline: Provider Discovery -> Course Scraper.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

const SKIP_EXTENSIONS = /\.(pdf|zip|rar|7z|doc|docx|xls|xlsx|ppt|pptx|png|jpe?g|gif|svg|webp|ico|mp4|mp3|avi|wmv)(\?|$)/i;

const URL_KEYWORDS = [
  "course", "courses", "training", "trainings", "programme", "programmes",
  "program", "programs", "workshop", "workshops", "seminar", "seminars",
  "calendar", "event", "events", "learning", "certification",
  "public-training", "corporate-training", "upcoming", "catalog",
];

const CONTENT_SIGNALS = [
  "register now", "enroll", "enrol", "duration", "fee", "rm ",
  "participant", "participants", "max pax", "pax",
  "module", "modules", "syllabus",
  "trainer", "learning outcomes", "course overview", "hrdc", "hrdf",
  "sbl-khas", "claimable", "module", "syllabus",
];

const DEFAULT_MAX_PAGES = Number(process.env.CRAWL_MAX_PAGES) || 50;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 ScraperBot/1.0";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Normalize URL: resolve relative paths, strip hash, trailing slash.
 */
export function normalizeUrl(href, baseUrl) {
  try {
    const base = new URL(baseUrl);
    const resolved = new URL(href, base);
    if (!["http:", "https:"].includes(resolved.protocol)) {
      return null;
    }
    resolved.hash = "";
    let path = resolved.pathname.replace(/\/+$/, "") || "/";
    return `${resolved.origin}${path}${resolved.search}`;
  } catch {
    return null;
  }
}

export function getHostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSameSite(url, rootHostname) {
  const host = getHostname(url);
  return host === rootHostname || host.endsWith(`.${rootHostname}`);
}

function shouldSkipUrl(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  if (SKIP_EXTENSIONS.test(lower)) return true;
  if (lower.startsWith("mailto:") || lower.startsWith("tel:") || lower.startsWith("javascript:")) {
    return true;
  }
  return false;
}

/**
 * Score URL path for likelihood of containing courses (higher = better).
 */
export function scoreUrl(url) {
  const lower = url.toLowerCase();
  let score = 0;
  for (const kw of URL_KEYWORDS) {
    if (lower.includes(kw)) score += 12;
  }
  if (/\/course[s]?\/[^/]+/i.test(lower)) score += 20;
  if (/\/training\//i.test(lower)) score += 15;
  return score;
}

/**
 * Score page body text for course-related signals.
 */
export function scorePageContent(text) {
  const lower = (text || "").toLowerCase();
  let score = 0;
  for (const signal of CONTENT_SIGNALS) {
    if (lower.includes(signal)) score += 5;
  }
  const listItems = (lower.match(/<li|bullet|•/g) || []).length;
  if (listItems > 5) score += 3;
  return score;
}

/**
 * Extract visible text and links from HTML.
 */
export function parsePage(html, pageUrl) {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();

  const title = $("title").text().trim();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 50_000);

  const links = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const normalized = normalizeUrl(href, pageUrl);
    if (normalized && !shouldSkipUrl(normalized)) {
      links.push(normalized);
    }
  });

  return { title, text, links };
}

/**
 * Basic robots.txt check — returns false if path is disallowed.
 */
async function isAllowedByRobots(pageUrl, rootOrigin) {
  try {
    const robotsUrl = `${rootOrigin}/robots.txt`;
    const res = await axios.get(robotsUrl, {
      timeout: 5000,
      headers: { "User-Agent": USER_AGENT },
      validateStatus: (s) => s < 500,
    });
    if (res.status !== 200 || !res.data) return true;

    const path = new URL(pageUrl).pathname;
    const lines = String(res.data).split("\n");
    let active = false;
    const disallowed = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^user-agent:\s*\*/i.test(trimmed)) {
        active = true;
        continue;
      }
      if (/^user-agent:/i.test(trimmed) && !/\*/i.test(trimmed)) {
        active = false;
        continue;
      }
      if (active) {
        const m = trimmed.match(/^disallow:\s*(.*)$/i);
        if (m) disallowed.push(m[1].trim());
      }
    }

    for (const rule of disallowed) {
      if (!rule) continue;
      if (path.startsWith(rule)) return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Fetch a single page with retries.
 */
export async function fetchPage(url) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await axios.get(url, {
        timeout: REQUEST_TIMEOUT_MS,
        maxRedirects: 5,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        responseType: "text",
        validateStatus: (s) => s >= 200 && s < 400,
      });
      return res.data;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

/**
 * Crawl internal pages up to maxPages. Returns scored page records.
 */
export async function crawlWebsite(startUrl, options = {}) {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const rootNormalized = normalizeUrl(startUrl, startUrl);
  if (!rootNormalized) {
    throw new Error("Invalid website URL");
  }

  const rootOrigin = new URL(rootNormalized).origin;
  const rootHostname = getHostname(rootNormalized);

  const visited = new Set();
  const pages = [];
  const queue = [{ url: rootNormalized, priority: scoreUrl(rootNormalized) + 100 }];

  console.log(`[crawler] Starting crawl: ${rootNormalized} (max ${maxPages} pages)`);

  while (queue.length > 0 && pages.length < maxPages) {
    queue.sort((a, b) => b.priority - a.priority);
    const { url } = queue.shift();

    if (visited.has(url) || visited.size >= maxPages) continue;
    visited.add(url);

    if (!isSameSite(url, rootHostname)) continue;

    const allowed = await isAllowedByRobots(url, rootOrigin);
    if (!allowed) {
      console.log(`[crawler] Skipped (robots.txt): ${url}`);
      continue;
    }

    try {
      const html = await fetchPage(url);
      const { title, text, links } = parsePage(html, url);
      const urlScore = scoreUrl(url);
      const contentScore = scorePageContent(text);
      const totalScore = urlScore + contentScore;

      pages.push({
        url,
        title,
        text,
        score: totalScore,
        urlScore,
        contentScore,
      });

      console.log(`[crawler] [${pages.length}/${maxPages}] score=${totalScore} ${url}`);

      for (const link of links) {
        if (visited.has(link) || !isSameSite(link, rootHostname)) continue;
        if (shouldSkipUrl(link)) continue;

        const priority = scoreUrl(link) + (link.includes(rootHostname) ? 0 : -100);
        if (!queue.some((q) => q.url === link)) {
          queue.push({ url: link, priority });
        }
      }
    } catch (err) {
      console.warn(`[crawler] Failed: ${url} — ${err.message}`);
    }
  }

  pages.sort((a, b) => b.score - a.score);
  return { pages, pagesCrawled: pages.length, rootUrl: rootNormalized };
}
