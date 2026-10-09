import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, BookOpenCheck, CalendarClock, CalendarDays, Check, Clock3, Map, PackageSearch, ShieldCheck, UsersRound, X } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/navbar";
import { apiRequest, dashboardPathForRole, type CampusRole, type CampusUser, type FacultyAvailability, type MeetingRequest } from "../services/api";
import "../styles/role-dashboard.css";

type RoleDashboardProps = { expectedRole: Exclude<CampusRole, "student"> };

const roleContent: Record<Exclude<CampusRole, "student">, {
  label: string;
  title: string;
  description: string;
  icon: typeof BookOpenCheck;
}> = {
  faculty: {
    label: "FACULTY WORKSPACE",
    title: "Your campus, in session.",
    description: "Your verified Faculty access is active. Continue with the campus services currently available in CampusFlow.",
    icon: BookOpenCheck,
  },
  club_organiser: {
    label: "CLUB ORGANISER WORKSPACE",
    title: "Bring campus together.",
    description: "Your verified Club Organiser access is active. Manage campus activity through the available events and community tools.",
    icon: UsersRound,
  },
  admin: {
    label: "ADMINISTRATOR WORKSPACE",
    title: "Campus operations.",
    description: "Review access requests and manage the administrative workflows currently enabled in CampusFlow.",
    icon: ShieldCheck,
  },
};

const sharedTools = [
  { title: "Campus map", description: "View campus buildings and locations.", href: "/map", icon: Map },
  { title: "Events", description: "Browse the campus events board.", href: "/events", icon: CalendarDays },
  { title: "Faculty directory", description: "Search profiles and request a meeting.", href: "/faculty-directory", icon: BookOpenCheck },
  { title: "Lost & Found", description: "Review reports and item claims.", href: "/lost-found", icon: PackageSearch },
];

function formatMeetingTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function FacultyWorkspace() {
  const [minimumMeetingTime] = useState(() => new Date(Date.now() + 60_000).toISOString().slice(0, 16));
  const [profile, setProfile] = useState<(FacultyAvailability & { department: string; subject: string; cabinRoom: string; building: string; floor: string; statusLabel: string }) | null>(null);
  const [requests, setRequests] = useState<MeetingRequest[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [busyRequest, setBusyRequest] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [suggestedTimes, setSuggestedTimes] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<{ profile: (FacultyAvailability & { department: string; subject: string; cabinRoom: string; building: string; floor: string; statusLabel: string }) | null }>("/faculty/me"),
      apiRequest<{ requests: MeetingRequest[] }>(`/faculty/meetings?status=${filter}`),
    ]).then(([facultyData, meetingData]) => {
      if (!active) return;
      setProfile(facultyData.profile);
      setRequests(meetingData.requests);
      setError("");
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Faculty workspace could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, refreshKey]);

  const pendingCount = useMemo(() => requests.filter((request) => request.status === "pending").length, [requests]);

  const updateAvailability = async (status: "in_cabin" | "not_in_cabin" | "busy") => {
    setSavingStatus(true);
    setMessage("");
    setError("");
    try {
      const result = await apiRequest<{ availability: FacultyAvailability }>("/faculty/me/availability", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setProfile((current) => current ? { ...current, ...result.availability, statusLabel: result.availability.label } : null);
      setMessage(`Availability updated: ${result.availability.label}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Availability could not be saved.");
    } finally {
      setSavingStatus(false);
    }
  };

  const respond = async (event: FormEvent<HTMLFormElement>, request: MeetingRequest, decision: "accepted" | "declined" | "completed") => {
    event.preventDefault();
    setBusyRequest(request.id);
    setMessage("");
    setError("");
    try {
      await apiRequest(`/faculty/meetings/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          response: responses[request.id] ?? "",
          suggestedAt: suggestedTimes[request.id] ? new Date(suggestedTimes[request.id]).toISOString() : null,
        }),
      });
      setMessage(`Meeting request ${decision}.`);
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Meeting response could not be saved.");
    } finally {
      setBusyRequest(null);
    }
  };

  return (
    <section className="faculty-workspace" aria-label="Faculty availability and student requests">
      <div className="faculty-availability-panel">
        <div className="faculty-workspace-heading"><div><p>YOUR FACULTY PROFILE</p><h2>Activity status</h2></div><span className={`faculty-role-status faculty-role-status-${profile?.meetingStatus === "busy" ? "busy" : profile?.locationStatus ?? "not_in_cabin"}`}>{profile?.statusLabel ?? "Profile incomplete"}</span></div>
        {loading ? <p className="faculty-panel-loading" role="status">Loading your saved status…</p> : profile ? <>
          <p className="faculty-room-summary">{profile.department}{profile.subject ? ` · ${profile.subject}` : ""} <span>{profile.building}, Room {profile.cabinRoom}{profile.floor ? ` · Floor ${profile.floor}` : ""}</span></p>
          <p className="faculty-status-updated">{profile.updatedAt ? `Last updated ${formatMeetingTime(profile.updatedAt)}` : "Your status has not been updated yet."}</p>
          <div className="faculty-availability-options" role="group" aria-label="Set your faculty availability">
            <button type="button" className={profile.locationStatus === "in_cabin" && profile.meetingStatus === "available" ? "selected" : ""} disabled={savingStatus} onClick={() => void updateAvailability("in_cabin")}><Check size={16} /><span><strong>Yes, I'm in my cabin</strong><small>Available for meeting requests</small></span></button>
            <button type="button" className={profile.locationStatus === "not_in_cabin" && profile.meetingStatus === "available" ? "selected" : ""} disabled={savingStatus} onClick={() => void updateAvailability("not_in_cabin")}><X size={16} /><span><strong>No, I'm not in my cabin</strong><small>Currently away from my cabin</small></span></button>
            <button type="button" className={profile.meetingStatus === "busy" ? "selected" : ""} disabled={savingStatus} onClick={() => void updateAvailability("busy")}><Clock3 size={16} /><span><strong>Busy / Unavailable</strong><small>Cabin location stays unchanged</small></span></button>
          </div>
        </> : <div className="faculty-profile-missing"><strong>Your profile is not set up yet.</strong><span>Ask a CampusFlow administrator to add your department and cabin location.</span></div>}
      </div>

      <div className="faculty-requests-panel">
        <div className="faculty-workspace-heading"><div><p>STUDENT MEETINGS</p><h2>Student requests</h2></div><span className="faculty-pending-count">{pendingCount} pending</span></div>
        <label className="faculty-request-filter"><span>Filter requests</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="declined">Declined</option><option value="completed">Completed</option><option value="all">All requests</option></select></label>
        {message && <p className="faculty-workspace-message" role="status">{message}</p>}
        {error && <p className="faculty-workspace-error" role="alert">{error}</p>}
        {loading ? <p className="faculty-panel-loading" role="status">Loading meeting requests…</p> : requests.length ? <div className="faculty-request-list">{requests.map((request) => <article className="faculty-request-card" key={request.id}>
          <div className="faculty-request-card-heading"><div><strong>{request.studentName}</strong><span>{request.purpose}</span></div><span className={`faculty-role-status faculty-role-status-${request.status}`}>{request.status}</span></div>
          <p className="faculty-request-message">{request.message}</p>
          <div className="faculty-request-time"><CalendarClock size={15} />{formatMeetingTime(request.preferredAt)}</div>
          {request.suggestedAt && <p className="faculty-request-suggested">Suggested time: {formatMeetingTime(request.suggestedAt)}</p>}
          {request.status === "pending" ? <form onSubmit={(event) => void respond(event, request, "accepted")}>
            <label>Response or alternate time<textarea rows={2} maxLength={2000} value={responses[request.id] ?? ""} onChange={(event) => setResponses((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Add a response or suggest another time." /></label>
            <label className="faculty-suggested-input">Suggest another time<input type="datetime-local" min={minimumMeetingTime} value={suggestedTimes[request.id] ?? ""} onChange={(event) => setSuggestedTimes((current) => ({ ...current, [request.id]: event.target.value }))} /></label>
            <div className="faculty-request-actions"><button type="button" disabled={busyRequest === request.id} className="faculty-request-decline" onClick={(event) => void respond(event as unknown as FormEvent<HTMLFormElement>, request, "declined")}>Decline</button><button type="submit" disabled={busyRequest === request.id} className="faculty-request-accept">{busyRequest === request.id ? "Saving…" : "Accept request"}</button></div>
          </form> : request.status === "accepted" ? <form onSubmit={(event) => void respond(event, request, "completed")}><label>Faculty response<textarea rows={2} maxLength={2000} value={responses[request.id] ?? request.facultyResponse} onChange={(event) => setResponses((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Add meeting notes or a response." /></label><button type="submit" className="faculty-request-accept" disabled={busyRequest === request.id}>{busyRequest === request.id ? "Saving…" : "Mark completed"}</button></form> : request.facultyResponse && <p className="faculty-request-response"><strong>Your response:</strong> {request.facultyResponse}</p>}
        </article>)}</div> : <div className="faculty-empty-requests"><CalendarClock size={21} /><strong>No {filter === "all" ? "meeting" : filter} requests</strong><span>Requests assigned to you will appear here.</span></div>}
      </div>
    </section>
  );
}

export default function RoleDashboard({ expectedRole }: RoleDashboardProps) {
  const [user, setUser] = useState<CampusUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const registrationNotice = (location.state as { registrationNotice?: string } | null)?.registrationNotice;
  const loginNotice = (location.state as { loginNotice?: string } | null)?.loginNotice;
  const [visibleRegistrationNotice] = useState(registrationNotice ?? loginNotice);
  const content = roleContent[expectedRole];
  const Icon = content.icon;

  useEffect(() => {
    let active = true;
    apiRequest<{ user: CampusUser }>("/auth/me")
      .then(({ user: currentUser }) => {
        if (active) setUser(currentUser);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Your account could not be verified.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || user.role !== expectedRole) return;
    if (registrationNotice) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [user, expectedRole, location.pathname, navigate, registrationNotice]);

  if (loading) {
    return <div className="role-dashboard-page"><Navbar /><main className="role-dashboard-content"><div className="role-loading" role="status">Checking your campus access…</div></main></div>;
  }
  if (error || !user) return <Navigate to="/login" replace state={{ message: error }} />;
  if (user.role !== expectedRole) return <Navigate to={dashboardPathForRole(user.role)} replace />;

  return (
    <div className="role-dashboard-page">
      <Navbar />
      <main className="role-dashboard-content">
        <header className="role-dashboard-hero">
          <div className="role-dashboard-mark"><Icon size={25} /></div>
          <p className="role-dashboard-kicker">{content.label}</p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
          {visibleRegistrationNotice && <div className="role-registration-notice" role="status"><ShieldCheck size={17} /><span>{visibleRegistrationNotice}</span></div>}
        </header>

        {expectedRole === "admin" && (
          <section className="role-admin-actions" aria-label="Administrative operations">
            <Link to="/admin/roles" className="role-admin-action"><ShieldCheck size={20} /><span><strong>Role requests</strong><small>Review Faculty and Club Organiser applications</small></span><ArrowUpRight size={17} /></Link>
            <Link to="/admin/lost-found" className="role-admin-action"><PackageSearch size={20} /><span><strong>Lost &amp; Found verification</strong><small>Review item claims and found-item reports</small></span><ArrowUpRight size={17} /></Link>
            <Link to="/admin/faculty" className="role-admin-action"><BookOpenCheck size={20} /><span><strong>Faculty profiles</strong><small>Publish verified cabin and department details</small></span><ArrowUpRight size={17} /></Link>
          </section>
        )}

        {expectedRole === "faculty" && <FacultyWorkspace />}

        <section className="role-tools-section">
          <div className="role-section-heading"><div><p>CAMPUSFLOW</p><h2>Available campus tools</h2></div><span>{sharedTools.length} tools</span></div>
          <div className="role-tools-grid">
            {sharedTools.map((tool) => {
              const ToolIcon = tool.icon;
              return <Link to={tool.href} className="role-tool" key={tool.href}><span className="role-tool-icon"><ToolIcon size={19} /></span><strong>{tool.title}</strong><small>{tool.description}</small><ArrowUpRight className="role-tool-arrow" size={16} /></Link>;
            })}
          </div>
        </section>
      </main>
    </div>
  );
}