"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";

/**
 * Landing page for the emailed password-reset link.
 *
 * The token arrives in the query string. It is single use and expires after 30
 * minutes; the API rejects a replay, so a refreshed page after a successful
 * reset shows the failure state rather than silently resetting again.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  if (!token) {
    return (
      <div className="frame py-20 md:py-28">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            This reset link is incomplete
          </h1>
          <p className="mt-3 text-sm leading-relaxed muted">
            There is no token in the link. Request a new password reset and use
            the link from that email.
          </p>
          <Link
            href="/signin/buyer"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="frame py-20 md:py-28">
        <div className="mx-auto max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Password changed
          </h1>
          <p className="mt-3 text-sm leading-relaxed muted">
            Every other device signed in with the old password has been signed
            out. Sign in again with your new one.
          </p>
          <Button size="lg" className="mt-6" onClick={() => router.push("/signin")}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const json = await response.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Something went wrong.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="frame py-20 md:py-28">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Choose a new password
        </h1>

        <Card className="mt-8">
          <form onSubmit={submit}>
            <label className="label" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="field h-11"
            />

            <div className="mt-4">
              <label className="label" htmlFor="confirm-password">
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                className="field h-11"
              />
            </div>

            {error && (
              <p className="mt-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={busy} className="mt-6 w-full">
              {busy ? "Please wait…" : "Change password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
