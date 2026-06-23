import { useState } from "react";
import CourseResultsTable from "./CourseResultsTable.jsx";

const FIELDS = [
  { key: "provider", label: "Provider" },
  { key: "email", label: "Email" },
  { key: "telephone", label: "Telephone" },
  { key: "website", label: "Website", link: true },
  { key: "address", label: "Address" },
];

function displayWebsite(website) {
  const value = String(website ?? "").trim();
  if (!value || value.toLowerCase() === "null") {
    return "";
  }
  return value;
}

export default function CompanyDetail({ company, onClose }) {
  const [tab, setTab] = useState("company");

  if (!company) return null;

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <h2>{company.provider}</h2>
        <button type="button" className="detail-back" onClick={onClose}>
          ← Back to list
        </button>
      </div>

      <div className="detail-tabs">
        <button
          type="button"
          className={tab === "company" ? "detail-tab active" : "detail-tab"}
          onClick={() => setTab("company")}
        >
          Company
        </button>
        <button
          type="button"
          className={tab === "courses" ? "detail-tab active" : "detail-tab"}
          onClick={() => setTab("courses")}
        >
          Courses ({company.courseCount})
        </button>
      </div>

      {tab === "company" && (
        <dl className="detail-grid">
          {FIELDS.map(({ key, label, link }) => {
            const raw = company[key];
            const websiteValue = key === "website" ? displayWebsite(raw) : raw;
            return (
            <div key={key} className="detail-row">
              <dt>{label}</dt>
              <dd>
                {link && websiteValue ? (
                  <a href={websiteValue} target="_blank" rel="noreferrer">
                    {websiteValue}
                  </a>
                ) : (
                  websiteValue || "—"
                )}
              </dd>
            </div>
            );
          })}
        </dl>
      )}

      {tab === "courses" && (
        <CourseResultsTable courses={company.courses} />
      )}
    </div>
  );
}
