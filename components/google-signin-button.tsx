"use client";

import * as React from "react";

/**
 * "Continue with Google" — a full-page navigation to the Google consent
 * screen, routed through the FastAPI OAuth2 service. The callback sets the
 * httpOnly `xmarket_jwt` cookie (which the app verifies in currentAccount) and
 * redirects back to `next`.
 *
 * A plain <a> (not next/link) on purpose: OAuth should be a real document
 * navigation off to accounts.google.com and back, not a client-side route.
 * `target="_top"` matters for the same reason — when the app is being viewed
 * inside a preview frame, Google refuses to render its consent screen in a
 * sub-frame and the tab goes blank instead.
 *
 * Before offering the button we ask the OAuth service what state it is in.
 * Google sign-in has three ways to be broken, and none of them used to be
 * visible: the FastAPI process not running (the click returned Next.js's bare
 * "Internal Server Error" page), credentials not configured (a raw JSON
 * envelope in the tab), or a server that cannot open a connection to Google
 * (a 500 after the user had already picked an account). Naming the reason on
 * the page is the whole point of this component.
 */

type Probe =
  /** Still asking — render the button, a slow probe must never block a click. */
  | { kind: "probing" }
  | { kind: "ready" }
  /** Next.js answered 5xx: the /fastapi/* rewrite has nothing behind it. */
  | { kind: "service-down" }
  /** Service answered, but GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are absent. */
  | { kind: "not-configured" }
  /** Service is up and configured, but it cannot open a socket to Google. */
  | { kind: "google-unreachable"; detail: string };

/** A one-line, plain-English reason for a failed Google round trip. */
export function googleSignInError(code: string | null | undefined): string | null {
  switch (code) {
    case "not_configured":
      return "Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local, then restart the app and the OAuth service.";
    case "cancelled":
      return "The Google sign-in was cancelled before it finished.";
    case "redirect_uri_mismatch":
      return "Google rejected the redirect URI. Copy the redirectUri reported by GET /fastapi/health into your OAuth client's authorised redirect URIs and try again.";
    case "invalid_client":
      return "Google did not accept the OAuth client. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, and that the credential type is \"Web application\".";
    case "invalid_scope":
      return "Google refused the requested scopes. The OAuth client needs the openid, email and profile scopes enabled.";
    case "admin_policy_enforced":
      return "A Google Workspace policy blocks this app, so the sign-in was refused.";
    case "org_internal":
      return "That OAuth client only accepts accounts from its own organisation.";
    case "google_denied":
      return "Google refused the sign-in request. Check the OAuth consent screen configuration for your client.";
    case "invalid_state":
      return "That sign-in link had expired. Choose Continue with Google again.";
    case "no_code":
      return "Google came back without an authorization code, so the sign-in could not be completed.";
    case "unreachable":
      return "The OAuth service could not reach Google from this machine, so the code could not be exchanged. Check outbound network access — GET /fastapi/health reports the error.";
    case "upstream":
      return "Google rejected the code exchange. Confirm the client secret and that the redirect URI matches the one /fastapi/health reports.";
    case "unauthorized":
      return "Google did not confirm a verified email address, so no account was created.";
    case "internal":
      return "The OAuth service failed while completing the Google sign-in. Its logs have the detail.";
    default:
      return code ? `Google sign-in failed (${code}).` : null;
  }
}

const BUTTON_CLASS =
  "inline-flex h-11 w-full select-none items-center justify-center gap-2.5 whitespace-nowrap rounded-xl border border-white/20 px-5 text-[0.9375rem] font-medium text-white transition-colors duration-150";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" focusable="false">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.6 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.98 3.11C6.22 6.87 8.87 4.76 12 4.76z"
      />
    </svg>
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function probeService(): Promise<Probe> {
  // Two attempts: a single dropped request should not disable a button that
  // would otherwise work.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("/fastapi/health", {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        await sleep(600);
        continue; // the rewrite proxy has no live service behind it
      }
      const json = (await response.json()) as {
        data?: { google?: { configured?: boolean; reachable?: boolean | null; detail?: string } };
      };
      const google = json.data?.google;
      if (!google?.configured) return { kind: "not-configured" };
      if (google.reachable === false) {
        return { kind: "google-unreachable", detail: google.detail ?? "" };
      }
      return { kind: "ready" };
    } catch {
      await sleep(600);
    }
  }
  return { kind: "service-down" };
}

function blockedReason(probe: Probe): string | null {
  switch (probe.kind) {
    case "service-down":
      return "Google sign-in needs the OAuth service (backend/), which is not responding. Start it with npm run py:dev — see the README.";
    case "not-configured":
      return "Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local, then restart both servers.";
    case "google-unreachable":
      return probe.detail
        ? `This server cannot reach Google, so the sign-in cannot finish: ${probe.detail}`
        : "This server cannot reach Google, so the sign-in cannot finish.";
    default:
      return null;
  }
}

export function GoogleSignInButton({
  role,
  next,
}: {
  role: "buyer" | "seller";
  next: string;
}) {
  const href = `/fastapi/v1/oauth2/authorize/google?role=${role}&next=${encodeURIComponent(
    next
  )}`;
  const [probe, setProbe] = React.useState<Probe>({ kind: "probing" });

  React.useEffect(() => {
    let active = true;
    void probeService().then((result) => {
      if (active) setProbe(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const reason = blockedReason(probe);
  if (reason) {
    return (
      <div>
        <button
          type="button"
          disabled
          aria-disabled
          className={`${BUTTON_CLASS} cursor-not-allowed border-white/10 text-white/40`}
        >
          <GoogleMark />
          Continue with Google
        </button>
        <p className="mt-2 text-xs leading-relaxed text-white/45">{reason}</p>
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_top"
      rel="noopener"
      className={`${BUTTON_CLASS} hover:border-white/40 hover:bg-white/5`}
    >
      <GoogleMark />
      Continue with Google
    </a>
  );
}
