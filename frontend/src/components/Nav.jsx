import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

function SettingsIcon() {
  return (
    <svg
      className="settings-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const providerDiscoveryEnabled =
  import.meta.env.VITE_ENABLE_PROVIDER_DISCOVERY !== "false";
const courseScraperEnabled = import.meta.env.VITE_ENABLE_COURSE_SCRAPER !== "false";
const showSettings = providerDiscoveryEnabled || courseScraperEnabled;

export default function PageHeader({ title }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open || !showSettings) return;

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <header className="page-header">
      {title ? <h1 className="page-header-title">{title}</h1> : null}
      {showSettings ? (
        <div className="nav-settings" ref={menuRef}>
          <button
            type="button"
            className="settings-button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="Settings"
          >
            <SettingsIcon />
          </button>
          {open && (
            <div className="settings-dropdown" role="menu">
              {providerDiscoveryEnabled ? (
                <NavLink
                  to="/provider-discovery"
                  className="settings-dropdown-item"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  Provider Discovery
                </NavLink>
              ) : null}
              {courseScraperEnabled ? (
                <NavLink
                  to="/course-scraper"
                  className="settings-dropdown-item"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  Course Scraper
                </NavLink>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </header>
  );
}
