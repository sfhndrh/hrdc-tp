/**
 * Alibaba DashScope (Qwen) client — OpenAI-compatible chat completions.
 * Shared by Provider Discovery and Course Scraper (pipeline-ready).
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PLACEHOLDER_KEYS = new Set(["", "my-api-key", "your-dashscope-api-key"]);

export const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

function getConfig() {
  const apiKey = (
    process.env.ALIBABA_API_KEY ||
    process.env.DASHSCOPE_API_KEY ||
    ""
  ).trim();

  const baseUrl = (process.env.ALIBABA_BASE_URL || "https://dashscope-intl.aliyuncs.com").replace(
    /\/$/,
    ""
  );
  const model = process.env.ALIBABA_MODEL || "qwen-plus";

  if (PLACEHOLDER_KEYS.has(apiKey)) {
    throw new Error(
      "ALIBABA_API_KEY is missing or still set to placeholder. Update backend/.env and restart the backend."
    );
  }

  return { apiKey, baseUrl, model };
}

export function isApiKeyConfigured() {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse JSON from model text (handles markdown fences and nested objects).
 */
export function parseQwenJson(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Empty response from Qwen");
  }

  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object in Qwen response: ${cleaned.slice(0, 200)}`);
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Generic Qwen chat completion with retries.
 */
export async function chatWithQwen(prompt, options = {}) {
  const { apiKey, baseUrl, model } = getConfig();
  const url = `${baseUrl}/compatible-mode/v1/chat/completions`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const temperature = options.temperature ?? 0.1;

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    let timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const body = await response.json();

      if (!response.ok) {
        const msg =
          body?.error?.message ||
          body?.message ||
          JSON.stringify(body).slice(0, 300);
        throw new Error(`DashScope HTTP ${response.status}: ${msg}`);
      }

      return body?.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      lastError = err;
      const retriable =
        err.name === "AbortError" ||
        err.message?.includes("fetch") ||
        err.message?.includes("HTTP 5") ||
        err.message?.includes("429");

      if (attempt < MAX_RETRIES && retriable) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}

function buildCompanyPrompt(providerName) {
  return `You are a company information extraction assistant.

Given the company name below, determine:

1. Official website URL
2. Official business address

Requirements:

* Return only the official company website.
* Prefer the company's own website.
* Do not return LinkedIn.
* Do not return Facebook.
* Do not return directories.
* Do not return JobStreet.
* Do not return Yellow Pages.
* Do not return listing websites.
* If unsure, return null.

Company:
${providerName}

Return JSON only:

{
"website": "",
"address": ""
}`;
}

/**
 * Provider Discovery: find company website and address.
 */
export async function fetchCompanyInfo(providerName) {
  const content = await chatWithQwen(buildCompanyPrompt(providerName));
  const parsed = parseQwenJson(content);

  return {
    website:
      parsed.website === null || parsed.website === undefined
        ? ""
        : String(parsed.website).trim(),
    address:
      parsed.address === null || parsed.address === undefined
        ? ""
        : String(parsed.address).trim(),
  };
}

export const COURSE_EXTRACTION_PROMPT_PREFIX = `You are an expert course catalog extraction system.

Extract every training course found in the provided website content.

For each course identify:

* course_name
* course_module (module/topic/unit name within the program, if listed)
* duration
* start_date
* end_date
* delivery_mode
* venue
* platform
* fee
* number_of_participants
* trainer
* certification
* hrdc_claimable
* course_url
* description

Rules:

* Extract every course available.
* Return JSON only.
* If a field is unavailable return null.
* Do not invent information.
* Multiple courses may exist.

Return:

{
"courses": [
{
"course_name": "",
"course_module": "",
"duration": "",
"start_date": "",
"end_date": "",
"delivery_mode": "",
"venue": "",
"platform": "",
"fee": "",
"number_of_participants": "",
"trainer": "",
"certification": "",
"hrdc_claimable": "",
"course_url": "",
"description": ""
}
]
}

Website base URL: `;

/**
 * Course Scraper: extract courses from combined page content.
 */
export async function extractCoursesFromContent(websiteUrl, combinedContent) {
  const prompt = `${COURSE_EXTRACTION_PROMPT_PREFIX}${websiteUrl}

--- WEBSITE CONTENT ---
${combinedContent}`;

  const content = await chatWithQwen(prompt, { timeoutMs: 120_000 });
  const parsed = parseQwenJson(content);
  const courses = Array.isArray(parsed.courses) ? parsed.courses : [];
  return courses;
}
