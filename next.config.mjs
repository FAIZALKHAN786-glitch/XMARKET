// The FastAPI service (AI + OAuth2) runs as a separate process. The browser
// only ever talks to the Next.js origin; this rewrite proxies `/fastapi/*` to
// it. Point FASTAPI_URL elsewhere in non-local deployments.
const fastapiBase = (process.env.FASTAPI_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

// Use a separate build directory for `next dev` vs `next build`/`next start`
// so they can never corrupt each other's chunks. The README warns that a dev
// server and a build running at the same time (or a build interrupted mid-way
// through) leaves `.next/` half-written, which serves HTML without its JS
// chunks — "a page loads but buttons do nothing". Splitting the dist dir means
// `npm run dev` and `npm run build && npm start` can even run concurrently
// without stepping on each other. The npm `dev` script sets NEXT_DEV=1 so we
// pick the dev-specific folder; any other invocation (build, start, lint …)
// keeps the production `.next/`. Override with NEXT_DIST_DIR if needed.
const devDistDir = process.env.NEXT_DEV_DIST_DIR || ".next-dev";
const prodDistDir = process.env.NEXT_DIST_DIR || ".next";
const distDir = process.env.NEXT_DIST_DIR || (process.env.NEXT_DEV === "1" ? devDistDir : prodDistDir);

const nextConfig = {
  reactStrictMode: true,
  distDir,
  // The preview proxy serves the app from a *.e2b.app host, so allow any
  // dev origin to reach the dev server without cross-origin warnings.
  // In production we don't set this — the preview is only for dev.
  allowedDevOrigins: ["*.e2b.app", "*.e2b.dev", "localhost:3000", "127.0.0.1:3000", "*"],
  // Allow any hostname to pass through Next's dev host header check so the
  // preview proxy (and any tunnel) can reach the server without being rejected.
  experimental: {
    // (placeholder if needed in future)
  },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [{ source: "/fastapi/:path*", destination: `${fastapiBase}/:path*` }];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // The dev server watches the project directory, and the store lives
      // inside it — data/xmarket.json is rewritten on every mutation and, when
      // DATABASE_URL points at the local cluster, .pgdata/ churns constantly.
      // Watching them made every write trigger a recompile, and a request that
      // landed mid-compile intermittently 500'd. Ignore the runtime data.
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.pgdata/**",
          "**/data/**",
          "**/.next/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
