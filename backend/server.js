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
const FRONTEND_DIST = path.join(__dirname, "..", "frontend", "dist");

const corsOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
if (process.env.FRONTEND_URL) {
  corsOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ""));
}

app.use(cors({ origin: corsOrigins }));
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

// Production: serve built React app from the same origin (Render Web Service).
if (fs.existsSync(path.join(FRONTEND_DIST, "index.html"))) {
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(FRONTEND_DIST, "index.html"), (err) => {
      if (err) next(err);
    });
  });
} else {
  console.warn(
    `[startup] UI not available: ${path.join(FRONTEND_DIST, "index.html")} missing. ` +
      "Set Render Build Command to: npm install && npm run build"
  );
}

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
