# Cursor prompt: Results page (combined Website + Course data)

Copy this into Cursor when extending or fixing the Results feature.

---

## Task

Add a **Results** page to the existing Scraper full-stack app that merges:

- `backend/data/training-provider-updated.csv` (provider, email, telephone, website, address)
- `backend/data/courses-output.csv` (website_url, course fields…)

## Navigation

Use React Router. Add top nav link **Results**.

Routes:

- `/` → redirect to `/provider-discovery`
- `/provider-discovery`
- `/course-scraper`
- `/results` ← new

## Inclusion rules (important)

Show **only** companies where **all** of the following are true:

1. Row exists in `training-provider-updated.csv` with non-empty `website`.
2. At least one row exists in `courses-output.csv` where `website_url` **matches** that provider’s `website` (after URL normalization).
3. Normalize URLs before compare: lowercase host, strip `www.`, strip trailing slash, optional path+query.

Do **not** list providers with website but no courses, or courses whose `website_url` does not match any provider website.

## UI layout

**Page title:** Results

**Left column:** Numbered list (`#` on the left: 1, 2, 3…)

Each row shows:

- Provider name
- Course count
- Website (truncated/meta line)

**Right column:** Detail panel when a row is clicked

**Tabs in detail panel:**

1. **Company** — all fields from training-provider-updated.csv (provider, email, telephone, website as link, address).
2. **Courses** — table of all courses for that company from courses-output.csv (same columns as Course Scraper results, 10 per page pagination).

Empty state: explain user must run Provider Discovery then Course Scraper with matching URLs.

**Refresh** button to reload data from CSVs.

## Backend API

`GET /api/results`

Response:

```json
{
  "ok": true,
  "total": 12,
  "companies": [
    {
      "id": 1,
      "provider": "ABC Training Sdn Bhd",
      "email": "...",
      "telephone": "...",
      "website": "https://example.com",
      "address": "...",
      "courseCount": 5,
      "courses": [ { "course_name": "...", ... } ]
    }
  ],
  "providersWithWebsite": 100,
  "distinctCourseSites": 15
}
```

Implement in:

- `backend/utils/urlNormalize.js` — `normalizeWebsiteUrl()`
- `backend/services/resultsService.js` — join logic
- `backend/routes/results.js` — mount on Express

## Frontend files

- `frontend/src/pages/Results.jsx`
- `frontend/src/components/CompanyDetail.jsx` (tabs: Company | Courses)
- `frontend/src/api.js` — `fetchCombinedResults()`
- Update `Nav.jsx`, `App.jsx`, `index.css`

## Tech constraints

- React + Vite frontend, Express backend (existing stack).
- No new AI calls on Results page — read CSV only.
- Match existing UI patterns (panels, tables, pagination, nav links).
- Mobile: stack list above detail on narrow screens.

## Future pipeline (design only)

```
Provider Discovery → training-provider-updated.csv
Course Scraper  → courses-output.csv (same website URL)
Results page    → read-only merged view
→ later: PostgreSQL
```

## Quality

- Async/await, error handling, loading states.
- Sort companies alphabetically by provider name; re-number `id` 1..n after sort.
- Reuse `CourseResultsTable` for courses tab.

---

## Verification checklist

- [ ] Provider with website but no courses → **not** in list
- [ ] Course with website_url not in provider CSV → **not** shown under any company
- [ ] `https://www.foo.com` matches `https://foo.com/` in provider.website
- [ ] Click row → Company tab shows provider fields
- [ ] Courses tab shows only that site’s courses
- [ ] Refresh reloads without restart
