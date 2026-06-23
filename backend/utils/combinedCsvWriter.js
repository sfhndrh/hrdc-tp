/**
 * Flat combined CSV: provider fields + course fields (one row per course).
 */

import fs from "fs";
import path from "path";
import { createObjectCsvWriter } from "csv-writer";
import { fileURLToPath } from "url";
import { readAllRows, UPDATED_CSV, CSV_HEADERS, hasRealWebsite } from "./csvReader.js";
import {
  COURSES_CSV,
  COURSE_CSV_HEADERS,
  readAllCourses,
} from "./courseCsvWriter.js";
import { normalizeWebsiteUrl, websiteHostKey } from "./urlNormalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
export const COMBINED_CSV = path.join(DATA_DIR, "combined-providers-courses.csv");

export const COMBINED_CSV_HEADERS = [...CSV_HEADERS, ...COURSE_CSV_HEADERS];

function normalizeProviderRow(row) {
  return {
    provider: String(row.provider ?? row.name ?? "").trim(),
    email: String(row.email ?? "").trim(),
    telephone: String(row.telephone ?? "").trim(),
    website: String(row.website ?? "").trim(),
    address: String(row.address ?? "").trim(),
  };
}

function buildProviderIndexes(providers) {
  const byExact = new Map();
  const byHost = new Map();

  for (const raw of providers) {
    const provider = normalizeProviderRow(raw);
    if (!hasRealWebsite(provider)) continue;

    const exactKey = normalizeWebsiteUrl(provider.website);
    const hostKey = websiteHostKey(provider.website);

    if (exactKey && !byExact.has(exactKey)) {
      byExact.set(exactKey, provider);
    }
    if (hostKey && !byHost.has(hostKey)) {
      byHost.set(hostKey, provider);
    }
  }

  return { byExact, byHost };
}

function findProviderForCourse(course, indexes) {
  const exactKey = normalizeWebsiteUrl(course.website_url);
  const hostKey = websiteHostKey(course.website_url);
  return indexes.byExact.get(exactKey) || indexes.byHost.get(hostKey) || null;
}

/**
 * Build flat rows: one per course, provider columns filled when matched.
 */
export function buildFlatCombinedRows(providers, courses) {
  const indexes = buildProviderIndexes(providers);
  const rows = [];

  for (const course of courses) {
    const provider = findProviderForCourse(course, indexes);
    const row = {};

    for (const key of CSV_HEADERS) {
      row[key] = provider?.[key] ?? "";
    }
    for (const key of COURSE_CSV_HEADERS) {
      row[key] = String(course[key] ?? "").trim();
    }

    rows.push(row);
  }

  rows.sort((a, b) => {
    const providerCmp = a.provider.localeCompare(b.provider);
    if (providerCmp !== 0) return providerCmp;
    return a.course_name.localeCompare(b.course_name);
  });

  return rows;
}

/**
 * Write combined-providers-courses.csv from provider + course rows.
 */
export async function writeCombinedCsv(providers, courses) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const rows = buildFlatCombinedRows(providers, courses);
  const writer = createObjectCsvWriter({
    path: COMBINED_CSV,
    header: COMBINED_CSV_HEADERS.map((id) => ({ id, title: id })),
  });

  await writer.writeRecords(
    rows.map((row) => {
      const record = {};
      for (const key of COMBINED_CSV_HEADERS) {
        record[key] = row[key] ?? "";
      }
      return record;
    })
  );

  return { path: COMBINED_CSV, rowCount: rows.length };
}

/**
 * Read active CSVs and regenerate the combined file.
 */
export async function writeCombinedCsvFromFiles() {
  const providers = fs.existsSync(UPDATED_CSV) ? await readAllRows(UPDATED_CSV) : [];
  const courses = fs.existsSync(COURSES_CSV) ? await readAllCourses() : [];
  return writeCombinedCsv(providers, courses);
}
