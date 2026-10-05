import { randomBytes } from "node:crypto";
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

/** The signed-in account, or null. Re-read every call so revocation is instant. */
export async function currentAccount(): Promise<Account | null> {
  const token = await currentToken();
  if (!token) return null;

  const row = await readSessionRow(token);
  if (!isValid(row)) return null;

  const all = await listAccounts();
  return all.find((a) => a.id === row.accountId) ?? null;
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
}

/**
 * A stable secret is still worth having even though tokens are no longer
 * signed: it keys anything else that needs a server-side secret, and its
 * absence used to silently invalidate every session on restart.
 */
export function sessionSecret(): string {
  return process.env.XMARKET_SESSION_SECRET ?? "unset-configure-me";
}
