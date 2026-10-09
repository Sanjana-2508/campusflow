import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clock3, Search, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "../components/navbar";
import { apiRequest } from "../services/api";
import "../styles/role-dashboard.css";

type RoleRequest = {
  id: number;
  requested_role: "faculty" | "club_organiser";
  status: "pending" | "approved" | "rejected";
  request_note: string;
  review_note: string;
  requested_at: string;
  reviewed_at: string | null;
  requester_name: string;
  requester_email: string;
  reviewer_name: string | null;
};

type RoleRequestResponse = { requests: RoleRequest[]; pendingCount: number };

export default function AdminRoleRequests() {
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => {
    setLoading(true);
    setRefreshKey((value) => value + 1);
  };

  useEffect(() => {
    let active = true;
    apiRequest<RoleRequestResponse>("/admin/role-requests")
      .then((response) => {
        if (!active) return;
        setRequests(response.requests);
        setPendingCount(response.pendingCount);
        setError("");
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Role requests could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  const filteredRequests = useMemo(() => requests.filter((item) =>
    `${item.requester_name} ${item.requester_email} ${item.requested_role} ${item.status}`
      .toLowerCase().includes(query.trim().toLowerCase())), [requests, query]);

  const review = async (item: RoleRequest, decision: "approved" | "rejected") => {
    const action = decision === "approved" ? "approve" : "reject";
    if (!window.confirm(`${action === "approve" ? "Approve" : "Reject"} ${item.requester_name}'s ${item.requested_role === "faculty" ? "Faculty" : "Club Organiser"} access request?`)) return;
    setBusyId(item.id);
    setError("");
    try {
      await apiRequest(`/admin/role-requests/${item.id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision, notes: reviewNotes[item.id] ?? "" }),
      });
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The role request could not be reviewed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="role-dashboard-page">
      <Navbar />
      <main className="role-dashboard-content admin-role-content">
        <Link to="/admin-dashboard" className="role-back-link"><ArrowLeft size={15} /> Admin workspace</Link>
        <header className="admin-role-header">
          <div><p className="role-dashboard-kicker">CAMPUS ACCESS / REVIEW</p><h1>Role requests</h1><p>Faculty and Club Organiser requests stay Student-only until you approve them.</p></div>
          <div className="admin-role-count"><ShieldCheck size={19} /><strong>{loading ? "—" : pendingCount}</strong><span>pending</span></div>
        </header>
        <div className="admin-role-toolbar"><label><Search size={16} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people or requested role" aria-label="Search role requests" /></label></div>
        {error && <div className="admin-role-error" role="alert"><span>{error}</span>{error.includes("Administrator") || error.includes("Sign in") ? <Link to="/login">Sign in with an administrator account</Link> : <button type="button" onClick={refresh}>Try again</button>}</div>}
        {loading ? <div className="admin-role-empty" role="status">Loading role requests…</div> : !error && filteredRequests.length === 0 ? <div className="admin-role-empty"><ShieldCheck size={25} /><strong>{requests.length ? "No matching requests" : "No role requests yet"}</strong><span>{requests.length ? "Try a different search." : "New Faculty and Club Organiser applications will appear here."}</span></div> : !error ? (
          <section className="admin-role-list" aria-label="Role access applications">
            {filteredRequests.map((item) => <article className="admin-role-card" key={item.id}>
              <div className="admin-role-card-top"><span className={`admin-role-status ${item.status}`}>{item.status === "pending" ? "Pending review" : item.status}</span><span><Clock3 size={13} />{new Date(`${item.requested_at.replace(" ", "T")}Z`).toLocaleDateString()}</span></div>
              <h2>{item.requested_role === "faculty" ? "Faculty access" : "Club Organiser access"}</h2>
              <p className="admin-role-person">{item.requester_name}<span>{item.requester_email}</span></p>
              {item.status === "pending" ? <>
                <label className="admin-role-notes">Review notes <small>Optional, max 1,000 characters</small><textarea rows={3} maxLength={1000} value={reviewNotes[item.id] ?? ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Record approval context or next steps." /></label>
                <div className="admin-role-actions"><button type="button" className="admin-role-reject" disabled={busyId === item.id} onClick={() => void review(item, "rejected")}><X size={15} /> Reject</button><button type="button" className="admin-role-approve" disabled={busyId === item.id} onClick={() => void review(item, "approved")}><Check size={15} /> {busyId === item.id ? "Saving…" : "Approve access"}</button></div>
              </> : <div className="admin-role-history"><span>Reviewed by {item.reviewer_name ?? "administrator"}{item.reviewed_at ? ` · ${new Date(`${item.reviewed_at.replace(" ", "T")}Z`).toLocaleString()}` : ""}</span><p>{item.review_note || "No review note recorded."}</p></div>}
            </article>)}
          </section>
        ) : null}
      </main>
    </div>
  );
}