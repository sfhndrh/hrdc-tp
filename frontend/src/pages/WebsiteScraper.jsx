import { useCallback, useEffect, useState } from "react";
import { runScraper, fetchStatus } from "../api.js";
import ResultsTable from "../components/ResultsTable.jsx";
import PageHeader from "../components/Nav.jsx";

/**
 * Provider Discovery page — enrich training-provider CSV with website + address.
 */
export default function WebsiteScraper() {
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState(null);
  const [progress, setProgress] = useState(null);
  const [activeFile, setActiveFile] = useState("");
  const [runId, setRunId] = useState(0);

  const loadStatus = useCallback(async () => {
    try {
      const status = await fetchStatus();
      setProgress(status.progress);
      if (status.sourceFile) {
        setActiveFile(status.sourceFile.split(/[/\\]/).pop());
      }
    } catch {
      /* backend offline */
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleRun() {
    setLoading(true);
    setError("");
    setRecords([]);
    setMeta(null);

    try {
      const result = await runScraper({
        providerName: companyName.trim() || undefined,
      });

      setRecords(result.records || []);
      setRunId((id) => id + 1);
      setProgress(result.progress);
      if (result.sourceFile) {
        setActiveFile(result.sourceFile.split(/[/\\]/).pop());
      }
      setMeta({
        successCount: result.successCount,
        failureCount: result.failureCount,
        failures: result.failures || [],
        message: result.message,
      });
    } catch (err) {
      setError(err.message || "Run failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Provider Discovery" />
      <p className="subtitle">
        Find official websites and addresses for training providers using Alibaba
        Qwen (DashScope). Each run processes up to 500 rows with empty website
        fields.
      </p>

      {progress && (
        <p className="progress panel">
          Reading from: <strong>{activeFile || "training-provider.csv"}</strong>
          <br />
          Progress: <strong>{progress.completed}</strong> scraped /{" "}
          <strong>{progress.pending}</strong> not yet scraped /{" "}
          <strong>{progress.withWebsite ?? 0}</strong> with URL /{" "}
          <strong>{progress.notFound ?? 0}</strong> null /{" "}
          <strong>{progress.total}</strong> total
        </p>
      )}

      <div className="panel">
        <label htmlFor="company">Company Name</label>
        <input
          id="company"
          type="text"
          placeholder="Leave empty to process next 500 from CSV"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          disabled={loading}
        />
        <p className="hint">
          Optional. If filled, only that provider is looked up. If empty, the next
          500 rows with no website are processed.
        </p>

        <div className="actions">
          <button type="button" onClick={handleRun} disabled={loading}>
            {loading ? "Running…" : "Run"}
          </button>
        </div>

        {loading && (
          <div className="loading">
            <span className="spinner" aria-hidden />
            Calling Qwen and updating CSV…
          </div>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {meta && !error && (
        <div className="success-meta">
          {meta.message && <p>{meta.message}</p>}
          <p>
            Success: <strong>{meta.successCount}</strong> — Failures:{" "}
            <strong>{meta.failureCount}</strong>
          </p>
          {meta.failures?.length > 0 && (
            <div className="failures">
              <strong>Failed lookups:</strong>
              <ul>
                {meta.failures.map((f, i) => (
                  <li key={i}>
                    {f.provider}: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {(records.length > 0 || (meta && !loading)) && (
        <div className="panel">
          <h2>Results</h2>
          <ResultsTable key={runId} records={records} />
        </div>
      )}
    </>
  );
}
