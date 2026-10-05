import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { findByEmail } from "./accounts";
import type { Account } from "@/lib/types";

/**
 * Sessions are a signed cookie, not a database row.
 *
 * The app has no server-side session store to lose, and the payload is just an
 * account id — the account itself is always re-read from the accounts table, so
 * a revoked or edited account takes effect on the next request rather than when
 * the cookie expires.
 */

const COOKIE = "xmarket_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret(): string {
  const configured = process.env.XMARKET_SESSION_SECRET;
  if (configured) return configured;
  // Deliberately unstable: without a configured secret every restart logs
  // everyone out, which is the safe failure mode for a missing secret.
  return `dev-${process.env.DATABASE_URL ?? "json"}`;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function issueToken(accountId: string): string {
  return `${accountId}.${sign(accountId)}`;
}

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const accountId = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = sign(accountId);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return accountId;
}

export async function writeSession(account: Account): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, issueToken(account.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function currentAccountId(): Promise<string | null> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE)?.value);
}

/** The signed-in account, or null. Re-read every call so edits take effect. */
export async function currentAccount(): Promise<Account | null> {
  const id = await currentAccountId();
  if (!id) return null;
  const { listAccounts } = await import("./accounts");
  const all = await listAccounts();
  return all.find((a) => a.id === id) ?? null;
}

/**
 * Convenience for routes that only need to confirm a buyer is signed in.
 * Returns null for sellers and for anonymous callers alike.
 */
export async function currentBuyerId(): Promise<string | null> {
  const account = await currentAccount();
  return account?.role === "buyer" ? account.id : null;
}

export { findByEmail };
