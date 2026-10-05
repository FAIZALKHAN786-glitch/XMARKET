import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { cookies, headers } from "next/headers";
import { dbKind } from "./db";
import { listAccounts } from "./accounts";
import type { Account } from "@/lib/types";

/**
 * Sessions are database rows, and the cookie holds only an opaque token.
 *
 * The earlier design was a stateless signed cookie: nothing to store, but also
 * nothing to revoke. Signing a user out deleted their cookie and left the token
 * valid until it expired, so a leaked cookie stayed usable and there was no way
 * to end every session for a compromised account.
 *
 * The token is now a random lookup key with no information in it. Revoking a
 * row ends the session immediately, on every device.
 */

const COOKIE = "xmarket_session";
/** Issued by the FastAPI OAuth2 service (Google sign-in / session upgrade). */
const JWT_COOKIE = "xmarket_jwt";
const JWT_ISSUER = "xmarket";
const JWT_AUDIENCE = "xmarket-api";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SESSIONS_FILE = path.join(process.cwd(), "data", "sessions.json");

type SessionRow = {
  token: string;
  accountId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  token       text PRIMARY KEY,
  account_id  text NOT NULL,
  created_at  timestamptz NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);
CREATE INDEX IF NOT EXISTS sessions_account_id_idx ON sessions (account_id);
`;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  }
  return pool;
}

/* ------------------------------------------------------------------ storage */

async function readSessionRow(token: string): Promise<SessionRow | null> {
  if (dbKind() === "postgres") {
    await getPool().query(SCHEMA);
    const { rows } = await getPool().query<SessionRow>(
      "SELECT token, account_id AS \"accountId\", created_at AS \"createdAt\", expires_at AS \"expiresAt\", revoked_at AS \"revokedAt\" FROM sessions WHERE token = $1",
      [token]
    );
    return rows[0] ?? null;
  }

  try {
    const raw = await fs.readFile(SESSIONS_FILE, "utf8");
    const all = JSON.parse(raw) as SessionRow[];
    return all.find((s) => s.token === token) ?? null;
  } catch {
    return null;
  }
}

async function writeSessionRow(row: SessionRow): Promise<void> {
  if (dbKind() === "postgres") {
    await getPool().query(SCHEMA);
    await getPool().query(
      `INSERT INTO sessions (token, account_id, created_at, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO NOTHING`,
      [row.token, row.accountId, row.createdAt, row.expiresAt]
    );
    return;
  }

  let all: SessionRow[] = [];
  try {
    all = JSON.parse(await fs.readFile(SESSIONS_FILE, "utf8")) as SessionRow[];
  } catch {
    /* first session */
  }
  await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true });
  await fs.writeFile(
    SESSIONS_FILE,
    JSON.stringify([...all.filter((s) => s.token !== row.token), row], null, 2),
    "utf8"
  );
}

async function markRevoked(token: string): Promise<void> {
  const now = new Date().toISOString();
  if (dbKind() === "postgres") {
    await getPool().query(SCHEMA);
    await getPool().query(
      "UPDATE sessions SET revoked_at = $1 WHERE token = $2 AND revoked_at IS NULL",
      [now, token]
    );
    return;
  }

  let all: SessionRow[] = [];
  try {
    all = JSON.parse(await fs.readFile(SESSIONS_FILE, "utf8")) as SessionRow[];
  } catch {
    return;
  }
  const next = all.map((s) =>
    s.token === token && !s.revokedAt ? { ...s, revokedAt: now } : s
  );
  await fs.writeFile(SESSIONS_FILE, JSON.stringify(next, null, 2), "utf8");
}

/** Ends every session for an account — use after a password change or a breach. */
export async function revokeAllFor(accountId: string): Promise<void> {
  const now = new Date().toISOString();
  if (dbKind() === "postgres") {
    await getPool().query(SCHEMA);
    await getPool().query(
      "UPDATE sessions SET revoked_at = $1 WHERE account_id = $2 AND revoked_at IS NULL",
      [now, accountId]
    );
    return;
  }

  let all: SessionRow[] = [];
  try {
    all = JSON.parse(await fs.readFile(SESSIONS_FILE, "utf8")) as SessionRow[];
  } catch {
    return;
  }
  const next = all.map((s) =>
    s.accountId === accountId && !s.revokedAt ? { ...s, revokedAt: now } : s
  );
  await fs.writeFile(SESSIONS_FILE, JSON.stringify(next, null, 2), "utf8");
}


/**
 * Mark the session cookie Secure when the request really arrived over TLS.
 *
 * Keying this off NODE_ENV meant a production build behind a local proxy, or a
 * preview over plain HTTP, would set a Secure cookie the browser then refused
 * to send — signing the user straight back out. Reading the forwarded protocol
 * means the flag follows the actual transport. XMARKET_FORCE_SECURE_COOKIES
 * overrides it for deployments where the proxy strips the header.
 */
async function cookieSecure(): Promise<boolean> {
  if (process.env.XMARKET_FORCE_SECURE_COOKIES === "true") return true;
  if (process.env.XMARKET_FORCE_SECURE_COOKIES === "false") return false;
  try {
    const h = await headers();
    const proto = h.get("x-forwarded-proto");
    if (proto) return proto.split(",")[0].trim() === "https";
  } catch {
    /* outside a request scope */
  }
  return false;
}

/* -------------------------------------------------------------------- reads */

function isValid(row: SessionRow | null): row is SessionRow {
  if (!row) return false;
  if (row.revokedAt) return false;
  return new Date(row.expiresAt).getTime() > Date.now();
}

export async function currentToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

/**
 * The signed-in account, or null. Re-read every call so revocation is instant.
 *
 * Two ways to be signed in:
 *   1. `xmarket_session` — an opaque token backed by a revocable session row
 *      (password login). Checked first, so its revocation semantics win.
 *   2. `xmarket_jwt` — a stateless HS256 bearer token issued by the FastAPI
 *      OAuth2 service (Google sign-in, or the one-time "session grant" that
 *      upgrades a password login to a bearer token). Valid until it expires.
 */
export async function currentAccount(): Promise<Account | null> {
  const store = await cookies();

  const token = store.get(COOKIE)?.value ?? null;
  if (token) {
    const row = await readSessionRow(token);
    if (isValid(row)) {
      const all = await listAccounts();
      const account = all.find((a) => a.id === row.accountId);
      if (account) return account;
    }
  }

  const jwt = store.get(JWT_COOKIE)?.value ?? null;
  if (jwt) {
    const sub = verifyJwt(jwt)?.sub;
    if (typeof sub === "string" && sub) {
      const all = await listAccounts();
      return all.find((a) => a.id === sub) ?? null;
    }
  }

  return null;
}

/* ------------------------------------------------- FastAPI-issued bearer JWT */

/**
 * The key the FastAPI service signs `xmarket_jwt` with. Same environment
 * chain, so a single `.env.local` configures both halves of the app.
 */
export function jwtSecret(): string {
  return (
    process.env.XMARKET_OAUTH2_SECRET ??
    process.env.JWT_SECRET ??
    process.env.XMARKET_SESSION_SECRET ??
    "unset-configure-me"
  );
}

function b64urlDecode(input: string): Buffer {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, "base64");
}

/**
 * Verify an HS256 JWT issued by the FastAPI service. Returns the claims on
 * success, or null on any failure. Hand-rolled (no dependency): the token is
 * a plain header.payload.signature, so HMAC-SHA256 over the first two parts
 * is the whole verification.
 */
export function verifyJwt(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string };
  try {
    header = JSON.parse(b64urlDecode(headerB64).toString("utf8"));
  } catch {
    return null;
  }
  if (header.alg !== "HS256") return null; // reject anything else outright

  const expected = createHmac("sha256", jwtSecret())
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  let provided: Buffer;
  try {
    provided = b64urlDecode(signatureB64);
  } catch {
    return null;
  }
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  if (claims.iss !== JWT_ISSUER) return null;
  const aud = claims.aud;
  if (aud !== JWT_AUDIENCE && !(Array.isArray(aud) && aud.includes(JWT_AUDIENCE))) {
    return null;
  }
  const exp = typeof claims.exp === "number" ? claims.exp : null;
  if (exp === null || exp * 1000 <= Date.now()) return null;
  return claims;
}

/* ------------------------------------------------------------------- writes */

export async function writeSession(account: Account): Promise<void> {
  const now = Date.now();
  const row: SessionRow = {
    token: randomBytes(32).toString("hex"),
    accountId: account.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + MAX_AGE_SECONDS * 1000).toISOString(),
    revokedAt: null,
  };
  await writeSessionRow(row);

  const store = await cookies();
  store.set(COOKIE, row.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const token = await currentToken();
  if (token) await markRevoked(token);
  const store = await cookies();
  store.delete(COOKIE);
  // The FastAPI-issued bearer token has no server-side row to revoke; dropping
  // the cookie ends it for this browser (it would otherwise stay valid until
  // expiry and keep the user signed in).
  store.delete(JWT_COOKIE);
}

/**
 * A stable secret is still worth having even though tokens are no longer
 * signed: it keys anything else that needs a server-side secret, and its
 * absence used to silently invalidate every session on restart.
 */
export function sessionSecret(): string {
  return process.env.XMARKET_SESSION_SECRET ?? "unset-configure-me";
}
