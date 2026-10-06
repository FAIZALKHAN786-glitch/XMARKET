#!/usr/bin/env node
/**
 * Cross-platform launcher for `next dev` that sets NEXT_DEV=1 so next.config.mjs
 * picks the dev-specific build directory (`.next-dev/`).
 *
 * This keeps the dev server's compiled chunks completely separate from the
 * production build in `.next/`, so running `npm run build` in another terminal
 * (or running both `npm run dev` and `npm start` at the same time) cannot
 * corrupt each other's output — the root cause of "page loads but buttons do
 * nothing" called out in the README.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEXT_CLI = path.join(ROOT_DIR, "node_modules", "next", "dist", "bin", "next");

const args = [NEXT_CLI, "dev", "-H", "0.0.0.0", "-p", "3000", ...process.argv.slice(2)];

const child = spawn(process.execPath, args, {
  cwd: ROOT_DIR,
  env: { ...process.env, NEXT_DEV: "1", XMARKET_SEED: process.env.XMARKET_SEED ?? "demo" },
  stdio: "inherit",
  windowsHide: true,
});

// Forward signals so Ctrl-C stops the dev server cleanly.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (child.exitCode === null && child.signalCode === null) {
      try { child.kill(signal); } catch { /* already gone */ }
    }
  });
}

child.on("error", (err) => {
  console.error(`Failed to start next dev: ${err.message}`);
  process.exit(1);
});

child.on("close", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
