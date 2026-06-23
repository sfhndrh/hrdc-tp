import express from "express";
import {
  readAllRows,
  findPendingRows,
  getProgressStats,
  getActiveCsvPath,
  websiteValueAfterLookup,
} from "../utils/csvReader.js";
import { writeAllRows } from "../utils/csvWriter.js";
import { fetchCompanyInfo } from "../services/qwenService.js";
import { isProviderDiscoveryEnabled } from "../utils/bootstrapFromCombined.js";

const router = express.Router();
const BATCH_SIZE = 500;

/**
 * POST /api/run
 * Process next 500 rows with empty website (incremental).
 * Optional body: { providerName: string } — process single matching row only.
 */
router.post("/run", async (req, res) => {
  if (!isProviderDiscoveryEnabled()) {
    return res.status(503).json({
      ok: false,
      error: "Provider Discovery is disabled on this deployment.",
    });
  }

  const failures = [];
  const processed = [];
  let successCount = 0;
  let failureCount = 0;

  try {
    const rows = await readAllRows();
    const providerFilter = (req.body?.providerName || req.body?.companyName || "")
      .trim();

    let pending;
    if (providerFilter) {
      const match = rows.find(
        (r) => r.provider.toLowerCase() === providerFilter.toLowerCase()
      );
      if (!match) {
        return res.status(404).json({
          ok: false,
          error: `Provider not found in CSV: ${providerFilter}`,
        });
      }
      const idx = rows.indexOf(match);
      pending = [{ row: match, index: idx }];
    } else {
      pending = findPendingRows(rows, BATCH_SIZE);
    }

    if (pending.length === 0) {
      const stats = getProgressStats(rows);
      return res.json({
        ok: true,
        message: "All rows already have a website. Nothing to process.",
        records: [],
        successCount: 0,
        failureCount: 0,
        failures: [],
        progress: stats,
        sourceFile: getActiveCsvPath(),
      });
    }

    for (const { row, index } of pending) {
      const provider = row.provider;

      if (!provider) {
        failureCount += 1;
        failures.push({ provider: "(empty)", error: "Missing provider name" });
        continue;
      }

      try {
        const { website, address } = await fetchCompanyInfo(provider);

        rows[index] = {
          ...rows[index],
          website: websiteValueAfterLookup(website),
          address: address || rows[index].address || "",
        };

        // Save after every successful update (incremental progress)
        await writeAllRows(rows);

        successCount += 1;
        processed.push({ ...rows[index] });
      } catch (err) {
        failureCount += 1;
        const message = err?.message || String(err);
        console.error(`[FAIL] ${provider}:`, message);
        failures.push({ provider, error: message });
        // Continue with remaining companies
      }
    }

    const stats = getProgressStats(rows);

    res.json({
      ok: true,
      records: processed,
      successCount,
      failureCount,
      failures,
      progress: stats,
      sourceFile: getActiveCsvPath(),
      outputFile: "training-provider-updated.csv",
    });
  } catch (err) {
    console.error("POST /api/run error:", err);
    res.status(500).json({
      ok: false,
      error: err?.message || "Internal server error",
      records: processed,
      successCount,
      failureCount,
      failures,
    });
  }
});

/**
 * GET /api/status — progress without running lookups
 */
router.get("/status", async (_req, res) => {
  try {
    const rows = await readAllRows();
    const stats = getProgressStats(rows);
    res.json({
      ok: true,
      progress: stats,
      sourceFile: getActiveCsvPath(),
      nextBatchSize: Math.min(BATCH_SIZE, stats.pending),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
