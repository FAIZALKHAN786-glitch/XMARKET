"use client";

/**
 * "Continue with Google" — a full-page navigation to the Google consent
 * screen, routed through the FastAPI OAuth2 service. The callback sets the
 * httpOnly `xmarket_jwt` cookie (which the app verifies in currentAccount) and
 * redirects back to `next`.
 *
 * A plain <a> (not next/link) on purpose: OAuth should be a real document
 * navigation off to accounts.google.com and back, not a client-side route.
 */
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
  return (
    <a
      href={href}
      className="inline-flex h-11 w-full select-none items-center justify-center gap-2.5 whitespace-nowrap rounded-xl border border-white/20 px-5 text-[0.9375rem] font-medium text-white transition-colors duration-150 hover:border-white/40 hover:bg-white/5"
    >
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
      Continue with Google
    </a>
  );
}
