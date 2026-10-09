import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Search, UserRoundCog } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "../components/navbar";
import { apiRequest } from "../services/api";
import "../styles/role-dashboard.css";

type AdminFacultyRecord = {
  id: number;
  name: string;
  email: string;
  department: string | null;
  subject: string | null;
  cabin_room: string | null;
  building: string | null;
  floor: string | null;
  profile_updated_at: string | null;
  location_status: "in_cabin" | "not_in_cabin";
  meeting_status: "available" | "busy";
};

export default function AdminFacultyProfiles() {
  const [faculty, setFaculty] = useState<AdminFacultyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    apiRequest<{ faculty: AdminFacultyRecord[] }>("/admin/faculty")
      .then(({ faculty: records }) => { setFaculty(records); setError(""); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Faculty profiles could not be loaded."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    apiRequest<{ faculty: AdminFacultyRecord[] }>("/admin/faculty")
      .then(({ faculty: records }) => { if (active) { setFaculty(records); setError(""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Faculty profiles could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const change = (id: number, field: "department" | "subject" | "cabin_room" | "building" | "floor", value: string) => {
    setFaculty((current) => current.map((record) => record.id === id ? { ...record, [field]: value } : record));
  };

  const save = async (event: FormEvent<HTMLFormElement>, record: AdminFacultyRecord) => {
    event.preventDefault();
    setSavingId(record.id);
    setSavedId(null);
    setError("");
    try {
      await apiRequest(`/admin/faculty/${record.id}`, {
        method: "PUT",
        body: JSON.stringify({
          department: record.department,
          subject: record.subject ?? "",
          cabinRoom: record.cabin_room,
          building: record.building,
          floor: record.floor ?? "",
        }),
      });
      setSavedId(record.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Faculty profile could not be saved.");
    } finally {
      setSavingId(null);
    }
  };

  const filtered = faculty.filter((record) => `${record.name} ${record.email} ${record.department ?? ""} ${record.building ?? ""}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="role-dashboard-page">
      <Navbar />
      <main className="role-dashboard-content admin-role-content">
        <Link to="/admin-dashboard" className="role-back-link"><ArrowLeft size={15} /> Admin workspace</Link>
        <header className="admin-role-header">
          <div><p className="role-dashboard-kicker">CAMPUS DATA / FACULTY</p><h1>Faculty profiles</h1><p>Publish verified department and cabin information for the student directory. Availability is managed by each faculty member.</p></div>
          <div className="admin-role-count"><UserRoundCog size={19} /><strong>{loading ? "—" : faculty.length}</strong><span>approved faculty</span></div>
        </header>
        <div className="admin-role-toolbar"><label><Search size={16} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search faculty or department" aria-label="Search faculty profiles" /></label></div>
        {error && <div className="admin-role-error" role="alert"><span>{error}</span>{error.includes("Administrator") || error.includes("Sign in") ? <Link to="/login">Sign in with an administrator account</Link> : <button type="button" onClick={load}>Try again</button>}</div>}
        {loading ? <div className="admin-role-empty" role="status">Loading approved Faculty accounts…</div> : !error && filtered.length === 0 ? <div className="admin-role-empty"><UserRoundCog size={25} /><strong>{faculty.length ? "No matching Faculty accounts" : "No approved Faculty accounts"}</strong><span>{faculty.length ? "Try another search." : "Approve a Faculty role request first; the account will then appear here."}</span></div> : !error ? <section className="admin-faculty-list" aria-label="Approved Faculty profiles">{filtered.map((record) => <article className="admin-faculty-card" key={record.id}>
          <div className="admin-faculty-heading"><div><strong>{record.name}</strong><span>{record.email}</span></div><span className={`admin-role-status ${record.profile_updated_at ? "approved" : "pending"}`}>{record.profile_updated_at ? "Profile published" : "Needs profile"}</span></div>
          <form onSubmit={(event) => void save(event, record)}>
            <label>Department<input value={record.department ?? ""} maxLength={120} onChange={(event) => change(record.id, "department", event.target.value)} placeholder="e.g. Computer Science" required /></label>
            <label>Subject<input value={record.subject ?? ""} maxLength={120} onChange={(event) => change(record.id, "subject", event.target.value)} placeholder="Optional subject" /></label>
            <label>Cabin / room<input value={record.cabin_room ?? ""} maxLength={100} onChange={(event) => change(record.id, "cabin_room", event.target.value)} placeholder="e.g. B-214" required /></label>
            <label>Building<input value={record.building ?? ""} maxLength={120} onChange={(event) => change(record.id, "building", event.target.value)} placeholder="Campus building" required /></label>
            <label>Floor<input value={record.floor ?? ""} maxLength={60} onChange={(event) => change(record.id, "floor", event.target.value)} placeholder="Optional floor" /></label>
            <div className="admin-faculty-save"><span role="status">{savedId === record.id ? <><Check size={14} /> Profile saved</> : record.profile_updated_at ? `Updated ${new Date(`${record.profile_updated_at.replace(" ", "T")}Z`).toLocaleDateString()}` : "Not published"}</span><button type="submit" disabled={savingId === record.id}>{savingId === record.id ? "Saving…" : "Save profile"}</button></div>
          </form>
        </article>)}</section> : null}
      </main>
    </div>
  );
}