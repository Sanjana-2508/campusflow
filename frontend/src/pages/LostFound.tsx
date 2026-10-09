import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock3,
  ImagePlus,
  MapPin,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "../components/navbar";
import { apiRequest, ApiError, type CampusUser, type LostFoundReport } from "../services/api";
import "../styles/lost-found.css";

type ReportKind = "lost" | "found";
type ViewFilter = "all" | ReportKind;
type StatusFilter = "all" | "lost" | "pending_verification" | "verified_found";
const categoryOptions = ["Electronics", "Bags", "ID Cards", "Books", "Clothing", "Accessories", "Other"];
const statusLabels: Record<LostFoundReport["status"], string> = {
  lost: "Lost",
  pending_verification: "Pending Verification",
  verified_found: "Verified Found",
  closed: "Closed",
};

function localDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(`${value}T00:00:00`));
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`lf-dialog${wide ? " lf-dialog-wide" : ""}`}
      aria-labelledby="lf-dialog-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className="lf-dialog-heading">
        <h2 id="lf-dialog-title">{title}</h2>
        <button type="button" className="lf-icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
      </div>
      {children}
    </dialog>
  );
}

function statusClass(status: LostFoundReport["status"]) {
  return `lf-status lf-status-${status.replaceAll("_", "-")}`;
}

function ReportEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial?: LostFoundReport;
  onCancel: () => void;
  onSave: (formData: FormData) => Promise<LostFoundReport>;
}) {
  const [kind, setKind] = useState<ReportKind>(initial?.kind ?? "lost");
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [eventDate, setEventDate] = useState(initial?.eventDate ?? localDate());
  const [image, setImage] = useState<File | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editing = Boolean(initial);

  const previewObjectUrl = useMemo(() => image ? URL.createObjectURL(image) : null, [image]);
  const previewUrl = image ? previewObjectUrl : removeExistingImage ? null : initial?.imageUrl ?? null;

  useEffect(() => () => {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  }, [previewObjectUrl]);

  const acceptFile = async (file?: File) => {
    if (!file) return;
    setError("");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Images must be 5 MB or smaller.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      setImage(file);
      setRemoveExistingImage(false);
    } catch {
      setError("That file could not be read as an image. Try another photo.");
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void acceptFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    void acceptFile(event.dataTransfer.files[0]);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setSubmitting(true);
    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("name", name.trim());
    formData.set("category", category);
    formData.set("description", description.trim());
    formData.set("location", location.trim());
    formData.set("eventDate", eventDate);
    if (image) formData.set("image", image);
    if (removeExistingImage) formData.set("removeImage", "true");
    try {
      await onSave(formData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The report could not be saved.");
      if (cause instanceof ApiError && cause.fields) setFieldErrors(cause.fields);
    } finally {
      setSubmitting(false);
    }
  };

  const clearImage = () => {
    setImage(null);
    setRemoveExistingImage(true);
  };
  
    const cancel = () => {
      const changed = kind !== (initial?.kind ?? "lost")
        || name !== (initial?.name ?? "")
        || category !== (initial?.category ?? "")
        || description !== (initial?.description ?? "")
        || location !== (initial?.location ?? "")
        || eventDate !== (initial?.eventDate ?? localDate())
        || Boolean(image)
        || removeExistingImage;
      if (changed && !window.confirm("Discard the changes to this report?")) return;
      onCancel();
    };

  return (
    <Modal title={editing ? "Edit your report" : "Report an item"} onClose={cancel} wide>
      <form className="lf-form" onSubmit={submit}>
        <fieldset className="lf-kind-picker">
          <legend>What are you reporting? <span aria-hidden="true">*</span></legend>
          <div className="lf-kind-options">
            {(["lost", "found"] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={`lf-kind-option lf-kind-${value}${kind === value ? " is-selected" : ""}`}
                aria-pressed={kind === value}
                  disabled={editing}
                onClick={() => setKind(value)}
              >
                {value === "lost" ? <Search size={18} /> : <PackageSearch size={18} />}
                <span><strong>{value === "lost" ? "I lost an item" : "I found an item"}</strong><small>{value === "lost" ? "Help someone return it" : "Campus staff will verify it"}</small></span>
                {kind === value && <Check size={17} />}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="lf-form-grid">
          <label className="lf-field">
            <span>Item name <b>*</b></span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="e.g. Navy blue backpack" required />
            {fieldErrors.name && <small className="lf-field-error">{fieldErrors.name}</small>}
          </label>
          <label className="lf-field">
            <span>Category <b>*</b></span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} required>
              <option value="" disabled>Select a category</option>
              {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            {fieldErrors.category && <small className="lf-field-error">{fieldErrors.category}</small>}
          </label>
          <label className="lf-field lf-field-wide">
            <span>Description <b>*</b></span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1500} rows={4} placeholder="Describe identifying details without sharing private information." required />
            <small className="lf-field-hint">{description.length}/1,500 characters. Do not include student IDs, addresses, or contact details.</small>
            {fieldErrors.description && <small className="lf-field-error">{fieldErrors.description}</small>}
          </label>
          <label className="lf-field">
            <span>Campus location <b>*</b></span>
            <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={160} placeholder="Building, room, or nearby landmark" required />
            {fieldErrors.location && <small className="lf-field-error">{fieldErrors.location}</small>}
          </label>
          <label className="lf-field">
            <span>{kind === "lost" ? "Date lost" : "Date found"} <b>*</b></span>
            <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required />
            {fieldErrors.eventDate && <small className="lf-field-error">{fieldErrors.eventDate}</small>}
          </label>
        </div>

        <div className="lf-upload-field">
          <span className="lf-upload-label">Item photo <small>Optional</small></span>
            <input ref={inputRef} className="lf-file-input" type="file" accept="image/*" onChange={onFileChange} />
          {previewUrl ? (
            <div className="lf-preview-wrap">
              <img src={previewUrl} alt="Preview of the item photo" className="lf-image-preview" />
              <div className="lf-preview-actions">
                <button type="button" className="lf-secondary-button" onClick={() => inputRef.current?.click()}><Upload size={15} /> Replace photo</button>
                <button type="button" className="lf-remove-button" onClick={clearImage}><Trash2 size={15} /> Remove</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="lf-dropzone"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
            >
              <span className="lf-upload-symbol"><ImagePlus size={21} /></span>
              <strong>Drop a photo here or browse</strong>
              <small>JPEG, PNG, or WebP up to 5 MB</small>
            </button>
          )}
        </div>

        {error && <p className="lf-inline-error" role="alert">{error}</p>}
        {submitting && <p className="lf-upload-progress" role="status"><span /> Saving report securely…</p>}
        <div className="lf-form-actions">
            <button type="button" className="lf-secondary-button" onClick={cancel} disabled={submitting}>Cancel</button>
          <button type="submit" className="lf-primary-button" disabled={submitting}>
            {submitting ? "Saving…" : editing ? "Save changes" : "Submit report"}<ArrowUpRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReportCard({ report, onOpen }: { report: LostFoundReport; onOpen: () => void }) {
  return (
    <article className="lf-report-card">
      <button type="button" className="lf-card-open" onClick={onOpen} aria-label={`View details for ${report.name}`}>
        <span className="lf-card-image">
          {report.imageUrl ? <img src={report.imageUrl} alt="" loading="lazy" /> : <PackageSearch size={30} aria-hidden="true" />}
          <span className={statusClass(report.status)}>{statusLabels[report.status]}</span>
        </span>
        <span className="lf-card-body">
          <span className="lf-card-category">{report.category}</span>
          <strong className="lf-card-title">{report.name}</strong>
          <span className="lf-card-description">{report.description}</span>
          <span className="lf-card-meta"><span><MapPin size={14} />{report.location}</span><span><Clock3 size={14} />{formatDate(report.eventDate)}</span></span>
        </span>
      </button>
      <div className="lf-card-bottom">
        <span className={`lf-kind-tag lf-kind-tag-${report.kind}`}>{report.kind === "lost" ? "Lost item" : "Found item"}</span>
        <button type="button" className="lf-card-details" onClick={onOpen}>Details <ArrowUpRight size={15} /></button>
      </div>
    </article>
  );
}

export default function LostFound() {
  const [user, setUser] = useState<CampusUser | null>(null);
  const [reports, setReports] = useState<LostFoundReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState<ViewFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<LostFoundReport | "new" | null>(null);
  const [selected, setSelected] = useState<LostFoundReport | null>(null);
  const [claimText, setClaimText] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");
  const [notice, setNotice] = useState("");

  const refreshReports = () => {
    setLoading(true);
    setRefreshKey((value) => value + 1);
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<{ user: CampusUser }>("/auth/me"),
      apiRequest<{ reports: LostFoundReport[] }>("/lost-found"),
    ]).then(([identity, listing]) => {
      if (!active) return;
      setUser(identity.user);
      setReports(listing.reports);
      setError("");
    }).catch((cause: unknown) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "Reports could not be loaded.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesView = view === "all" || report.kind === view;
      const matchesStatus = status === "all" || report.status === status;
      const matchesCategory = category === "all" || report.category === category;
      const matchesQuery = !query || `${report.name} ${report.description} ${report.location} ${report.category}`.toLowerCase().includes(query);
      return matchesView && matchesStatus && matchesCategory && matchesQuery;
    });
  }, [reports, view, status, category, search]);

  const lostCount = reports.filter((report) => report.kind === "lost" && report.status !== "closed").length;
  const foundCount = reports.filter((report) => report.kind === "found" && report.status !== "closed").length;

  const saveReport = async (formData: FormData) => {
    const editing = typeof editor === "object" && editor !== null;
    const path = editing ? `/lost-found/${editor.id}` : "/lost-found";
    const response = await apiRequest<{ report: LostFoundReport }>(path, {
      method: editing ? "PATCH" : "POST",
      body: formData,
    });
    setEditor(null);
    setSelected(null);
    setNotice(editing
      ? "Your changes have been saved."
      : response.report.kind === "found"
        ? "Your found-item report is pending campus staff verification."
        : "Your lost-item report is live and ready for the campus community.");
    refreshReports();
    return response.report;
  };

  const closeReport = async (report: LostFoundReport) => {
    if (!window.confirm(`Withdraw “${report.name}” from the active listings?`)) return;
    try {
      await apiRequest(`/lost-found/${report.id}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) });
      setSelected(null);
      setNotice("Your report has been withdrawn.");
      refreshReports();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "The report could not be withdrawn.");
    }
  };

  const submitClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setClaimBusy(true);
    setClaimMessage("");
    try {
      await apiRequest(`/lost-found/${selected.id}/claims`, {
        method: "POST",
        body: JSON.stringify({ notes: claimText }),
      });
      setClaimMessage("Your claim is pending campus staff verification. The report owner has been notified.");
      setClaimText("");
    } catch (cause) {
      setClaimMessage(cause instanceof Error ? cause.message : "Your claim could not be submitted.");
    } finally {
      setClaimBusy(false);
    }
  };

  return (
    <div className="lost-found-page">
      <Navbar />
      <main className="lost-found-content">
        <header className="lf-hero">
          <div className="lf-hero-copy">
            <Link to="/dashboard" className="lf-back-link"><ArrowLeft size={15} /> Campus overview</Link>
            <p className="lf-eyebrow"><span /> CAMPUS COMMUNITY / LOST &amp; FOUND</p>
            <h1>Lost something?<br /><span>Found something?</span></h1>
            <p>Small things find their way home when the campus looks out for one another. Share a report and let staff help verify the hand-off.</p>
            <div className="lf-hero-actions">
              <button type="button" className="lf-primary-button" onClick={() => setEditor("new")}><Plus size={17} /> Report an item</button>
              {user?.role === "admin" && <Link to="/admin/lost-found" className="lf-staff-link"><ShieldCheck size={16} /> Staff verification</Link>}
            </div>
          </div>
          <div className="lf-hero-aside" aria-label="CampusFlow safe hand-off process">
            <div className="lf-aside-icon"><ShieldCheck size={20} /></div>
            <strong>Safe hand-offs, by design.</strong>
            <p>Contact details stay private. Found reports and claims are verified by campus staff before they are marked as reunited.</p>
            <span><Check size={14} /> Staff-verified reports</span>
          </div>
        </header>

        <section className="lf-stats" aria-label="Active reports">
          <div><span>Active reports</span><strong>{loading ? "—" : reports.length}</strong><small>Across campus</small></div>
          <div><span>Lost items</span><strong>{loading ? "—" : lostCount}</strong><small>Seeking their owners</small></div>
          <div><span>Found items</span><strong>{loading ? "—" : foundCount}</strong><small>Staff verification included</small></div>
        </section>

        <section className="lf-listing" aria-label="Lost and found reports">
          <div className="lf-listing-heading">
            <div><p className="lf-eyebrow">THE COMMUNITY BOARD</p><h2>Recent reports</h2></div>
            {!loading && !error && <span className="lf-result-count">{filteredReports.length} {filteredReports.length === 1 ? "report" : "reports"}</span>}
          </div>

          <div className="lf-controls">
            <div className="lf-view-tabs" role="group" aria-label="Report type">
              {(["all", "lost", "found"] as const).map((value) => (
                <button type="button" key={value} className={view === value ? "is-active" : ""} aria-pressed={view === value} onClick={() => setView(value)}>
                  {value === "all" ? "All reports" : value === "lost" ? "Lost items" : "Found items"}
                  {value === "lost" && <span>{lostCount}</span>}{value === "found" && <span>{foundCount}</span>}
                </button>
              ))}
            </div>
            <label className="lf-search"><Search size={17} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item or description" aria-label="Search reports by item name or description" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={15} /></button>}</label>
            <label className="lf-select-filter"><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">All statuses</option><option value="lost">Lost</option><option value="pending_verification">Pending verification</option><option value="verified_found">Verified found</option></select></label>
            <label className="lf-select-filter"><span className="sr-only">Filter by category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categoryOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          </div>

          {notice && <div className="lf-notice" role="status"><Check size={16} /><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15} /></button></div>}
          {loading ? (
            <div className="lf-card-grid" aria-label="Loading reports">{[0, 1, 2, 3].map((item) => <div className="lf-skeleton" key={item}><span /><i /><i /><i /></div>)}</div>
          ) : error ? (
            <div className="lf-state-panel lf-error-panel"><div className="lf-state-icon"><ShieldCheck size={23} /></div><h3>{error === "Sign in to continue." || error.includes("session") ? "Sign in to view reports" : "Reports are unavailable"}</h3><p>{error === "Sign in to continue." || error.includes("session") ? "Campus reports are visible to signed-in members only. Your account and contact details stay private." : error}</p><div className="lf-state-actions"><Link className="lf-primary-button" to="/login">Sign in <ArrowUpRight size={16} /></Link><button className="lf-secondary-button" type="button" onClick={refreshReports}>Try again</button></div></div>
          ) : filteredReports.length ? (
            <div className="lf-card-grid">{filteredReports.map((report) => <ReportCard key={report.id} report={report} onOpen={() => { setSelected(report); setClaimMessage(""); }} />)}</div>
          ) : (
            <div className="lf-state-panel"><div className="lf-state-icon"><PackageSearch size={23} /></div><h3>{reports.length ? "No matching reports" : "A clear board, for now"}</h3><p>{reports.length ? "Try adjusting the search or filters." : "Be the first to help a campus item find its way home."}</p><div className="lf-state-actions">{reports.length > 0 && <button type="button" className="lf-secondary-button" onClick={() => { setSearch(""); setStatus("all"); setCategory("all"); setView("all"); }}>Clear filters</button>}<button type="button" className="lf-primary-button" onClick={() => setEditor("new")}><Plus size={16} /> Report an item</button></div></div>
          )}
        </section>
      </main>

      {editor && <ReportEditor key={typeof editor === "object" ? `edit-${editor.id}` : "new-report"} initial={typeof editor === "object" ? editor : undefined} onCancel={() => setEditor(null)} onSave={saveReport} />}

      {selected && (
        <Modal title="Report details" onClose={() => setSelected(null)} wide>
          <div className="lf-detail-layout">
            {selected.imageUrl ? <img className="lf-detail-image" src={selected.imageUrl} alt={`Photo of ${selected.name}`} /> : <div className="lf-detail-placeholder"><PackageSearch size={38} /></div>}
            <div className="lf-detail-copy">
              <span className={statusClass(selected.status)}>{statusLabels[selected.status]}</span>
              <span className="lf-card-category">{selected.category} · {selected.kind === "lost" ? "Lost item" : "Found item"}</span>
              <h3>{selected.name}</h3>
              <p>{selected.description}</p>
              <div className="lf-detail-meta"><span><MapPin size={15} />{selected.location}</span><span><Clock3 size={15} />{formatDate(selected.eventDate)}</span></div>
              <p className="lf-private-note"><ShieldCheck size={15} /> Student contact details are never shown publicly.</p>
            </div>
          </div>
          {selected.canEdit ? (
            <div className="lf-owner-actions">
              <button className="lf-secondary-button" type="button" onClick={() => { setEditor(selected); setSelected(null); }}><Pencil size={15} /> Edit report</button>
              <button className="lf-remove-button" type="button" onClick={() => void closeReport(selected)}><Trash2 size={15} /> Withdraw report</button>
            </div>
          ) : selected.kind === "lost" && selected.status === "lost" ? (
            <form className="lf-claim-form" onSubmit={submitClaim}>
              <label htmlFor="lf-claim-notes">Found this item or have useful information?</label>
              <textarea id="lf-claim-notes" rows={3} maxLength={1000} value={claimText} onChange={(event) => setClaimText(event.target.value)} placeholder="Tell campus staff what you found. Do not add personal contact details." required />
              <div className="lf-claim-submit"><small>Campus staff will verify your claim before this report changes status.</small><button type="submit" className="lf-primary-button" disabled={claimBusy || !claimText.trim()}>{claimBusy ? "Submitting…" : "Submit claim"}<ArrowUpRight size={16} /></button></div>
              {claimMessage && <p className="lf-claim-message" role="status">{claimMessage}</p>}
            </form>
          ) : null}
        </Modal>
      )}
    </div>
  );
}