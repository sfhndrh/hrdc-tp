/**
 * Append course rows to courses-output.csv with duplicate prevention.
 * Schema is PostgreSQL-friendly (flat columns, stable keys).
 */

import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
export const COURSES_CSV = path.join(DATA_DIR, "courses-output.csv");

export const COURSE_CSV_HEADERS = [
  "website_url",
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

function duplicateKey(row) {
  const site = (row.website_url || "").trim().toLowerCase();
  const name = (row.course_name || "").trim().toLowerCase();
  return `${site}::${name}`;
}

/**
 * Read all rows from courses-output.csv.
 */
export async function readAllCourses() {
  if (!fs.existsSync(COURSES_CSV)) {
    return [];
  }

  const rows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(COURSES_CSV)
      .pipe(csv())
      .on("data", (row) => {
        const normalized = {};
        for (const h of COURSE_CSV_HEADERS) {
          normalized[h] = String(row[h] ?? "").trim();
        }
        rows.push(normalized);
      })
      .on("end", resolve)
      .on("error", reject);
  });

  return rows;
}

function normalizeCourseRecord(course) {
  const record = {};
  for (const h of COURSE_CSV_HEADERS) {
    record[h] = String(course[h] ?? "").trim();
  }
  return record;
}

/**
 * Append new courses; skip duplicates (same website_url + course_name).
 */
export async function appendCoursesToCsv(newCourses) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const existing = await readAllCourses();
  const keys = new Set(existing.map(duplicateKey));
  const toAppend = [];
  let duplicatesSkipped = 0;

  for (const course of newCourses) {
    const record = normalizeCourseRecord(course);
    if (!record.course_name) continue;

    const key = duplicateKey(record);
    if (keys.has(key)) {
      duplicatesSkipped += 1;
      continue;
    }
    keys.add(key);
    toAppend.push(record);
  }

  const allRows = existing.concat(toAppend);

  const writer = createObjectCsvWriter({
    path: COURSES_CSV,
    header: COURSE_CSV_HEADERS.map((id) => ({ id, title: id })),
  });

  await writer.writeRecords(allRows);

  return {
    appended: toAppend.length,
    duplicatesSkipped,
    total: allRows.length,
  };
}

/**
 * Merge courses from a backup (e.g. old combined CSV extract) into courses-output.csv.
 */
export async function mergeCoursesIntoCsv(incomingCourses) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const existing = await readAllCourses();
  const keys = new Set(existing.map(duplicateKey));
  const merged = [...existing];
  let added = 0;
  let duplicatesSkipped = 0;

  for (const course of incomingCourses) {
    const record = normalizeCourseRecord(course);
    if (!record.course_name) continue;

    const key = duplicateKey(record);
    if (keys.has(key)) {
      duplicatesSkipped += 1;
      continue;
    }
    keys.add(key);
    merged.push(record);
    added += 1;
  }

  const writer = createObjectCsvWriter({
    path: COURSES_CSV,
    header: COURSE_CSV_HEADERS.map((id) => ({ id, title: id })),
  });

  await writer.writeRecords(merged);

  return { added, total: merged.length, duplicatesSkipped };
}

export { duplicateKey };
