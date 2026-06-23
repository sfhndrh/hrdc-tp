# HRDC Training Provider

A local web app for browsing and enriching **HRDC-registered training providers** in Malaysia. The home page is a searchable directory of providers; supporting tools discover company websites and scrape course catalogues from those sites.

**Stack:** React + Vite (frontend) · Node.js + Express (backend) · Alibaba DashScope (Qwen) for AI-assisted lookup and extraction

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |

---

## What it does

The app starts from a master list of HRDC training providers (`backend/data/training-provider.csv`) — provider name, email, telephone, website, and address. Over time, that list is enriched with:

- **Websites and addresses** — via Provider Discovery (Qwen-assisted lookup)
- **Course catalogues** — via Course Scraper (crawl + Qwen extraction)

Everything comes together on the **HRDC Training Provider** page: one place to search providers, filter by website status, sort by course count, and drill into company details and courses.

```
training-provider.csv
        ↓  Provider Discovery
training-provider-updated.csv  (website + address)
        ↓  Course Scraper
courses-output.csv
        ↓  merge
combined-providers-courses.csv  →  HRDC Training Provider UI
```

---

## HRDC Training Provider (home)

**Route:** `/` (also `/results` redirects here)

Browse all providers from the CSV. For each company you can see:

| Field | Description |
|-------|-------------|
| Provider | Registered training provider name |
| Email / Telephone | Contact details |
| Website | Company site (when discovered) |
| Address | Physical address (when discovered) |
| Courses | Matched courses from scraped data |

**Features**

- Search by provider name, email, phone, website, or address
- Filter: all providers · with website · without website
- Sort: most courses first · A–Z by name
- Click a row → **Company** tab (provider details) and **Courses** tab (course table, or empty if not scraped yet)
- Course fields include name, module, duration, dates, delivery mode, venue, fee, trainer, certification, HRDC claimable, and more
- Refresh reloads the latest CSV data (e.g. after a scrape)

**API:** `GET /api/results`

---

## Data enrichment tools

Access these from the **Settings** menu (gear icon) in the app header.

### Provider Discovery

Finds website and address for providers that do not yet have a website in the CSV.

1. Click **Run** — processes the next **500** rows with an empty `website`
2. Saves to `backend/data/training-provider-updated.csv` (resumes on later runs)
3. Results table: **10 per page**

**Route:** `/provider-discovery`  
**API:** `POST /api/run`

### Course Scraper

Crawls training provider websites and extracts course listings.

1. Enter **Website URLs** — one per line, up to **500** at once (comma/semicolon also works)
2. Click **Run Course Scraper** (URLs processed sequentially)
3. Backend crawls up to **50** internal pages (priority: `/courses`, `/training`, etc.)
4. Top **20** scored pages are sent to **Qwen** for extraction
5. Results appended to `backend/data/courses-output.csv` (duplicates skipped)
6. Rebuilds `backend/data/combined-providers-courses.csv` after each run

**Route:** `/course-scraper`  
**API:** `POST /api/course-scraper`

```json
{
  "urlsText": "https://example.com\nhttps://other-training.com.my",
  "maxPages": 50
}
```

Also accepts `{ "urls": ["https://..."] }` or `{ "url": "..." }`.

---

## Setup

### 1. Backend

```powershell
cd backend
copy .env.example .env
```

Edit `.env` and set your Alibaba DashScope API key:

```env
ALIBABA_API_KEY=your-key-here
ALIBABA_BASE_URL=https://dashscope-intl.aliyuncs.com
ALIBABA_MODEL=qwen-plus
PORT=3001
```

```powershell
npm install
npm run dev
```

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Deploy on Render (Web Service)

One **Web Service** serves both the React UI and the API from the same URL.

### Render settings

| Field | Value |
|-------|--------|
| **Root Directory** | `backend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

### Environment variables (Render dashboard)

Set these under **Environment** (do not commit real keys):

| Key | Example |
|-----|---------|
| `ALIBABA_API_KEY` | your DashScope API key |
| `ALIBABA_BASE_URL` | `https://dashscope-intl.aliyuncs.com` |
| `ALIBABA_MODEL` | `qwen-plus` |
| `ENABLE_COURSE_SCRAPER` | `false` on Render (optional; disables course scrape API) |
| `VITE_ENABLE_COURSE_SCRAPER` | `false` on Render (hides Course Scraper in the UI; set before build) |

On first startup, if `training-provider-updated.csv` and `courses-output.csv` are missing, the server **seeds them from `combined-providers-courses.csv`** (committed in git) so the Results page shows existing websites and courses.

Render sets `PORT` automatically. The build step installs frontend deps and runs `vite build`; the backend then serves `frontend/dist` at `/`.

After deploy, open your service URL (e.g. `https://hrdc-tp.onrender.com`) — the HRDC Training Provider UI should load. API health check: `/api/health`.

**Note:** CSV files on Render use ephemeral disk unless you attach a [Persistent Disk](https://render.com/docs/disks) mounted at `backend/data`.

Alternatively, import `render.yaml` from the repo root as a [Blueprint](https://render.com/docs/infrastructure-as-code).

---

## Optional crawl settings

Add to `backend/.env` to tune the Course Scraper:

```env
CRAWL_MAX_PAGES=50
CRAWL_QWEN_TOP_PAGES=20
CRAWL_CHARS_PER_PAGE=12000
CRAWL_MAX_BATCH_CHARS=80000
```

---

## Project structure

```
backend/
  server.js
  routes/          scraper, courseScraper, results
  services/        qwenService, crawlerService, courseExtractor, resultsService
  utils/           CSV read/write, URL normalization
  data/
    training-provider.csv              # master HRDC provider list
    training-provider-updated.csv      # after Provider Discovery (gitignored)
    courses-output.csv                 # scraped courses (gitignored)
    combined-providers-courses.csv       # merged export

frontend/
  src/
    pages/           Results.jsx (home), WebsiteScraper.jsx, CourseScraper.jsx
    components/      CompanyDetail, ResultsTable, CourseResultsTable, Nav
```

---

## API summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/results` | Combined provider + course list |
| POST | `/api/run` | Provider Discovery batch |
| GET | `/api/status` | CSV progress |
| POST | `/api/course-scraper` | Crawl + extract courses |
| GET | `/api/health` | Health check |

---

## Notes

- AI features use **Alibaba DashScope (Qwen)** only — no Google, SerpAPI, Bing, or DuckDuckGo APIs.
- `backend/.env` is gitignored; use `backend/.env.example` as a template.
- Generated CSV outputs (`training-provider-updated.csv`, `courses-output.csv`) are gitignored; `combined-providers-courses.csv` and the source provider list are tracked in the repo.
