import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  LogOut,
  Menu,
  Search,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiRequest, dashboardPathForRole, type CampusUser, type FacultyProfile } from "../services/api";
import "../styles/navbar.css";

const navigation = [
  { label: "Overview", path: "/dashboard" },
  { label: "Campus", path: "/map" },
  { label: "Parking", path: "/parking" },
  { label: "Facilities", path: "/facilities" },
  { label: "Events", path: "/events" },
  { label: "Lost & Found", path: "/lost-found" },
  { label: "Faculty", path: "/faculty-directory" },
];

const searchablePages = [
  { title: "Campus Map", description: "Buildings, campus locations and routes", path: "/map", keywords: "map buildings directions campus locations" },
  { title: "Smart Parking", description: "Parking zones and availability", path: "/parking", keywords: "parking zones spaces availability car" },
  { title: "Facilities", description: "Campus rooms, services and amenities", path: "/facilities", keywords: "facilities rooms services amenities faculty offices" },
  { title: "Events", description: "Campus events and activities", path: "/events", keywords: "events activities calendar clubs" },
  { title: "Lost & Found", description: "Lost items, found reports and claims", path: "/lost-found", keywords: "lost found items claims belongings" },
  { title: "Notifications", description: "Campus updates and account notices", path: "/notifications", keywords: "notifications updates announcements" },
  { title: "Faculty Directory", description: "Faculty profiles, cabin location and meeting requests", path: "/faculty-directory", keywords: "faculty directory professor department cabin availability meeting" },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<CampusUser | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [liveFaculty, setLiveFaculty] = useState<FacultyProfile[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!searchOpen || query.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      apiRequest<{ faculty: FacultyProfile[] }>(`/faculty?q=${encodeURIComponent(query)}`)
        .then(({ faculty: matches }) => { if (active) setLiveFaculty(matches.slice(0, 5)); })
        .catch(() => { if (active) setLiveFaculty([]); });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [searchOpen, searchQuery]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matchingPages = searchablePages.filter((page) =>
      !query || `${page.title} ${page.description} ${page.keywords}`.toLowerCase().includes(query),
    );
    const facultyResults = query.length >= 2 ? liveFaculty.map((person) => ({
      title: person.name,
      description: `${person.department}${person.subject ? ` · ${person.subject}` : ""} · ${person.building}, Room ${person.cabinRoom}`,
      path: `/faculty-directory?search=${encodeURIComponent(person.name)}`,
      keywords: "faculty",
    })) : [];
    return query ? [...facultyResults, ...matchingPages] : matchingPages.slice(0, 4);
  }, [searchQuery, liveFaculty]);

  useEffect(() => {
    apiRequest<{ user: CampusUser }>("/auth/me")
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => setUser(null));
  }, [location.pathname]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  const goToSearchResult = (path: string) => {
    closeSearch();
    navigate(path);
  };

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searchResults[0]) goToSearchResult(searchResults[0].path);
  };

  const signOut = async () => {
    setLogoutConfirmOpen(false);
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch {
      // Navigate out even if the session has already expired.
    } finally {
      setUser(null);
      navigate("/login");
    }
  };

  return (
    <>
      <header className="navbar">
        <Link to={user ? dashboardPathForRole(user.role) : "/dashboard"} className="navbar-brand">
          CAMPUS<span>FLOW</span>
        </Link>

        <nav className="desktop-nav">
          {navigation.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={
                location.pathname === item.path
                  ? "nav-link active"
                  : "nav-link"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="navbar-actions">
          <button className="icon-button" aria-label="Search" aria-haspopup="dialog" aria-expanded={searchOpen} onClick={() => setSearchOpen(true)}>
            <Search size={18} />
          </button>

          <Link
            to="/notifications"
            className="icon-button notification-button"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span />
          </Link>

          <div className="profile">
            <div className="profile-avatar">{user?.name.slice(0, 1).toUpperCase() ?? "?"}</div>

            <div className="profile-info">
              <strong>{user?.name ?? "Campus guest"}</strong>
              <small>{user?.role === "admin" ? "Admin" : user?.role === "club_organiser" ? "Club Organiser" : user?.role === "faculty" ? "Faculty" : user ? "Student" : "Sign in required"}</small>
            </div>
          </div>

          {user ? (
            <button className="navbar-signout" type="button" onClick={() => setLogoutConfirmOpen(true)} aria-label="Sign out" title="Sign out">
              <LogOut size={16} />
            </button>
          ) : (
            <Link className="navbar-signin" to="/login">Sign in</Link>
          )}

          <button
            className="mobile-menu-button"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="mobile-nav">
          {navigation.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}

      {logoutConfirmOpen && (
        <div className="navbar-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLogoutConfirmOpen(false); }}>
          <section
            className="navbar-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="navbar-logout-title"
            aria-describedby="navbar-logout-description"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setLogoutConfirmOpen(false);
              } else if (event.key === "Tab") {
                event.preventDefault();
                const cancelButton = event.currentTarget.querySelector<HTMLButtonElement>(".navbar-confirm-cancel");
                const logoutButton = event.currentTarget.querySelector<HTMLButtonElement>(".navbar-confirm-yes");
                (document.activeElement === cancelButton ? logoutButton : cancelButton)?.focus();
              }
            }}
          >
            <h2 id="navbar-logout-title">Log out of CampusFlow?</h2>
            <p id="navbar-logout-description">Your server session will be ended and you will return to Login.</p>
            <div><button type="button" autoFocus className="navbar-confirm-cancel" onClick={() => setLogoutConfirmOpen(false)}>Cancel</button><button type="button" className="navbar-confirm-yes" onClick={() => void signOut()}>Yes, Log Out</button></div>
          </section>
        </div>
      )}

      {searchOpen && (
        <div
          className="navbar-search-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSearch();
          }}
        >
          <section
            className="navbar-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="navbar-search-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeSearch();
                return;
              }
              if (event.key !== "Tab") return;
              const focusable = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)");
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
          >
            <div className="navbar-search-heading">
              <div>
                <span>CAMPUSFLOW / QUICK SEARCH</span>
                <h2 id="navbar-search-title">Where to?</h2>
              </div>
              <button className="navbar-search-close" type="button" aria-label="Close search" onClick={closeSearch}>
                <X size={18} />
              </button>
            </div>

            <form className="navbar-search-form" onSubmit={submitSearch}>
              <Search size={18} aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (searchResults[0]) goToSearchResult(searchResults[0].path);
                  }
                }}
                placeholder="Search campus services..."
                aria-label="Search CampusFlow pages and services"
                aria-controls="navbar-search-results"
              />
              {searchQuery && (
                <button type="button" aria-label="Clear search" onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}>
                  <X size={15} />
                </button>
              )}
              <button className="navbar-search-submit" type="submit" disabled={searchResults.length === 0} aria-label="Open first search result">
                <span>Go</span><span aria-hidden="true">↵</span>
              </button>
            </form>

            <div className="navbar-search-results" id="navbar-search-results" aria-live="polite">
              <p>{searchQuery ? "MATCHING CAMPUS DESTINATIONS" : "QUICK LINKS"}</p>
              {searchResults.length ? (
                <ul>
                  {searchResults.map((result) => (
                    <li key={result.path}>
                      <button type="button" onClick={() => goToSearchResult(result.path)}>
                        <span><strong>{result.title}</strong><small>{result.description}</small></span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="navbar-search-empty">
                  <strong>No results found</strong>
                  <span>Try a campus service, event, parking, or facility name.</span>
                </div>
              )}
            </div>
            <p className="navbar-search-hint"><kbd>ESC</kbd> to close <span><kbd>ENTER</kbd> to open the first match</span></p>
          </section>
        </div>
      )}
    </>
  );
}