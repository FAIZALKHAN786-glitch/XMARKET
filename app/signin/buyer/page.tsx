"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { upgradeSession } from "@/lib/fastapi-client";

export default function BuyerSignInPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"signin" | "create">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/register";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "signin"
            ? { email, password, role: "buyer" }
            : { role: "buyer", email, password, displayName }
        ),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Unable to sign in. Please try again.");
      }
      // Exchange the fresh session cookie for the FastAPI bearer token so AI
      // calls are authenticated immediately (fire-and-forget).
      void upgradeSession();
      router.push("/buyer");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <div className="frame py-20 md:py-28">
      <div className="mx-auto max-w-md">
        <Link
          href="/signin"
          className="inline-flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Buyer sign in
        </h1>

        <Card className="mt-8">
          <form onSubmit={submit}>
            <label className="label" htmlFor="buyer-email">
              Email
            </label>
            <input
              id="buyer-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="field h-11"
            />

            {mode === "create" && (
              <div className="mt-4">
                <label className="label" htmlFor="buyer-name">
                  Your name
                </label>
                <input
                  id="buyer-name"
                  required
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Priya Raman"
                  className="field h-11"
                />
              </div>
            )}

            <div className="mt-4">
              <label className="label" htmlFor="buyer-password">
                Password
              </label>
              <input
                id="buyer-password"
                type="password"
                required
                minLength={mode === "create" ? 8 : undefined}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="field h-11"
              />
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={busy} className="mt-6 w-full">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs uppercase tracking-wide text-white/40">or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="mt-6">
            <GoogleSignInButton role="buyer" next="/buyer" />
          </div>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "create" : "signin");
              setError(null);
            }}
            className="mt-4 w-full text-center text-sm text-white/60 transition-colors hover:text-white"
          >
            {mode === "signin"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </Card>
      </div>
    </div>
  );
}
