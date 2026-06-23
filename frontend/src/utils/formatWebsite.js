/**
 * Display / link rules for provider website column.
 */

export function isWebsiteNullValue(website) {
  return (website || "").trim().toLowerCase() === "null";
}

export function formatWebsiteCell(website) {
  const w = (website || "").trim();
  if (!w) return "—";
  if (isWebsiteNullValue(w)) return "null";
  return w;
}

export function isWebsiteLink(website) {
  const w = (website || "").trim();
  return w !== "" && !isWebsiteNullValue(w);
}
