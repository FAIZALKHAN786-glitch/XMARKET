#!/usr/bin/env node
/**
 * Write Google OAuth credentials into .env.local.
 *
 *   npm run google:setup -- <client-id> <client-secret>
 *
 * The point of the script is that the secret has a short life outside the
 * Google console: it goes straight into the one gitignored file that needs it,
 * instead of through a chat window, an issue, or a commit. Running it twice
 * replaces the values rather than appending a second copy.
 *
 * Neither value is a password for anything else, but the secret does identify
 * your app to Google — treat it like one.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ENV_FILE = path.join(process.cwd(), ".env.local");

const args = process.argv.slice(2).filter((a) => a !== "--");

/** Accept `--id=… --secret=…` or two bare positional arguments. */
function parseArgs(argv) {
  let id = "";
  let secret = "";
  for (const arg of argv) {
    if (arg.startsWith("--id=")) id = arg.slice("--id=".length);
    else if (arg.startsWith("--secret=")) secret = arg.slice("--secret=".length);
    else if (!id) id = arg;
    else if (!secret) secret = arg;
  }
  return { id: id.trim(), secret: secret.trim() };
}

const { id, secret } = parseArgs(args);

if (!id || !secret) {
  console.error(
    [
      "",
      "Usage:  npm run google:setup -- <client-id> <client-secret>",
      "",
      "  <client-id>      ends with .apps.googleusercontent.com",
      "  <client-secret>  starts with GOCSPX-",
      "",
      "Both come from Google Auth Platform > Clients.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

if (!id.endsWith(".apps.googleusercontent.com")) {
  console.error(
    `\nThat does not look like an OAuth client ID (${id}).\n` +
      "Web application client IDs end with .apps.googleusercontent.com.\n"
  );
  process.exit(1);
}

function setKey(text, key, value) {
  // Replaces an existing line whether it is live or still commented out, so
  // the placeholders in a fresh .env.local are upgraded in place.
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^#?\\s*${key}\\s*=.*$`, "m");
  return pattern.test(text)
    ? text.replace(pattern, line)
    : `${text.replace(/\s*$/, "")}\n${line}\n`;
}

let text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
text = setKey(text, "GOOGLE_CLIENT_ID", id);
text = setKey(text, "GOOGLE_CLIENT_SECRET", secret);
writeFileSync(ENV_FILE, text, "utf8");

console.log(
  [
    "",
    `  Wrote GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to ${path.relative(process.cwd(), ENV_FILE) || ".env.local"}`,
    "  (gitignored — it never enters the repository)",
    "",
    "  Next — both processes read it at startup, so restart them together:",
    "",
    "    npm run dev:all    # PowerShell: npm.cmd run dev:all",
    "",
    "  Then confirm Google sign-in is live before you click anything:",
    "",
    "    curl -s localhost:3000/fastapi/health | jq .data.google",
    "",
    "  You want configured: true and reachable: true. The button on",
    "  /signin/buyer and /signin/seller reports the same thing in words.",
    "",
  ].join("\n")
);
