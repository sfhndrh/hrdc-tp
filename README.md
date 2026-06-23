# HRDC Training Provider


**Scraper**
Local full-stack app with two modules, both using **Alibaba DashScope (Qwen)** only.



- **Frontend:** React + Vite + React Router → http://localhost:5173  

- **Backend:** Node.js + Express → http://localhost:3001 (or `PORT` in `.env`)



| Module | Purpose |

|--------|---------|

| **Provider Discovery** | Enrich `training-provider.csv` with website + address |

| **Course Scraper** | Crawl a training site and extract all courses |



No Google, SerpAPI, Bing, or DuckDuckGo APIs.



---



## Setup



### Backend



```powershell

cd backend

copy .env.example .env

npm install

npm run dev

```



### Frontend



```powershell

cd frontend

npm install

npm run dev

```



Open http://localhost:5173



---



## Navigation



| Route | Page |

|-------|------|

| `/` | Redirects to HRDC Training Provider |

| `/results` | HRDC Training Provider (combined website + courses) |

| `/provider-discovery` | Provider Discovery |

| `/course-scraper` | Course Scraper |



---



## Provider Discovery



1. Click **Run** → processes the next **500** rows with empty `website`.

2. Saves to `backend/data/training-provider-updated.csv` (resumes on later runs).

3. Results table: **10 per page**.



**API:** `POST /api/run`



---



## Course Scraper



1. Enter **Website URLs** — one per line, up to **500** at once (comma/semicolon also works).

2. Click **Run Course Scraper** (URLs are processed one after another).

3. Backend crawls up to **50** internal pages (priority: `/courses`, `/training`, etc.).

4. Only the top **20** scored pages are batched to **Qwen** for extraction.

5. Results shown in table (**10 per page**); new rows **appended** to `backend/data/courses-output.csv` (previous results kept; duplicates skipped).

6. After each run, `backend/data/combined-providers-courses.csv` is rebuilt from all providers + all courses.



**API:** `POST /api/course-scraper`



```json
{
  "urlsText": "https://example.com\nhttps://other-training.com.my",
  "maxPages": 50
}
```

Or `{ "urls": ["https://...", "..."] }` or single `{ "url": "..." }`.
```



**Optional `.env`:**



```env

CRAWL_MAX_PAGES=50

CRAWL_QWEN_TOP_PAGES=20

CRAWL_CHARS_PER_PAGE=12000

CRAWL_MAX_BATCH_CHARS=80000

```



---



## HRDC Training Provider

Shows all companies that have a website in `training-provider-updated.csv`. Course data is shown when `courses-output.csv` has matching rows for that website (normalized URL / hostname).

Click a numbered row → **Company** tab (provider details) and **Courses** tab (course table, or empty if not scraped yet).

**API:** `GET /api/results`

Cursor spec for this feature: [`docs/CURSOR_RESULTS_PAGE_PROMPT.md`](docs/CURSOR_RESULTS_PAGE_PROMPT.md)

---

## Future pipeline



```

Provider Discovery → company website URL

       ↓

Course Scraper → courses-output.csv

       ↓

(PostgreSQL / HRDC enrichment)

```



---



## Project structure



```

backend/

  server.js

  routes/scraper.js

  routes/courseScraper.js

  services/qwenService.js

  services/crawlerService.js

  services/courseExtractor.js

  utils/csvReader.js

  utils/csvWriter.js

  utils/courseCsvWriter.js

  data/training-provider.csv

  data/training-provider-updated.csv

  data/courses-output.csv

  data/combined-providers-courses.csv



frontend/

  src/App.jsx

  src/pages/WebsiteScraper.jsx

  src/pages/CourseScraper.jsx

  src/components/Nav.jsx

  src/components/ResultsTable.jsx

  src/components/CourseResultsTable.jsx

```



---



## API summary



| Method | Path | Description |

|--------|------|-------------|

| POST | `/api/run` | Website batch lookup |

| GET | `/api/status` | CSV progress |

| POST | `/api/course-scraper` | Crawl + extract courses |

| GET | `/api/results` | Combined provider + course list |

| GET | `/api/health` | Health check |


