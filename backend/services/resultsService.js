/**
 * Combined results: all training providers; courses attached when website matches.
 */

import fs from "fs";
import { readAllRows, SOURCE_CSV, UPDATED_CSV, hasRealWebsite } from "../utils/csvReader.js";
import { readAllCourses } from "../utils/courseCsvWriter.js";
import { normalizeWebsiteUrl, websiteHostKey } from "../utils/urlNormalize.js";

function normalizeProviderRow(row) {
  return {
    provider: String(row.provider ?? row.name ?? "").trim(),
    email: String(row.email ?? "").trim(),
    telephone: String(row.telephone ?? "").trim(),
    website: String(row.website ?? "").trim(),
    address: String(row.address ?? "").trim(),
  };
}

/**
 * Build list of all companies; include courses when website URL matches.
 */
export async function getCombinedResults() {
  const csvPath = fs.existsSync(UPDATED_CSV) ? UPDATED_CSV : SOURCE_CSV;
  if (!fs.existsSync(csvPath)) {
    return {
      companies: [],
      total: 0,
      message: "training-provider.csv not found.",
    };
  }

  const providers = await readAllRows(csvPath);
  const courses = await readAllCourses();

  // Group courses by host (and exact URL) for provider matching
  const coursesByHost = new Map();
  const coursesByExactUrl = new Map();
  for (const course of courses) {
    const exactKey = normalizeWebsiteUrl(course.website_url);
    const hostKey = websiteHostKey(course.website_url);
    if (!hostKey) continue;
    if (!coursesByHost.has(hostKey)) coursesByHost.set(hostKey, []);
    coursesByHost.get(hostKey).push(course);
    if (exactKey) {
      if (!coursesByExactUrl.has(exactKey)) coursesByExactUrl.set(exactKey, []);
      coursesByExactUrl.get(exactKey).push(course);
    }
  }

  const companies = [];
  let index = 0;

  for (const raw of providers) {
    const provider = normalizeProviderRow(raw);
    const siteKey = hasRealWebsite(provider)
      ? normalizeWebsiteUrl(provider.website)
      : "";
    const hostKey = hasRealWebsite(provider) ? websiteHostKey(provider.website) : "";
    const matchedCourses = hasRealWebsite(provider)
      ? coursesByExactUrl.get(siteKey) || coursesByHost.get(hostKey) || []
      : [];

    index += 1;
    companies.push({
      id: index,
      provider: provider.provider,
      email: provider.email,
      telephone: provider.telephone,
      website: provider.website,
      address: provider.address,
      hasWebsite: hasRealWebsite(provider),
      courseCount: matchedCourses.length,
      courses: matchedCourses,
    });
  }

  // Sort by provider name
  companies.sort((a, b) => a.provider.localeCompare(b.provider));
  companies.forEach((c, i) => {
    c.id = i + 1;
  });

  return {
    companies,
    total: companies.length,
    withCourses: companies.filter((c) => c.courseCount > 0).length,
    withWebsite: companies.filter((c) => c.hasWebsite).length,
    providersWithWebsite: providers.filter((r) => hasRealWebsite(r)).length,
    distinctCourseSites: coursesByHost.size,
  };
}
