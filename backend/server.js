import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import scraperRoutes from "./routes/scraper.js";
import courseScraperRoutes from "./routes/courseScraper.js";
import resultsRoutes from "./routes/results.js";
import { isApiKeyConfigured } from "./services/qwenService.js";
import { writeCombinedCsvFromFiles } from "./utils/combinedCsvWriter.js";
import { COURSES_CSV } from "./utils/courseCsvWriter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Scraper API",
    model: process.env.ALIBABA_MODEL || "qwen-plus",
  });
});

app.use("/api", scraperRoutes);
app.use("/api", courseScraperRoutes);
app.use("/api", resultsRoutes);

// Course scraper can run several minutes (crawl + Qwen batches)
const server = app.listen(PORT, async () => {
  console.log(`Scraper backend running at http://localhost:${PORT}`);
  console.log(
    `API key: ${isApiKeyConfigured() ? "loaded" : "MISSING — check backend/.env"}`
  );

  if (fs.existsSync(COURSES_CSV)) {
    try {
      const combined = await writeCombinedCsvFromFiles();
      console.log(
        `Combined CSV ready: ${combined.rowCount} row(s) in combined-providers-courses.csv`
      );
    } catch (err) {
      console.error("[startup] Failed to build combined CSV:", err.message);
    }
  }
});

server.timeout = 30 * 60 * 1000;
server.requestTimeout = 30 * 60 * 1000;
