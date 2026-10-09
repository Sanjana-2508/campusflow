
import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { BookOpenCheck, Check, GraduationCap, ShieldCheck, UsersRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest, dashboardPathForRole, type CampusUser } from "../services/api";
import "../styles/auth.css";

type RequestedRole = "student" | "faculty" | "club_organiser";

export default function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<RequestedRole>("student");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRoleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = (index + (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : 2)) % 3;
    const roles: RequestedRole[] = ["student", "faculty", "club_organiser"];
    setRequestedRole(roles[nextIndex]);
    const options = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='radio']");
    options?.[nextIndex]?.focus();
  };

  const passwordChecks = [
    password.length >= 12,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];

  const strength = passwordChecks.filter(Boolean).length;

  const strengthLabel = !password
    ? "Waiting for your password"
    : strength <= 1
      ? "Just getting started"
      : strength === 2
        ? "Getting stronger"
        : strength === 3
          ? "Looking good"
          : "Strong password";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiRequest<{
        user: CampusUser;
        roleRequest: { requestedRole: RequestedRole; status: "pending" } | null;
      }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, requestedRole }),
      });
      const registrationNotice = result.roleRequest
        ? `Your Student account is ready. Your ${requestedRole === "club_organiser" ? "Club Organiser" : "Faculty"} access request is pending administrator approval.`
        : "Your Student account is ready. Welcome to CampusFlow.";
      navigate(dashboardPathForRole(result.user.role), { state: { registrationNotice } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page register-page">
      <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
      <div className="auth-glow" aria-hidden="true" />

      <Link to="/login" className="auth-brand">
        <span className="brand-symbol">C</span>
        CAMPUS<span>FLOW</span>
      </Link>

      <div className="auth-layout register-layout">
        <section className="auth-intro register-intro">
          <p className="auth-kicker">
            <span className="status-dot" />
            YOUR NEXT CHAPTER STARTS HERE
          </p>

          <h1>
            Find your
            <br />
            <span>place in</span>
            <br />
            the orbit<span className="lime-period">.</span>
          </h1>

          <p className="auth-description">
            Campus is more than classrooms. Connect with
            your community and make the most of every day.
          </p>

          <div className="signup-universe" aria-label="CampusFlow orbit illustration">
            <div className="universe-ring universe-ring-one" />
            <div className="universe-ring universe-ring-two" />
            <div className="universe-ring universe-ring-three" />

            <div className="universe-core">
              <span>CF</span>
            </div>

            <div className="universe-planet planet-one">✳</div>
            <div className="universe-planet planet-two">⌘</div>
            <div className="universe-planet planet-three">↗</div>

            <span className="universe-label universe-label-one">
              CONNECT
            </span>
            <span className="universe-label universe-label-two">
              EXPLORE
            </span>
            <span className="universe-label universe-label-three">
              DISCOVER
            </span>
          </div>

          <div className="signup-live-note">
            <span className="live-note-mark">✦</span>
            <span>
              <strong>
                {name.trim() ? `Welcome to your orbit, ${name.trim().split(/\s+/)[0]}.` : "Your campus story starts here."}
              </strong>
              <br />
              A little space to make campus yours.
            </span>
          </div>
        </section>

        <section className="auth-card register-card">
          <div className="auth-card-top">
            <span className="auth-step">02 / CREATE YOUR SPACE</span>
            <span className="auth-card-star" aria-hidden="true">✳</span>
          </div>

          <div className="auth-heading">
            <h2>Make it yours<span>.</span></h2>
            <p>Create an account and get connected to campus life.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="register-name">Full name</label>
            <input
              id="register-name"
              type="text"
              placeholder="What should we call you?"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <label htmlFor="register-email">Email address</label>
            <input
              id="register-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <fieldset className="auth-role-fieldset">
              <legend>I am registering as</legend>
              <div className="auth-role-grid" role="radiogroup" aria-label="Registration role">
                <button
                  type="button"
                  role="radio"
                  aria-checked={requestedRole === "student"}
                  tabIndex={requestedRole === "student" ? 0 : -1}
                  className={`auth-role-option${requestedRole === "student" ? " selected" : ""}`}
                  onClick={() => setRequestedRole("student")}
                  onKeyDown={(event) => handleRoleKeyDown(event, 0)}
                >
                  <span className="auth-role-icon" aria-hidden="true"><GraduationCap size={19} /></span>
                  <span className="auth-role-copy">
                    <strong>Student</strong>
                    <small>Campus services, events, parking and Lost &amp; Found.</small>
                  </span>
                  {requestedRole === "student" && <Check className="auth-role-check" size={16} aria-hidden="true" />}
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={requestedRole === "faculty"}
                  tabIndex={requestedRole === "faculty" ? 0 : -1}
                  className={`auth-role-option${requestedRole === "faculty" ? " selected" : ""}`}
                  onClick={() => setRequestedRole("faculty")}
                  onKeyDown={(event) => handleRoleKeyDown(event, 1)}
                >
                  <span className="auth-role-icon" aria-hidden="true"><BookOpenCheck size={18} /></span>
                  <span className="auth-role-copy">
                    <strong>Request Faculty Access</strong>
                    <small>Cabin availability and meeting requests, after approval.</small>
                  </span>
                  {requestedRole === "faculty" && <Check className="auth-role-check" size={16} aria-hidden="true" />}
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={requestedRole === "club_organiser"}
                  tabIndex={requestedRole === "club_organiser" ? 0 : -1}
                  className={`auth-role-option${requestedRole === "club_organiser" ? " selected" : ""}`}
                  onClick={() => setRequestedRole("club_organiser")}
                  onKeyDown={(event) => handleRoleKeyDown(event, 2)}
                >
                  <span className="auth-role-icon" aria-hidden="true"><UsersRound size={18} /></span>
                  <span className="auth-role-copy">
                    <strong>Request Club Organiser Access</strong>
                    <small>Club events and registrations, after approval.</small>
                  </span>
                  {requestedRole === "club_organiser" && <Check className="auth-role-check" size={16} aria-hidden="true" />}
                </button>

                <div className="auth-role-option auth-role-locked" role="note" aria-label="Admin access is provisioned by an administrator">
                  <span className="auth-role-icon"><ShieldCheck size={18} /></span>
                  <span className="auth-role-copy">
                    <strong>Admin access</strong>
                    <small>User roles, campus data and operations. Assigned only by an authorized administrator.</small>
                  </span>
                  <span className="auth-role-lock-label">LOCKED</span>
                </div>
              </div>
              {requestedRole !== "student" && (
                <p className="auth-role-notice" role="status">
                  You will start with Student access. An administrator must approve this request before your role changes.
                </p>
              )}
            </fieldset>

            <div className="auth-label-row">
              <label htmlFor="register-password">Create password</label>
              <span className="auth-hint">12+ CHARACTERS REQUIRED</span>
            </div>

            <input
              id="register-password"
              type="password"
              placeholder="Make it a good one"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              required
            />

            <label htmlFor="register-confirm-password">Confirm password</label>
            <input
              id="register-confirm-password"
              type="password"
              placeholder="Enter your password again"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={12}
              required
              aria-invalid={Boolean(error && password !== confirmPassword)}
              aria-describedby={error && password !== confirmPassword ? "register-password-error" : undefined}
            />

            <div
              className="password-strength"
              aria-live="polite"
              aria-label={`Password strength: ${strengthLabel}`}
            >
              <div className="strength-bars">
                {[1, 2, 3, 4].map((bar) => (
                  <span
                    key={bar}
                    className={bar <= strength ? `strength-bar strength-level-${strength}` : "strength-bar"}
                  />
                ))}
              </div>
              <span className="strength-label">{strengthLabel}</span>
            </div>

            {error && <p className="auth-form-error" id="register-password-error" role="alert">{error}</p>}

            <button type="submit" className="primary-btn" disabled={submitting}>
              <span>{submitting ? "Creating account..." : "Create my account"}</span>
              <span className="button-arrow" aria-hidden="true">↗</span>
            </button>
          </form>

          <p className="auth-footer">
            Already part of CampusFlow?{" "}
            <Link to="/login">Sign in ↗</Link>
          </p>

          <div className="auth-card-bottom">
            <span>CAMPUSFLOW © 2026</span>
            <span>YOUR SPACE, YOUR PACE</span>
          </div>
        </section>
      </div>

      <div className="auth-page-index" aria-hidden="true">
        <span>CF—02</span>
        <span>MAKE YOURSELF AT HOME</span>
      </div>
    </main>
  );
}