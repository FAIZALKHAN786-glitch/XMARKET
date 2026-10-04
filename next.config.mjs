const nextConfig = {
  reactStrictMode: true,
  // The preview proxy serves the app from a *.e2b.app host, so allow any
  // dev origin to reach the dev server without cross-origin warnings.
  allowedDevOrigins: ["*.e2b.app", "localhost:3000", "127.0.0.1:3000"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
