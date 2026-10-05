"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card } from "@/components/ui/primitives";

/**
 * Landing page for the emailed verification link.
 *
 * There is nothing for the visitor to type — the token in the link is the whole
 * action — so it is consumed on mount and the result reported.
 */
function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [state, setState] = React.useState<"working" | "done" | "failed">(
    token ? "working" : "failed"
  );
  const [message, setMessage] = React.useState(
    token ? "" : "There is no token in the link."
  );

  // Once per token. The API marks a token used inside the same statement that
  // selects it, so a reload after success reports the failure state rather than
  // appearing to verify twice.
  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await response.json();
        if (cancelled) return;
        if (!json.ok) throw new Error(json.error?.message ?? "Something went wrong.");
        setState("done");
      } catch (err) {
        if (cancelled) return;
        setState("failed");
        setMessage(err instanceof Error ? err.message : "Something went wrong.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="frame py-20 md:py-28">
      <div className="mx-auto max-w-md">
        <Card>
          {state === "working" && (
            <p className="text-sm muted">Confirming your address…</p>
          )}

          {state === "done" && (
            <>
              <h1 className="text-xl font-semibold text-white">
                Your address is confirmed
              </h1>
              <p className="mt-2 text-sm leading-relaxed muted">
                You can post requirements now.
              </p>
              <Button size="lg" className="mt-6" onClick={() => router.push("/signin")}>
                Go to sign in
              </Button>
            </>
          )}

          {state === "failed" && (
            <>
              <h1 className="text-xl font-semibold text-white">
                That link did not work
              </h1>
              <p className="mt-2 text-sm leading-relaxed muted">
                {message} Request a new verification email and use the link from
                that one.
              </p>
              <Link
                href="/signin"
                className="mt-6 inline-flex text-sm text-white/70 transition-colors hover:text-white"
              >
                Back to sign in
              </Link>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<div className="frame py-20 md:py-28" aria-busy="true" />}><VerifyEmailForm /></Suspense>;
}
