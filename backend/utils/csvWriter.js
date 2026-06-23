import fs from "fs";
import path from "path";
import { createObjectCsvWriter } from "csv-writer";
import { CSV_HEADERS, UPDATED_CSV } from "./csvReader.js";

const MAX_WRITE_ATTEMPTS = 5;
const RETRY_DELAY_MS = 400;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Windows often returns EBUSY when Excel or an editor has the CSV open.
 */
function isBusyError(err) {
  const code = err?.code || "";
  return code === "EBUSY" || code === "EPERM" || code === "EACCES";
}

async function replaceFileWithRetry(tmpPath, finalPath) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    try {
      if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
      }
      fs.renameSync(tmpPath, finalPath);
      return;
    } catch (err) {
      lastError = err;
      if (isBusyError(err) && attempt < MAX_WRITE_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      break;
    }
  }

  if (fs.existsSync(tmpPath)) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore cleanup failure */
    }
  }

  throw new Error(
    `Could not save ${path.basename(finalPath)}. Close it in Excel or any editor, then run again. (${lastError?.code || lastError?.message})`
  );
}

/**
 * Write all rows to training-provider-updated.csv (full snapshot).
 * Uses a temp file + rename to reduce lock conflicts on Windows.
 */
export async function writeAllRows(rows) {
  const dir = path.dirname(UPDATED_CSV);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = `${UPDATED_CSV}.tmp`;

  const writer = createObjectCsvWriter({
    path: tmpPath,
    header: CSV_HEADERS.map((id) => ({ id, title: id })),
  });

  await writer.writeRecords(
    rows.map((row) => {
      const record = {};
      for (const key of CSV_HEADERS) {
        record[key] = row[key] ?? "";
      }
      return record;
    })
  );

  await replaceFileWithRetry(tmpPath, UPDATED_CSV);
  return UPDATED_CSV;
}
