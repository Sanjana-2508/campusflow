
import { useState } from "react";
import type { FormEvent } from "react";
import { BookOpenCheck, Check, GraduationCap, ShieldCheck, UsersRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest, dashboardPathForRole, type CampusUser } from "../services/api";
import "../styles/auth.css";

type LoginRole = CampusUser["role"];

const loginRoles: { value: LoginRole; label: string; icon: typeof GraduationCap }[] = [
  { value: "student", label: "Student", icon: GraduationCap },
  { value: "faculty", label: "Faculty", icon: BookOpenCheck },
  { value: "club_organiser", label: "Club Organiser", icon: UsersRound },
  { value: "admin", label: "Admin", icon: ShieldCheck },
];

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<LoginRole>("student");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { user } = await apiRequest<{ user: CampusUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const roleNotice = user.role === selectedRole
        ? undefined
        : `These credentials currently have ${roleName(user.role)} access. CampusFlow opened the dashboard for the verified account role.`;
      navigate(dashboardPathForRole(user.role), { state: roleNotice ? { loginNotice: roleNotice } : undefined });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-orbit auth-orbit-one" aria-hidden="true" />
      <div className="auth-orbit auth-orbit-two" aria-hidden="true" />
      <div className="auth-glow" aria-hidden="true" />

      <Link to="/login" className="auth-brand">
        <span className="brand-symbol">C</span>
        CAMPUS<span>FLOW</span>
      </Link>

      <div className="auth-layout">
        <section className="auth-intro">
          <p className="auth-kicker">
            <span className="status-dot" />
            YOUR CAMPUS, CONNECTED
          </p>

          <h1>
            Campus life,
            <br />
            <span>in your</span>
            <br />
            own orbit<span className="lime-period">.</span>
          </h1>

          <p className="auth-description">
            Find your way. Find your people. Make every
            moment on campus count.
          </p>

          <div className="orbit-note">
            <span className="orbit-note-icon">✳</span>
            <span>
              <strong>One space.</strong>
              <br />
              Everything campus.
            </span>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-card-top">
            <span className="auth-step">01 / WELCOME BACK</span>
            <span className="auth-card-star" aria-hidden="true">✳</span>
          </div>

          <div className="auth-heading">
            <h2>Good to see you<span>.</span></h2>
            <p>Sign in and pick up where campus takes you.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <fieldset className="auth-role-fieldset login-role-fieldset">
              <legend>Sign in as</legend>
              <div className="auth-role-grid" role="radiogroup" aria-label="Choose account type">
                {loginRoles.map(({ value, label, icon: Icon }) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selectedRole === value}
                    tabIndex={selectedRole === value ? 0 : -1}
                    className={`auth-role-option${selectedRole === value ? " selected" : ""}`}
                    key={value}
                    onClick={() => setSelectedRole(value)}
                    onKeyDown={(event) => {
                      if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
                      event.preventDefault();
                      const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
                      const currentIndex = loginRoles.findIndex((role) => role.value === value);
                      const nextIndex = (currentIndex + step + loginRoles.length) % loginRoles.length;
                      setSelectedRole(loginRoles[nextIndex].value);
                      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='radio']")[nextIndex]?.focus();
                    }}
                  >
                    <span className="auth-role-icon" aria-hidden="true"><Icon size={17} /></span>
                    <span className="auth-role-copy"><strong>{label}</strong><small>{value === "admin" ? "Provisioned campus administrators" : value === "student" ? "Campus services and student tools" : value === "faculty" ? "Approved faculty accounts" : "Approved club organisers"}</small></span>
                    {selectedRole === value && <Check className="auth-role-check" size={15} aria-hidden="true" />}
                  </button>
                ))}
              </div>
              <p className="login-role-hint">Your account role is verified by CampusFlow after sign-in. This selection never grants access.</p>
            </fieldset>

            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="auth-label-row">
              <label htmlFor="login-password">Password</label>
              <span className="auth-hint">YOUR ACCOUNT, YOUR SPACE</span>
            </div>
            <input
              id="login-password"
              type="password"
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <p className="auth-form-error" role="alert">{error}</p>}

            <button type="submit" className="primary-btn" disabled={submitting}>
              <span>{submitting ? "Signing in..." : "Enter CampusFlow"}</span>
              <span className="button-arrow" aria-hidden="true">↗</span>
            </button>
          </form>

          <p className="auth-footer">
            New around here?{" "}
            <Link to="/register">Create your account ↗</Link>
          </p>

          <div className="auth-card-bottom">
            <span>CAMPUSFLOW © 2026</span>
            <span>MADE FOR CAMPUS LIFE</span>
          </div>
        </section>
      </div>

      <div className="auth-page-index" aria-hidden="true">
        <span>CF—01</span>
        <span>FIND YOUR FLOW</span>
      </div>
    </main>
  );
}

function roleName(role: LoginRole) {
  if (role === "club_organiser") return "Club Organiser";
  return role === "admin" ? "Admin" : role === "faculty" ? "Faculty" : "Student";
}