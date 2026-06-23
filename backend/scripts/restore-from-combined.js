/**
 * Restore courses-output.csv from an old combined-providers-courses.csv backup.
 *
 * Usage:
 *   node scripts/restore-from-combined.js path/to/combined-providers-courses.csv
 */

import fs from "fs";
import csv from "csv-parser";
import { COURSE_CSV_HEADERS, mergeCoursesIntoCsv } from "../utils/courseCsvWriter.js";
import { writeCombinedCsvFromFiles } from "../utils/combinedCsvWriter.js";

const backupPath = process.argv[2];

if (!backupPath) {
  console.error("Usage: node scripts/restore-from-combined.js <combined-providers-courses.csv>");
  process.exit(1);
}

if (!fs.existsSync(backupPath)) {
  console.error(`File not found: ${backupPath}`);
  process.exit(1);
}

const courses = [];

await new Promise((resolve, reject) => {
  fs.createReadStream(backupPath)
    .pipe(csv())
    .on("data", (row) => {
      const course = {};
      for (const key of COURSE_CSV_HEADERS) {
        course[key] = String(row[key] ?? "").trim();
      }
      if (course.course_name) {
        courses.push(course);
      }
    })
    .on("end", resolve)
    .on("error", reject);
});

const { added, total, duplicatesSkipped } = await mergeCoursesIntoCsv(courses);
const combined = await writeCombinedCsvFromFiles();

console.log(
  `Restored ${added} course(s) from backup (${courses.length} rows read). ` +
    `courses-output.csv now has ${total} course(s). ` +
    `Skipped ${duplicatesSkipped} duplicate(s). ` +
    `combined-providers-courses.csv has ${combined.rowCount} row(s).`
);
