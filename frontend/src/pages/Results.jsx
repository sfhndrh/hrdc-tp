import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchCombinedResults } from "../api.js";
import CompanyDetail from "../components/CompanyDetail.jsx";
import PageHeader from "../components/Nav.jsx";

const PAGE_SIZE = 10;
const SORT_MOST_COURSES = "courses";
const SORT_AZ = "az";
const FILTER_ALL = "all";
const FILTER_NO_WEBSITE = "no-website";
const FILTER_WITH_WEBSITE = "with-website";

function formatWebsite(website) {
  const value = String(website ?? "").trim();
  if (!value || value.toLowerCase() === "null") {
    return "No website";
  }
  return value;
}

function RefreshIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function matchesSearch(company, query) {
  if (!query) return true;
  const haystack = [
    company.provider,
    company.email,
    company.telephone,
    company.website,
    company.address,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

/**
 * Combined view: list of companies, then full-screen detail on row click.
 */
export default function Results() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState([]);
  const [meta, setMeta] = useState(null);
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const [scrapeNotice, setScrapeNotice] = useState(null);
  const [sortBy, setSortBy] = useState(SORT_MOST_COURSES);
  const [websiteFilter, setWebsiteFilter] = useState(FILTER_ALL);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchCombinedResults();
      setCompanies(data.companies || []);
      setMeta({
        total: data.total,
        withCourses: data.withCourses,
        withWebsite: data.withWebsite,
        message: data.message,
        providersWithWebsite: data.providersWithWebsite,
        distinctCourseSites: data.distinctCourseSites,
      });
      setSelected(null);
      setPage(1);
    } catch (err) {
      setError(err.message || "Failed to load results");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "HRDC Training Provider";
    load();
  }, [load, location.key]);

  useEffect(() => {
    if (location.state?.fromCourseScraper) {
      setScrapeNotice({
        coursesFound: location.state.coursesFound ?? 0,
        savedToCsv: location.state.savedToCsv ?? 0,
      });
    }
  }, [location.state]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") {
        load();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = companies.filter((company) => {
      if (websiteFilter === FILTER_NO_WEBSITE && company.hasWebsite) return false;
      if (websiteFilter === FILTER_WITH_WEBSITE && !company.hasWebsite) return false;
      return matchesSearch(company, query);
    });

    if (sortBy === SORT_AZ) {
      list = [...list].sort((a, b) => a.provider.localeCompare(b.provider));
    } else {
      list = [...list].sort((a, b) => {
        const byCourses = b.courseCount - a.courseCount;
        if (byCourses !== 0) return byCourses;
        return a.provider.localeCompare(b.provider);
      });
    }

    return list;
  }, [companies, searchQuery, sortBy, websiteFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, sortBy, websiteFilter]);

  const showList = !selected && companies.length > 0 && filteredCompanies.length > 0;
  const totalPages = Math.ceil(filteredCompanies.length / PAGE_SIZE) || 1;
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageCompanies = filteredCompanies.slice(pageStart, pageStart + PAGE_SIZE);

  function goToPage(next) {
    setPage(Math.max(1, Math.min(totalPages, next)));
  }

  return (
    <>
      <PageHeader title={!selected ? "HRDC Training Provider" : undefined} />

      {!selected && (
        <>
          <p className="subtitle">
            All HRDC training providers. Click a company to view details and courses
            when available.
          </p>

          {scrapeNotice && (
            <div className="panel success-meta">
              <p>
                Course scrape finished — showing latest data. Courses found:{" "}
                <strong>{scrapeNotice.coursesFound}</strong>
                {scrapeNotice.savedToCsv > 0 && (
                  <>
                    {" "}
                    — Saved to CSV: <strong>{scrapeNotice.savedToCsv}</strong>
                  </>
                )}
              </p>
            </div>
          )}

          <div className="panel results-toolbar">
            <button
              type="button"
              className="icon-button refresh-button"
              onClick={load}
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshIcon />
            </button>
            {meta && !meta.message && (
              <div className="results-toolbar-row">
                <span className="results-stats">
                  <strong>{meta.total}</strong> providers
                  {meta.withWebsite > 0 && (
                    <>
                      {" "}
                      (<strong>{meta.withWebsite}</strong> with website)
                    </>
                  )}
                  {meta.withCourses > 0 && (
                    <>
                      {", "}
                      <strong>{meta.withCourses}</strong> with courses
                    </>
                  )}
                </span>
                <div className="results-toolbar-controls">
                  <label className="results-control">
                    <span className="visually-hidden">Sort by</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      aria-label="Sort by"
                    >
                      <option value={SORT_MOST_COURSES}>Most courses</option>
                      <option value={SORT_AZ}>A–Z</option>
                    </select>
                  </label>
                  <label className="results-control">
                    <span className="visually-hidden">Filter by website</span>
                    <select
                      value={websiteFilter}
                      onChange={(e) => setWebsiteFilter(e.target.value)}
                      aria-label="Filter by website"
                    >
                      <option value={FILTER_ALL}>All providers</option>
                      <option value={FILTER_NO_WEBSITE}>No website</option>
                      <option value={FILTER_WITH_WEBSITE}>With website</option>
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>

          {meta && !meta.message && (
            <div className="panel results-search">
              <label className="results-search-label" htmlFor="provider-search">
                Search providers
              </label>
              <input
                id="provider-search"
                type="search"
                className="results-search-input"
                placeholder="Search by name, email, phone, website, or address…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </>
      )}

      {loading && (
        <div className="loading">
          <span className="spinner" aria-hidden />
          Loading combined results…
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {meta?.message && !loading && !selected && (
        <div className="panel results-list-center">
          <p>{meta.message}</p>
        </div>
      )}

      {!loading && !error && companies.length === 0 && !meta?.message && !selected && (
        <div className="panel results-list-center">
          <p>No training providers found.</p>
        </div>
      )}

      {!loading && !error && companies.length > 0 && filteredCompanies.length === 0 && !selected && (
        <div className="panel results-list-center">
          <p>No providers match your search or filters.</p>
        </div>
      )}

      {showList && (
        <div className="results-list-center">
          <ul className="company-list company-list--center panel">
            {pageCompanies.map((company, index) => (
              <li key={`${company.provider}-${company.email}-${pageStart + index}`}>
                <button
                  type="button"
                  className="company-list-item company-list-item--wide"
                  onClick={() => setSelected(company)}
                >
                  <span className="company-num">{pageStart + index + 1}</span>
                  <span className="company-list-body">
                    <span className="company-list-name">{company.provider}</span>
                    <span className="company-list-meta">
                      {company.courseCount} course
                      {company.courseCount !== 1 ? "s" : ""}
                    </span>
                    <span className="company-list-website">{formatWebsite(company.website)}</span>
                  </span>
                  <span className="company-list-chevron" aria-hidden>
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                className="icon-button pagination-arrow"
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage <= 1}
                aria-label="Previous page"
                title="Previous page"
              >
                <ChevronLeftIcon />
              </button>
              <span className="pagination-info">
                Page {safePage} of {totalPages} ({filteredCompanies.length} providers, {PAGE_SIZE}{" "}
                per page)
              </span>
              <button
                type="button"
                className="icon-button pagination-arrow"
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage >= totalPages}
                aria-label="Next page"
                title="Next page"
              >
                <ChevronRightIcon />
              </button>
            </div>
          )}
        </div>
      )}

      {selected && (
        <CompanyDetail
          key={selected.id}
          company={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
