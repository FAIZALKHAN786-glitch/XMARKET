"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { SiteHeader } from "@/components/site-header";
import { Button, Card, CategorySelect, Input } from "@/components/ui";
import type { CategoryId } from "@/lib/types";

function dashboardFor(role: "buyer" | "seller") {
  return role === "seller" ? "/seller-dashboard" : "/buyer-dashboard";
}

export default function LoginPage() {
  const { account, loading, login, register } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopLocation, setShopLocation] = useState("");
  const [shopCategory, setShopCategory] = useState<CategoryId>("manufacturing");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [next, setNext] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "register") setMode("register");
    const target = params.get("next");
    if (target?.startsWith("/")) setNext(target);
  }, []);

  useEffect(() => {
    if (!loading && account) router.replace(next || dashboardFor(account.role));
  }, [account, loading, next, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(username, password, role);
      } else {
        await register({
          role,
          username,
          password,
          ...(role === "seller"
            ? { shopName, shopLocation, shopCategory }
            : {}),
        });
      }
      router.replace(next || dashboardFor(role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const useDemo = () => {
    setMode("login");
    setRole(role);
    setUsername(role === "seller" ? "shop" : "demo");
    setPassword("demo1234");
    setError("");
  };

  return (
    <div>
      <SiteHeader />
      <main className="auth-wrap">
        <Card className="auth-card fade-up">
          <Link href="/" className="eyebrow hover:underline inline-block">← Back to X Market</Link>
          <h1 className="page-title mt-4">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="lede">
            {mode === "login"
              ? "Sign in to post requirements, bid on work and open your XMarket ID."
              : "Pick a role. Your XMarket ID is generated the moment you join."}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Sign in or register">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={`auth-tab ${mode === "login" ? "active" : ""}`}
              onClick={() => { setMode("login"); setError(""); }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "register"}
              className={`auth-tab ${mode === "register" ? "active" : ""}`}
              onClick={() => { setMode("register"); setError(""); }}
            >
              Create account
            </button>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Choose role">
            <button
              type="button"
              role="tab"
              aria-selected={role === "buyer"}
              className={`auth-tab ${role === "buyer" ? "active" : ""}`}
              onClick={() => { setRole("buyer"); setError(""); }}
            >
              I&apos;m a buyer
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === "seller"}
              className={`auth-tab ${role === "seller" ? "active" : ""}`}
              onClick={() => { setRole("seller"); setError(""); }}
            >
              I&apos;m a seller
            </button>
          </div>

          {error && <div className="error-box mb-4" role="alert">{error}</div>}

          <form onSubmit={submit} className="form-stack">
            <div>
              <label className="field-label" htmlFor="username">Username</label>
              <Input
                id="username"
                autoComplete="username"
                placeholder={role === "buyer" ? "e.g. alexbuyer" : "e.g. atlas_shop"}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                minLength={3}
                maxLength={20}
                required
              />
              <p className="field-hint">3–20 characters · letters, numbers and underscores.</p>
            </div>
            <div>
              <label className="field-label" htmlFor="password">Password</label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            {mode === "register" && role === "seller" && (
              <>
                <div>
                  <label className="field-label" htmlFor="shopName">Shop name</label>
                  <Input id="shopName" placeholder="e.g. Atlas Precision" value={shopName} onChange={(e) => setShopName(e.target.value)} minLength={3} maxLength={50} required />
                </div>
                <div>
                  <label className="field-label" htmlFor="shopLocation">Shop location</label>
                  <Input id="shopLocation" placeholder="e.g. Cleveland, OH" value={shopLocation} onChange={(e) => setShopLocation(e.target.value)} minLength={3} maxLength={100} required />
                </div>
                <div>
                  <label className="field-label" htmlFor="shopCategory">Shop category</label>
                  <CategorySelect value={shopCategory} onChange={setShopCategory} />
                  <p className="field-hint">Your XMarket ID will include the category code.</p>
                </div>
              </>
            )}

            <Button type="submit" disabled={submitting} className="btn-wide btn-lg">
              {submitting
                ? "One moment…"
                : mode === "login"
                ? `Sign in as ${role} →`
                : `Create ${role} account →`}
            </Button>
          </form>

          {mode === "login" && (
            <div className="demo-hint">
              <span><b>Just looking?</b> Use the seeded demo {role} account.</span>
              <button type="button" className="linkish" onClick={useDemo}>Fill demo details</button>
            </div>
          )}
          <div className="auth-foot">
            <span>{mode === "login" ? "New to X Market?" : "Already registered?"}</span>
            <button
              type="button"
              className="linkish"
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            >
              {mode === "login" ? "Create an account" : "Sign in instead"}
            </button>
          </div>
        </Card>
      </main>
    </div>
  );
}
