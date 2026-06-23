import express from "express";
import { getCombinedResults } from "../services/resultsService.js";

const router = express.Router();

/**
 * GET /api/results
 * All training providers; courses included when website_url matches.
 */
router.get("/results", async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    const data = await getCombinedResults();
    res.json({ ok: true, ...data });
  } catch (err) {
    console.error("[results] Error:", err);
    res.status(500).json({
      ok: false,
      error: err.message || "Failed to load combined results",
    });
  }
});

export default router;
