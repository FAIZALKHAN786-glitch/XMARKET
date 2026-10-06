import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers and transport policy.
 *
 * These belong at the edge rather than in each route, because a header that
 * one route forgets is a header an attacker can rely on.
 */

export function middleware(request: NextRequest) {
  // Ensure Next sees the request's actual external host (from the preview proxy)
  // rather than always resolving to localhost. Without this, server-side
  // redirects (like the root `/` → `/signin`) produce Location: http://localhost:3000
  // which bounces users out of the preview into a dead localhost URL.
  const requestHeaders = new Headers(request.headers);
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim()
    ?? requestHeaders.get("host")
    ?? "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
  requestHeaders.set("host", host);
  requestHeaders.set("x-forwarded-host", host);
  requestHeaders.set("x-forwarded-proto", proto);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // After Next builds its response, fix any remaining absolute redirects that
  // still point at localhost (belt-and-braces in case an API route uses
  // Response.redirect directly).
  fixDevRedirectLocation(response, request);

  const isDev = process.env.NODE_ENV !== "production";
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  const cspConnect = isDev ? "'self' ws: wss: http: https:" : "'self' ws: wss:";
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: https: http:",
      `connect-src ${cspConnect}`,
      "font-src 'self' data: https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  if (proto === "https") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return response;
}

function fixDevRedirectLocation(response: Response, request: NextRequest) {
  const location = response.headers.get("location");
  if (!location) return;
  try {
    const loc = new URL(location, request.url);
    if (loc.hostname === "localhost" || loc.hostname === "127.0.0.1") {
      const ext = new URL(request.url);
      loc.protocol = ext.protocol;
      loc.host = ext.host;
      response.headers.set("location", loc.toString());
    }
  } catch {
    /* leave as-is */
  }
}

export const config = {
  // Everything except Next's own static assets and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
