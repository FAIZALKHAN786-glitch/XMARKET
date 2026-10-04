"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Sparkles,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { LogoLockup } from "../LogoMark";
import { loginUser } from "@/lib/api";

/* ── Flow visualization: three hand-composed glass cards ─────────── */
function FlowCards() {
  return (
    <div className="flow-wrap" aria-hidden="true">
      {/* CARD 1 — POST (bottom of stack) */}
      <div className="glass flow-card flow-card--post">
        <div className="flow-row">
          <FileText size={16} strokeWidth={1.5} style={{ color: "#555555" }} />
          <span className="flow-row-label">Post your need</span>
        </div>
        <p className="flow-desc">Describe what you need in plain language</p>
        <div className="flow-input-mock">Nokia 3310 under $80...</div>
      </div>

      {/* CARD 2 — AI (middle of stack) */}
      <div className="glass flow-card flow-card--ai">
        <div className="flow-row">
          <Sparkles size={16} strokeWidth={1.5} style={{ color: "#888888" }} />
          <span className="flow-row-label">AI Matching</span>
        </div>
        <div className="flow-bars">
          <div className="flow-bar"><div className="flow-bar-fill" /></div>
          <div className="flow-bar"><div className="flow-bar-fill" /></div>
          <div className="flow-bar"><div className="flow-bar-fill" /></div>
        </div>
        <span className="flow-confidence">87% match confidence</span>
      </div>

      {/* CARD 3 — SELECT (top of stack) */}
      <div className="glass flow-card flow-card--select">
        <div className="flow-row">
          <CheckCircle size={16} strokeWidth={1.5} style={{ color: "#aaaaaa" }} />
          <span className="flow-row-label">Select &amp; Transact</span>
        </div>
        <div className="flow-offer-row">
          <span className="fo-name">TechMart Pro</span>
          <span className="fo-price">$74.99</span>
        </div>
        <div className="flow-offer-row dim">
          <span className="fo-name">QuickShip Co</span>
          <span className="fo-price">$79.00</span>
        </div>
        <div className="flow-sep" />
        <span className="match-badge">96% Match</span>
      </div>
    </div>
  );
}

/* ── Monochrome Google "G" ───────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 10.2v3.9h5.42c-.24 1.42-1.66 4.16-5.42 4.16-3.26 0-5.92-2.7-5.92-6.02 0-3.32 2.66-6.02 5.92-6.02 1.86 0 3.1.79 3.81 1.47l2.6-2.51C16.75 3.65 14.6 2.7 12 2.7 6.86 2.7 2.7 6.86 2.7 12s4.16 9.3 9.3 9.3c5.37 0 8.93-3.78 8.93-9.08 0-.61-.07-1.08-.15-1.54H12z"
        fill="currentColor"
      />
    </svg>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginView() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({ email: null, password: null });
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next = { email: null, password: null };
    if (!EMAIL_RE.test(email)) next.email = "Please enter a valid email address";
    if (!password) next.password = "Password is required";
    setErrors(next);
    return !next.email && !next.password;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    // TODO: onClick → POST /api/auth/login { email, password }
    // TODO: On success → store JWT → redirect to /dashboard
    // TODO: On error → show inline error below button
    await loginUser({ email, password });
    router.push("/dashboard");
  };

  const onGoogle = () => {
    // TODO: onClick → window.location.href = '/api/auth/google'
    // TODO: Google OAuth2 callback → /api/auth/google/callback
    // TODO: On success → JWT stored → redirect /dashboard
    router.push("/dashboard");
  };

  return (
    <main className="login">
      {/* ── LEFT — atmosphere & brand storytelling ─────────────────── */}
      <section className="login-left" aria-hidden="true">
        <div className="login-watermark">Xmarket</div>

        <div className="login-left-content">
          <LogoLockup size={40} wordSize={22} />
          <FlowCards />
          <div className="login-tagline">
            <span>Stop searching.</span>
            <span>Start receiving.</span>
          </div>
        </div>

        <div className="login-stats">
          <span className="stat-pill">2,400+ Buyers</span>
          <span className="stat-pill">18,000+ Providers</span>
          <span className="stat-pill">AI-Powered</span>
        </div>
      </section>

      {/* ── RIGHT — the auth form and nothing else ─────────────────── */}
      <section className="login-right">
        <div className="auth-box">
          <div className="login-mobile-logo">
            <LogoLockup size={40} wordSize={22} />
          </div>

          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-sub">Sign in to continue to Xmarket</p>

          <form className="auth-form" onSubmit={onSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="email" className="label label--form">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`input ${errors.email ? "is-error" : ""}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: null }));
                }}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p className="field-error" id="email-error" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="label label--form">
                Password
              </label>
              <div className="pw-wrap">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  className={`input ${errors.password ? "is-error" : ""}`}
                  placeholder="············"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((p) => ({ ...p, password: null }));
                  }}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  aria-label="Toggle password visibility"
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? (
                    <EyeOff size={16} strokeWidth={1.5} />
                  ) : (
                    <Eye size={16} strokeWidth={1.5} />
                  )}
                </button>
              </div>
              <div className="auth-row-under">
                {errors.password ? (
                  <p className="field-error" id="password-error" role="alert" style={{ marginTop: 0 }}>
                    {errors.password}
                  </p>
                ) : (
                  <span />
                )}
                <a href="#" className="forgot-link" onClick={(e) => e.preventDefault()}>
                  Forgot password?
                </a>
              </div>
            </div>

            <button
              type="submit"
              className={`btn-primary auth-submit ${loading ? "is-loading" : ""}`}
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={16} strokeWidth={1.5} className="spin" style={{ color: "#000000" }} />
              ) : (
                "Sign In"
              )}
            </button>

            <div className="auth-divider" aria-hidden="true">
              <span className="line" />
              <span className="txt">or</span>
              <span className="line" />
            </div>

            <button type="button" className="google-btn" onClick={onGoogle}>
              <GoogleIcon />
              Continue with Google
            </button>
          </form>

          <p className="auth-footer">
            Don&apos;t have an account?{" "}
            <a href="#" onClick={(e) => e.preventDefault()}>
              Create one
            </a>
          </p>
        </div>

        <p className="auth-terms">
          By signing in, you agree to our Terms and Privacy Policy
        </p>
      </section>
    </main>
  );
}
