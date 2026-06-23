import { useState } from "react";

const PAGE_SIZE = 10;

const BASE_COLUMNS = [
  { key: "course_name", label: "Course Name" },
  { key: "course_module", label: "Course Module" },
  { key: "duration", label: "Duration" },
  { key: "start_date", label: "Start Date" },
  { key: "end_date", label: "End Date" },
  { key: "delivery_mode", label: "Delivery Mode" },
  { key: "venue", label: "Venue" },
  { key: "platform", label: "Platform" },
  { key: "fee", label: "Fee" },
  { key: "number_of_participants", label: "Participants" },
  { key: "trainer", label: "Trainer" },
  { key: "certification", label: "Certification" },
  { key: "hrdc_claimable", label: "HRDC Claimable" },
  { key: "course_url", label: "Course URL" },
];

export default function CourseResultsTable({ courses, showWebsiteUrl = false }) {
  const [page, setPage] = useState(1);

  const columns = showWebsiteUrl
    ? [{ key: "website_url", label: "Website" }, ...BASE_COLUMNS]
    : BASE_COLUMNS;

  if (!courses?.length) {
    return <p>No courses found.</p>;
  }

  const totalPages = Math.ceil(courses.length / PAGE_SIZE);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = courses.slice(start, start + PAGE_SIZE);

  return (
    <div className="table-wrap course-table-wrap">
      <table className="course-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => (
            <tr key={`${row.course_name}-${start + i}`}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.key === "website_url" && row.website_url ? (
                    <a
                      href={row.website_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {row.website_url}
                    </a>
                  ) : col.key === "course_url" && row.course_url ? (
                    <a href={row.course_url} target="_blank" rel="noreferrer">
                      {row.course_url}
                    </a>
                  ) : (
                    row[col.key] || "—"
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
          >
            Previous
          </button>
          <span className="pagination-info">
            Page {safePage} of {totalPages} ({courses.length} courses, {PAGE_SIZE}{" "}
            per page)
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
