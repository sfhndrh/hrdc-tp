import { Navigate, Route, Routes } from "react-router-dom";
import WebsiteScraper from "./pages/WebsiteScraper.jsx";
import CourseScraper from "./pages/CourseScraper.jsx";
import Results from "./pages/Results.jsx";

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Results />} />
        <Route path="/results" element={<Navigate to="/" replace />} />
        <Route path="/provider-discovery" element={<WebsiteScraper />} />
        <Route path="/website-scraper" element={<Navigate to="/provider-discovery" replace />} />
        <Route path="/course-scraper" element={<CourseScraper />} />
      </Routes>
    </div>
  );
}
