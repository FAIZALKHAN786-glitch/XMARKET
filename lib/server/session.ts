import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { cookies, headers } from "next/headers";
import type { Account } from "@/lib/types";

/** Sessions are opaque random tokens stored in data/sessions.json. */

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

let pool: { get: () => Promise<SessionRow[]> } | null = null;

async function readAll(): Promise<SessionRow[]> {
  try {
    const raw = await fs.readFile(SESSIONS_FILE, "utf8");
    return JSON.parse(raw) as SessionRow[];
  } catch {
    return [];
  }
}

async function writeAll(rows: SessionRow[]): Promise<void> {
  await fs.mkdir(path.dirname(SESSIONS_FILE), { recursive: true });
  await fs.writeFile(SESSIONS_FILE, JSON.stringify(rows, null, 2), "utf8");
}

async function readSessionRow(token: string): Promise<SessionRow | null> {
  const all = await readAll();
  return all.find((s) => s.token === token) ?? null;
}

async function writeSessionRow(row: SessionRow): Promise<void> {
  const all = await readAll();
  await writeAll([...all.filter((s) => s.token !== row.token), row]);
}

async function markRevoked(token: string): Promise<void> {
  const now = new Date().toISOString();
  const all = await readAll();
  await writeAll(
    all.map((s) => (s.token === token && !s.revokedAt ? { ...s, revokedAt: now } : s))
  );
}

/** Ends every session for an account. */
export async function revokeAllFor(accountId: string): Promise<void> {
  const now = new Date().toISOString();
  const all = await readAll();
  await writeAll(
    all.map((s) => (s.accountId === accountId && !s.revokedAt ? { ...s, revokedAt: now } : s))
  );
}

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
  const { listAccounts } = await import("./accounts");
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

  return null;
}

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

export function sessionSecret(): string {
  const secret = process.env.XMARKET_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("XMARKET_SESSION_SECRET must be set in production.");
  }
  // Development only: sessions are invalidated on restart, never shared in prod.
  return "xmarket-local-development-only";
}
