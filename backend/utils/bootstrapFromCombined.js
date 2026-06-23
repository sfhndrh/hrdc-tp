/**
 * Seed working CSVs from combined-providers-courses.csv on first deploy.
 * Skips when training-provider-updated.csv and courses-output.csv already exist.
 */

import fs from "fs";
import csv from "csv-parser";
import { COMBINED_CSV } from "./combinedCsvWriter.js";
import { SOURCE_CSV, UPDATED_CSV, readAllRows } from "./csvReader.js";
import {
  COURSES_CSV,
  COURSE_CSV_HEADERS,
  mergeCoursesIntoCsv,
} from "./courseCsvWriter.js";
import { writeAllRows } from "./csvWriter.js";

function providerKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

function pickBetter(current, incoming) {
  const a = String(current ?? "").trim();
  const b = String(incoming ?? "").trim();
  if (!b) return a;
  if (!a || a.toLowerCase() === "null") return b;
  return a;
}

async function readCombinedRows() {
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(COMBINED_CSV)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });
  return rows;
}

function buildProviderEnrichment(combinedRows) {
  const map = new Map();

  for (const row of combinedRows) {
    const key = providerKey(row.provider);
    if (!key) continue;

    const prev = map.get(key) ?? {};
    map.set(key, {
      email: pickBetter(prev.email, row.email),
      telephone: pickBetter(prev.telephone, row.telephone),
      website: pickBetter(prev.website, row.website),
      address: pickBetter(prev.address, row.address),
    });
  }

  return map;
}

function extractCourses(combinedRows) {
  const courses = [];

  for (const row of combinedRows) {
    const course = {};
    for (const key of COURSE_CSV_HEADERS) {
      course[key] = String(row[key] ?? "").trim();
    }
    if (course.course_name) {
      courses.push(course);
    }
  }

  return courses;
}

/**
 * @returns {Promise<{ ran: boolean, reason?: string, providersWritten?: number, coursesTotal?: number }>}
 */
export async function bootstrapFromCombinedIfNeeded() {
  if (!fs.existsSync(COMBINED_CSV)) {
    return { ran: false, reason: "combined-providers-courses.csv not found" };
  }

  const needsUpdated = !fs.existsSync(UPDATED_CSV);
  const needsCourses = !fs.existsSync(COURSES_CSV);

  if (!needsUpdated && !needsCourses) {
    return { ran: false, reason: "working CSVs already exist" };
  }

  const combinedRows = await readCombinedRows();
  if (combinedRows.length === 0) {
    return { ran: false, reason: "combined-providers-courses.csv is empty" };
  }

  const result = { ran: true };

  if (needsCourses) {
    const { total } = await mergeCoursesIntoCsv(extractCourses(combinedRows));
    result.coursesTotal = total;
  }

  if (needsUpdated) {
    if (!fs.existsSync(SOURCE_CSV)) {
      throw new Error("Cannot bootstrap providers: training-provider.csv not found");
    }

    const enrichment = buildProviderEnrichment(combinedRows);
    const sourceRows = await readAllRows(SOURCE_CSV);
    const merged = sourceRows.map((row) => {
      const extra = enrichment.get(providerKey(row.provider));
      if (!extra) return row;

      return {
        ...row,
        email: pickBetter(row.email, extra.email),
        telephone: pickBetter(row.telephone, extra.telephone),
        website: pickBetter(row.website, extra.website),
        address: pickBetter(row.address, extra.address),
      };
    });

    await writeAllRows(merged);
    result.providersWritten = merged.length;
  }

  return result;
}

export function isCourseScraperEnabled() {
  const value = (process.env.ENABLE_COURSE_SCRAPER ?? "true").trim().toLowerCase();
  return value !== "false" && value !== "0";
}
