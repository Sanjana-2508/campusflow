import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clock3, Search, ShieldCheck, X } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "../components/navbar";
import { apiRequest } from "../services/api";
import "../styles/lost-found.css";

type ReviewItem = {
  id?: number;
  report_id: number;
  reviewType: "claim" | "found_report";
  item_name: string;
  category: string;
  description: string;
  location: string;
  event_date: string;
  imageUrl: string | null;
  created_at: string;
  owner_name: string;
  claimant_name?: string;
  claimant_notes?: string;
};

type ReviewHistory = {
  id: number;
  report_id: number;
  decision: "approved" | "rejected";
  notes: string;
  created_at: string;
  reviewer_name: string;
  item_name: string;
};

type ReviewData = { claims: ReviewItem[]; foundReports: ReviewItem[]; history: ReviewHistory[]; pendingCount: number };

export default function LostFoundAdmin() {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshReviews = () => {
    setLoading(true);
    setRefreshKey((value) => value + 1);
  };

  useEffect(() => {
    let active = true;
    apiRequest<ReviewData>("/admin/reviews").then((reviews) => {
      if (active) { setData(reviews); setError(""); }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Review queue could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  const claims = useMemo(() => (data?.claims ?? []).filter((item) => `${item.item_name} ${item.description} ${item.location} ${item.claimant_name} ${item.owner_name}`.toLowerCase().includes(query.toLowerCase())), [data, query]);
  const foundReports = useMemo(() => (data?.foundReports ?? []).filter((item) => `${item.item_name} ${item.description} ${item.location} ${item.owner_name}`.toLowerCase().includes(query.toLowerCase())), [data, query]);

  const review = async (item: ReviewItem, decision: "approved" | "rejected") => {
    const key = `${item.reviewType}-${item.id ?? item.report_id}`;
    const action = decision === "approved" ? "approve" : "reject";
    if (!window.confirm(`${action === "approve" ? "Approve" : "Reject"} ${item.reviewType === "claim" ? "this claim" : "this found-item report"}? This decision will be recorded.`)) return;
    setBusyKey(key);
    setError("");
    try {
      const path = item.reviewType === "claim" ? `/admin/claims/${item.id}/review` : `/admin/reports/${item.report_id}/review`;
      await apiRequest(path, { method: "POST", body: JSON.stringify({ decision, notes: notes[key] ?? "" }) });
      refreshReviews();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The review could not be saved.");
    } finally {
      setBusyKey("");
    }
  };

  const renderReview = (item: ReviewItem) => {
    const key = `${item.reviewType}-${item.id ?? item.report_id}`;
    return (
      <article className="lf-review-card" key={key}>
        {item.imageUrl ? <img src={item.imageUrl} alt={`Photo of ${item.item_name}`} /> : <div className="lf-review-image-empty"><ShieldCheck size={24} /></div>}
        <div className="lf-review-content">
          <div className="lf-review-topline"><span>{item.reviewType === "claim" ? "CLAIM REVIEW" : "FOUND REPORT"}</span><span><Clock3 size={13} />{new Date(item.created_at).toLocaleDateString()}</span></div>
          <h3>{item.item_name}</h3>
          <p className="lf-review-category">{item.category} · {item.location}</p>
          <p>{item.description}</p>
          <dl><div><dt>Report owner</dt><dd>{item.owner_name}</dd></div>{item.claimant_name && <div><dt>Claim submitted by</dt><dd>{item.claimant_name}</dd></div>}</dl>
          {item.claimant_notes && <blockquote>{item.claimant_notes}</blockquote>}
          <label className="lf-review-note">Verification notes <span>Optional, max 1,000 characters</span><textarea rows={3} maxLength={1000} value={notes[key] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))} placeholder="Record what was checked or why the decision was made." /></label>
          <div className="lf-review-actions"><button type="button" className="lf-secondary-button lf-reject-action" disabled={busyKey === key} onClick={() => void review(item, "rejected")}><X size={15} /> Reject</button><button type="button" className="lf-primary-button" disabled={busyKey === key} onClick={() => void review(item, "approved")}><Check size={15} /> {busyKey === key ? "Saving…" : "Approve"}</button></div>
        </div>
      </article>
    );
  };

  return (
    <div className="lost-found-page">
      <Navbar />
      <main className="lost-found-content lf-admin-content">
        <Link to="/lost-found" className="lf-back-link"><ArrowLeft size={15} /> Back to Lost &amp; Found</Link>
        <header className="lf-admin-header"><div><p className="lf-eyebrow"><span /> CAMPUS STAFF / VERIFICATION</p><h1>Review queue</h1><p>Verify found-item reports and student claims before an item is marked as found.</p></div><div className="lf-pending-count"><ShieldCheck size={20} /><strong>{data?.pendingCount ?? (loading ? "—" : 0)}</strong><span>pending reviews</span></div></header>
        <div className="lf-admin-toolbar"><label className="lf-search"><Search size={17} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reports, claims, or locations" aria-label="Search reviews" /></label></div>
        {error && <div className="lf-notice lf-notice-error" role="alert"><span>{error}</span>{error.includes("Administrator") || error.includes("Sign in") ? <Link to="/login">Sign in with staff account</Link> : <button type="button" onClick={refreshReviews}>Try again</button>}</div>}
        {loading ? <div className="lf-review-skeleton" aria-label="Loading verification queue"><span /><span /></div> : !error && data && data.pendingCount === 0 ? <div className="lf-state-panel"><div className="lf-state-icon"><Check size={23} /></div><h3>All caught up</h3><p>There are no reports or claims waiting for verification.</p></div> : !error && data ? <>
          {claims.length > 0 && <section className="lf-review-section"><div className="lf-listing-heading"><div><p className="lf-eyebrow">STUDENT CLAIMS</p><h2>Claims awaiting review</h2></div><span className="lf-result-count">{claims.length} pending</span></div><div className="lf-review-list">{claims.map(renderReview)}</div></section>}
          {foundReports.length > 0 && <section className="lf-review-section"><div className="lf-listing-heading"><div><p className="lf-eyebrow">FOUND ITEMS</p><h2>Reports awaiting verification</h2></div><span className="lf-result-count">{foundReports.length} pending</span></div><div className="lf-review-list">{foundReports.map(renderReview)}</div></section>}
          {claims.length === 0 && foundReports.length === 0 && <div className="lf-state-panel"><div className="lf-state-icon"><Search size={23} /></div><h3>No matching reviews</h3><p>Try a different search term.</p></div>}
          {data.history.length > 0 && <section className="lf-review-section lf-history"><div className="lf-listing-heading"><div><p className="lf-eyebrow">AUDIT TRAIL</p><h2>Recent decisions</h2></div></div><div className="lf-history-list">{data.history.map((entry) => <article key={entry.id}><span className={`lf-history-decision ${entry.decision}`}>{entry.decision}</span><div><strong>{entry.item_name}</strong><p>{entry.notes || "No verification note recorded."}</p><small>{entry.reviewer_name} · {new Date(entry.created_at).toLocaleString()}</small></div></article>)}</div></section>}
        </> : null}
      </main>
    </div>
  );
}