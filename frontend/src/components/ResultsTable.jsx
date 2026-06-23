import { useState } from "react";
import { formatWebsiteCell, isWebsiteLink } from "../utils/formatWebsite.js";

const PAGE_SIZE = 10;

/**
 * Displays processed provider rows from the latest run (10 per page).
 */
export default function ResultsTable({ records }) {
  const [page, setPage] = useState(1);

  if (!records?.length) {
    return <p>No records processed in this run.</p>;
  }

  const totalPages = Math.ceil(records.length / PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = records.slice(start, start + PAGE_SIZE);

  function goToPage(next) {
    setPage(Math.max(1, Math.min(totalPages, next)));
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Email</th>
            <th>Telephone</th>
            <th>Website</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => (
            <tr key={`${row.provider}-${start + i}`}>
              <td>{row.provider}</td>
              <td>{row.email}</td>
              <td>{row.telephone}</td>
              <td>
                {isWebsiteLink(row.website) ? (
                  <a href={row.website} target="_blank" rel="noreferrer">
                    {row.website}
                  </a>
                ) : (
                  formatWebsiteCell(row.website)
                )}
              </td>
              <td>{row.address || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage <= 1}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {safePage} of {totalPages} ({records.length} results, {PAGE_SIZE}{" "}
            per page)
          </span>
          <button
            type="button"
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
