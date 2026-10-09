import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, BookOpenCheck, Building2, CalendarClock, Check, Clock3, MapPin, Search, UsersRound, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/navbar";
import { apiRequest, type CampusUser, type FacultyProfile, type MeetingRequest } from "../services/api";
import "../styles/faculty-directory.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(profile: FacultyProfile) {
  if (profile.meetingStatus === "busy") return profile.locationStatus === "in_cabin" ? "In Cabin · Busy for meetings" : "Busy / Unavailable";
  return profile.locationStatus === "in_cabin" ? "In Cabin" : "Not in Cabin";
}

export default function FacultyDirectory() {
  const [searchParams] = useSearchParams();
  const [minimumMeetingTime] = useState(() => new Date(Date.now() + 60_000).toISOString().slice(0, 16));
  const [faculty, setFaculty] = useState<FacultyProfile[]>([]);
  const [requests, setRequests] = useState<MeetingRequest[]>([]);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(() => searchParams.get("search") ?? "");
  const [department, setDepartment] = useState("all");
  const [building, setBuilding] = useState("all");
  const [floor, setFloor] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [selected, setSelected] = useState<FacultyProfile | null>(null);
  const [meetingFaculty, setMeetingFaculty] = useState<FacultyProfile | null>(null);
  const [purpose, setPurpose] = useState("");
  const [message, setMessage] = useState("");
  const [preferredAt, setPreferredAt] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<{ faculty: FacultyProfile[] }>("/faculty"),
      apiRequest<{ requests: MeetingRequest[] }>("/meetings/mine"),
      apiRequest<{ user: CampusUser }>("/auth/me"),
    ]).then(([directory, personal, identity]) => {
      if (!active) return;
      setFaculty(directory.faculty);
      setRequests(personal.requests);
      setStudentName(identity.user.name);
      setError("");
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "The faculty directory could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  const departments = useMemo(() => [...new Set(faculty.map((person) => person.department))].sort(), [faculty]);
  const buildings = useMemo(() => [...new Set(faculty.map((person) => person.building))].sort(), [faculty]);
  const floors = useMemo(() => [...new Set(faculty.map((person) => person.floor).filter(Boolean))].sort(), [faculty]);

  const filteredFaculty = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return faculty.filter((person) => {
      const matchesText = !normalized || `${person.name} ${person.department} ${person.subject} ${person.building} ${person.cabinRoom} ${person.floor}`.toLowerCase().includes(normalized);
      const matchesDepartment = department === "all" || person.department === department;
      const matchesBuilding = building === "all" || person.building === building;
      const matchesFloor = floor === "all" || person.floor === floor;
      const matchesAvailability = availability === "all"
        || (availability === "busy" ? person.meetingStatus === "busy"
          : availability === "in_cabin" ? person.locationStatus === "in_cabin"
            : person.locationStatus === "not_in_cabin");
      return matchesText && matchesDepartment && matchesBuilding && matchesFloor && matchesAvailability;
    });
  }, [faculty, query, department, building, floor, availability]);

  const submitMeeting = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!meetingFaculty) return;
    setSubmitBusy(true);
    setNotice("");
    try {
      const response = await apiRequest<{ request: MeetingRequest }>("/meetings", {
        method: "POST",
        body: JSON.stringify({
          facultyId: meetingFaculty.id,
          purpose,
          message,
          preferredAt: new Date(preferredAt).toISOString(),
        }),
      });
      setRequests((current) => [response.request, ...current]);
      setNotice(`Meeting request sent to ${meetingFaculty.name}. You can follow its status under My Requests.`);
      setMeetingFaculty(null);
      setPurpose("");
      setMessage("");
      setPreferredAt("");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Your request could not be sent.");
    } finally {
      setSubmitBusy(false);
    }
  };

  const cancelRequest = async (request: MeetingRequest) => {
    if (!window.confirm("Cancel this pending meeting request?")) return;
    try {
      await apiRequest(`/meetings/${request.id}/cancel`, { method: "POST" });
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status: "cancelled" } : item));
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The request could not be cancelled.");
    }
  };

  const clearFilters = () => {
    setQuery(""); setDepartment("all"); setBuilding("all"); setFloor("all"); setAvailability("all");
  };

  return (
    <div className="faculty-directory-page">
      <Navbar />
      <main className="faculty-directory-content">
        <Link to="/dashboard" className="faculty-back"><ArrowLeft size={15} /> Student dashboard</Link>
        <header className="faculty-directory-header">
          <div><p className="faculty-kicker"><span /> CAMPUS COMMUNITY / PEOPLE</p><h1>Faculty directory</h1><p>Find a faculty member, check their latest campus status, and request a meeting.</p></div>
          <div className="faculty-directory-summary"><UsersRound size={20} /><strong>{loading ? "—" : faculty.length}</strong><span>listed profiles</span></div>
        </header>

        {notice && <div className="faculty-notice" role="status"><Check size={16} /><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice("")}><X size={15} /></button></div>}

        <section className="faculty-controls" aria-label="Search and filter faculty">
          <label className="faculty-search"><Search size={17} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, subject or room" aria-label="Search faculty" />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button>}</label>
          <label><span>Department</span><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="all">All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Building</span><select value={building} onChange={(event) => setBuilding(event.target.value)}><option value="all">All buildings</option>{buildings.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Floor</span><select value={floor} onChange={(event) => setFloor(event.target.value)}><option value="all">All floors</option>{floors.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>Availability</span><select value={availability} onChange={(event) => setAvailability(event.target.value)}><option value="all">Any status</option><option value="in_cabin">In Cabin</option><option value="not_in_cabin">Not in Cabin</option><option value="busy">Busy / Unavailable</option></select></label>
        </section>

        <div className="faculty-results-heading"><div><p>PEOPLE &amp; AVAILABILITY</p><h2>Faculty members</h2></div><span>{loading ? "Loading…" : `${filteredFaculty.length} ${filteredFaculty.length === 1 ? "profile" : "profiles"}`}</span></div>

        {loading ? <div className="faculty-profile-grid" aria-label="Loading faculty profiles">{[0, 1, 2].map((index) => <div className="faculty-skeleton" key={index}><span /><i /><i /><i /></div>)}</div>
          : error ? <div className="faculty-empty faculty-error"><BookOpenCheck size={25} /><strong>Directory unavailable</strong><span>{error}</span><button type="button" onClick={() => { setLoading(true); setRefreshKey((value) => value + 1); }}>Try again</button></div>
            : filteredFaculty.length ? <div className="faculty-profile-grid">{filteredFaculty.map((person) => <article className="faculty-profile-card" key={person.id}>
              <div className="faculty-card-top"><span className="faculty-avatar"><BookOpenCheck size={22} /></span><span className={`faculty-status faculty-status-${person.meetingStatus === "busy" ? "busy" : person.locationStatus}`}>{statusLabel(person)}</span></div>
              <p className="faculty-department">{person.department}{person.subject ? ` · ${person.subject}` : ""}</p>
              <h3>{person.name}</h3>
              <div className="faculty-card-location"><span><MapPin size={14} />{person.building}, Room {person.cabinRoom}</span><span><Building2 size={14} />{person.floor ? `${person.floor} floor` : "Floor not listed"}</span></div>
              <div className="faculty-card-updated"><Clock3 size={13} />{person.updatedAt ? `Updated ${formatDate(person.updatedAt)}` : "Availability has not been updated"}</div>
              <div className="faculty-card-actions"><button type="button" className="faculty-secondary-button" onClick={() => setSelected(person)}>Profile details</button><button type="button" className="faculty-primary-button" onClick={() => setMeetingFaculty(person)}>Request to Meet <ArrowUpRight size={15} /></button></div>
            </article>)}</div>
              : <div className="faculty-empty"><Search size={24} /><strong>{faculty.length ? "No matching faculty" : "No faculty profiles yet"}</strong><span>{faculty.length ? "Try adjusting the search or filters." : "Campus staff have not published any faculty profiles yet."}</span>{faculty.length > 0 && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>}

        <section className="meeting-requests-section">
          <div className="faculty-results-heading"><div><p>YOUR CAMPUS CALENDAR</p><h2>My meeting requests</h2></div><span>{requests.filter((request) => request.status === "pending").length} pending</span></div>
          {requests.length ? <div className="my-meeting-list">{requests.map((request) => <article className="my-meeting-card" key={request.id}>
            <div className="meeting-card-main"><span className={`meeting-status meeting-status-${request.status}`}>{request.status}</span><strong>{request.facultyName}</strong><span>{request.facultyDepartment || "Faculty"}</span></div>
            <div className="meeting-card-detail"><CalendarClock size={15} /><span>{formatDate(request.preferredAt)}</span></div>
            <div className="meeting-card-detail"><BookOpenCheck size={15} /><span>{request.purpose}</span></div>
            {request.facultyResponse && <p className="meeting-response"><strong>Faculty response:</strong> {request.facultyResponse}{request.suggestedAt && ` Suggested time: ${formatDate(request.suggestedAt)}`}</p>}
            {request.status === "pending" && <button type="button" className="faculty-cancel-button" onClick={() => void cancelRequest(request)}>Cancel pending request</button>}
          </article>)}</div> : <div className="faculty-empty faculty-empty-compact"><CalendarClock size={22} /><strong>No meeting requests yet</strong><span>Requests you send to faculty will appear here.</span></div>}
        </section>
      </main>

      {selected && <div className="faculty-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="faculty-modal" role="dialog" aria-modal="true" aria-labelledby="faculty-modal-title"><div className="faculty-modal-heading"><h2 id="faculty-modal-title">Faculty profile</h2><button type="button" aria-label="Close profile" onClick={() => setSelected(null)}><X size={18} /></button></div><div className="faculty-modal-body"><span className="faculty-avatar faculty-avatar-large"><BookOpenCheck size={25} /></span><span className={`faculty-status faculty-status-${selected.meetingStatus === "busy" ? "busy" : selected.locationStatus}`}>{statusLabel(selected)}</span><h3>{selected.name}</h3><p>{selected.department}{selected.subject ? ` · ${selected.subject}` : ""}</p><div><MapPin size={15} />{selected.building}, Room {selected.cabinRoom}, {selected.floor || "Floor not listed"}</div><small>{selected.updatedAt ? `Status updated ${formatDate(selected.updatedAt)}` : "No recent status update"}</small></div><div className="faculty-modal-actions"><button type="button" className="faculty-primary-button" onClick={() => { setMeetingFaculty(selected); setSelected(null); }}>Request to Meet <ArrowUpRight size={15} /></button></div></section></div>}

      {meetingFaculty && <div className="faculty-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitBusy) setMeetingFaculty(null); }}><section className="faculty-modal faculty-meeting-modal" role="dialog" aria-modal="true" aria-labelledby="meeting-modal-title"><div className="faculty-modal-heading"><div><p>REQUEST A MEETING</p><h2 id="meeting-modal-title">With {meetingFaculty.name}</h2></div><button type="button" aria-label="Close meeting request" disabled={submitBusy} onClick={() => setMeetingFaculty(null)}><X size={18} /></button></div><form onSubmit={submitMeeting}><label>Faculty member<input value={`${meetingFaculty.name} · ${meetingFaculty.department}`} readOnly /></label><label>Student<input value={studentName || "Signed-in Student"} readOnly /></label><label>Purpose<select value={purpose} onChange={(event) => setPurpose(event.target.value)} required><option value="">Choose a purpose</option><option>Academic advising</option><option>Project advising</option><option>Course question</option><option>Research discussion</option><option>Other</option></select></label><label>Message<textarea rows={4} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Briefly explain what you would like to discuss." required /></label><label>Preferred date and time<input type="datetime-local" min={minimumMeetingTime} value={preferredAt} onChange={(event) => setPreferredAt(event.target.value)} required /></label><div className="faculty-form-actions"><button type="button" className="faculty-secondary-button" disabled={submitBusy} onClick={() => setMeetingFaculty(null)}>Cancel</button><button type="submit" className="faculty-primary-button" disabled={submitBusy}>{submitBusy ? "Sending…" : "Send request"}<ArrowUpRight size={15} /></button></div></form></section></div>}
    </div>
  );
}