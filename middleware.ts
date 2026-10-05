import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers and transport policy.
 *
 * These belong at the edge rather than in each route, because a header that
 * one route forgets is a header an attacker can rely on.
 */

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // The app sets no cookie it wants readable by script, and renders no
  // third-party content, so both of these can be strict.
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // Next inlines its own bootstrap scripts and styles.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  // Once this runs behind HTTPS, tell browsers never to come back over plain
  // HTTP. Only sent when the request actually arrived over TLS, because
  // sending HSTS on an insecure connection is meaningless and confuses
  // anything caching it.
  const proto = request.headers.get("x-forwarded-proto");
  if (proto === "https" || request.nextUrl.protocol === "https:") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return response;
}

export const config = {
  // Everything except Next's own static assets and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
