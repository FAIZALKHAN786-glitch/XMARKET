/* ==========================================================================
   Client for the XMARKET FastAPI service (AI + OAuth2).

   The service runs as a separate process; the browser only ever talks to the
   Next.js origin, and `next.config.mjs` proxies `/fastapi/*` to it. Every
   call is same-origin, so cookies are sent automatically with
   `credentials: "include"`.

   Authentication: the FastAPI service accepts a JWT bearer token or the
   httpOnly `xmarket_jwt` cookie. Google sign-ins already receive that cookie
   from the OAuth callback. Password logins hold the Next.js `xmarket_session`
   cookie instead, so before the first call we "upgrade" it with a one-time
   OAuth2 session grant — the grant response sets `xmarket_jwt`, and every
   later call is authenticated by the cookie alone.
   ========================================================================== */

import type { ApiEnvelope } from "@/lib/api-core";
import { ApiClientError } from "@/lib/api-core";

const BASE = "/fastapi";

/**
 * Thrown when the FastAPI process is unreachable (the proxy answers 5xx, or
 * the fetch fails outright). Callers in api-client catch this and retry the
 * equivalent Next.js /api/ai/* route. Real API errors (auth, validation, rate
 * limits) are NOT this error — they are surfaced as ApiClientError.
 */
export class FastapiUnreachableError extends Error {
  constructor(message = "The AI service is unreachable") {
    super(message);
    this.name = "FastapiUnreachableError";
  }
}

/**
 * One session-grant per page load. It exchanges the password-login
 * `xmarket_session` cookie for the `xmarket_jwt` cookie the FastAPI service
 * accepts. For Google sign-ins (no session cookie) the grant 401s, which is
 * harmless — the browser already carries `xmarket_jwt`. If the FastAPI
 * process is down the fetch fails and we simply move on; the per-call
 * fallback in api-client covers it.
 */
let upgradePromise: Promise<void> | null = null;

/**
 * Public so sign-in pages can upgrade the session eagerly (right after a
 * password login) instead of waiting for the first AI call. Safe to call any
 * number of times — it resolves to a single underlying request per page load.
 */
export function upgradeSession(): Promise<void> {
  if (!upgradePromise) {
    upgradePromise = (async () => {
      try {
        await fetch(`${BASE}/v1/oauth2/token`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "session" }).toString(),
        });
      } catch {
        // FastAPI unreachable — nothing to upgrade here.
      }
    })();
  }
  return upgradePromise;
}

/**
 * Call a FastAPI endpoint through the same-origin proxy and unwrap the
 * `{ok, data, error}` envelope. `path` is relative to the service root, e.g.
 * `/v1/ai/parse-requirement`.
 */
export async function fastapiRequest<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  await upgradeSession();

  const { json, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...rest,
      credentials: "include",
      headers: {
        ...(json ? { "content-type": "application/json" } : {}),
        ...(rest.headers ?? {}),
      },
      body: json ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new FastapiUnreachableError();
  }

  let payload: ApiEnvelope<T> | undefined;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new FastapiUnreachableError("The AI service returned a non-JSON response");
  }

  // A genuine FastAPI error envelope (including a Gemini auth/network error
  // with HTTP 502/503) means the service IS reachable. Do not send the same
  // paid request again through Next.js or hide the original diagnosis.
  if (!payload || typeof payload.ok !== "boolean") {
    throw new FastapiUnreachableError("The AI service returned an invalid response");
  }
  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new ApiClientError(
      payload?.error?.message ?? `Request failed with ${response.status}`,
      payload?.error?.code ?? "unknown",
      response.status,
      payload?.error?.details
    );
  }
  return payload.data;
}
