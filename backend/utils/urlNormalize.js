/**
 * Normalize website URLs for matching provider.website ↔ courses.website_url.
 */

export function normalizeWebsiteUrl(url) {
  const raw = (url || "").trim();
  if (!raw) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "") || "";
    return `${host}${path}${parsed.search}`.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/^www\./, "").replace(/\/+$/, "");
  }
}

/** Host-only key for matching provider.website ↔ course.website_url. */
export function websiteHostKey(url) {
  const normalized = normalizeWebsiteUrl(url);
  if (!normalized) return "";
  return normalized.split("/")[0].split("?")[0];
}
