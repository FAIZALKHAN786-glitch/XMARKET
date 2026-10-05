// The FastAPI service (AI + OAuth2) runs as a separate process. The browser
// only ever talks to the Next.js origin; this rewrite proxies `/fastapi/*` to
// it. Point FASTAPI_URL elsewhere in non-local deployments.
const fastapiBase = (process.env.FASTAPI_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  // The preview proxy serves the app from a *.e2b.app host, so allow any
  // dev origin to reach the dev server without cross-origin warnings.
  allowedDevOrigins: ["*.e2b.app", "localhost:3000", "127.0.0.1:3000"],
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
