import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

export const SOURCE_CSV = path.join(DATA_DIR, "training-provider.csv");
export const UPDATED_CSV = path.join(DATA_DIR, "training-provider-updated.csv");

export const CSV_HEADERS = [
  "provider",
  "email",
  "telephone",
  "website",
  "address",
];

/** Written when scrape ran but no website was found (skip on future batch runs). */
export const WEBSITE_NULL = "null";

/**
 * Resolve which CSV file to read: updated file if it exists, else source.
 */
export function getActiveCsvPath() {
  if (fs.existsSync(UPDATED_CSV)) {
    return UPDATED_CSV;
  }
  return SOURCE_CSV;
}

/**
 * Read all rows from the active CSV into memory.
 * @returns {Promise<Array<Record<string, string>>>}
 */
export function readAllRows(filePath = getActiveCsvPath()) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      reject(new Error(`CSV not found: ${filePath}`));
      return;
    }

    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        rows.push(normalizeRow(row));
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });
}

/**
 * Normalize column names and ensure all expected fields exist.
 */
export function normalizeRow(row) {
  const normalized = {};
  for (const key of CSV_HEADERS) {
    const value = row[key] ?? row[key?.toLowerCase?.()] ?? "";
    normalized[key] = String(value).trim();
  }
  return normalized;
}

/**
 * True when website has never been scraped (blank cell only).
 */
export function isWebsiteEmpty(row) {
  return (row.website ?? "").trim() === "";
}

/**
 * True when scrape completed but no website was found.
 */
export function isWebsiteNull(row) {
  return (row.website ?? "").trim().toLowerCase() === WEBSITE_NULL;
}

/**
 * True when batch has already attempted website lookup (URL or null).
 */
export function isWebsiteScraped(row) {
  return !isWebsiteEmpty(row);
}

/**
 * True when a real website URL exists (not null, not blank).
 */
export function hasRealWebsite(row) {
  const w = (row.website ?? "").trim();
  return w !== "" && w.toLowerCase() !== WEBSITE_NULL;
}

/**
 * Value to store in CSV after a lookup attempt.
 */
export function websiteValueAfterLookup(url) {
  const w = (url || "").trim();
  return w || WEBSITE_NULL;
}

/**
 * Find first N rows that still need a website lookup.
 */
export function findPendingRows(rows, limit = 10) {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isWebsiteEmpty(row))
    .slice(0, limit);
}

/**
 * Count rows with and without website for progress display.
 */
export function getProgressStats(rows) {
  const total = rows.length;
  const pending = rows.filter((r) => isWebsiteEmpty(r)).length;
  const notFound = rows.filter((r) => isWebsiteNull(r)).length;
  const withWebsite = rows.filter((r) => hasRealWebsite(r)).length;
  const completed = total - pending;
  return { total, completed, pending, notFound, withWebsite };
}
