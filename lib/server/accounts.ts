import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import type { Account, AccountRole, CategoryId } from "@/lib/types";
import { dbKind } from "./db";

/**
 * Accounts live deliberately outside the main store.
 *
 * `resetDb()` wipes requirements, bids, providers and buyers so a demo can
 * start clean. Credentials must survive that — losing every password because
 * someone reset the marketplace would be indefensible — so accounts get their
 * own table (or their own JSON file) that reset never touches.
 */

const ACCOUNTS_FILE = path.join(process.cwd(), "data", "accounts.json");
const BCRYPT_ROUNDS = 10;

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return pool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id                text PRIMARY KEY,
  role              text NOT NULL,
  email             text NOT NULL UNIQUE,
  password_hash     text NOT NULL,
  display_name      text NOT NULL,
  company           text,
  merchant_id       text UNIQUE,
  merchant_name     text,
  shop_name         text,
  domain            text,
  performance_score integer NOT NULL DEFAULT 50,
  created_at        timestamptz NOT NULL DEFAULT now(),
  doc               jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS accounts_merchant_id_idx ON accounts (merchant_id);
`;

let schemaReady = false;

/* ------------------------------------------------------------------ storage */

async function readAll(): Promise<Account[]> {
  if (dbKind() === "postgres") {
    await getPool().query(SCHEMA);
    const { rows } = await getPool().query<{ doc: Account }>(
      "SELECT doc FROM accounts"
    );
    return rows.map((r) => r.doc);
  }

  try {
    const raw = await fs.readFile(ACCOUNTS_FILE, "utf8");
    return JSON.parse(raw) as Account[];
  } catch {
    return [];
  }
}

async function writeAll(accounts: Account[]): Promise<void> {
  if (dbKind() === "postgres") {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM accounts");
      for (const a of accounts) {
        await client.query(
          `INSERT INTO accounts
             (id, role, email, password_hash, display_name, company,
              merchant_id, merchant_name, shop_name, domain,
              performance_score, created_at, doc)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            a.id,
            a.role,
            a.email,
            a.passwordHash,
            a.displayName,
            a.company ?? null,
            a.merchantId ?? null,
            a.merchantName ?? null,
            a.shopName ?? null,
            a.domain ?? null,
            a.performanceScore,
            a.createdAt,
            JSON.stringify(a),
          ]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return;
  }

  await fs.mkdir(path.dirname(ACCOUNTS_FILE), { recursive: true });
  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf8");
}

/* ------------------------------------------------------------- merchant ids */

/** Two-letter domain code, so a merchant id reads as XM-SW-4821. */
const DOMAIN_CODES: Record<string, string> = {
  software: "SW",
  manufacturing: "MF",
  logistics: "LG",
  design: "DS",
  construction: "CN",
  electronics: "EL",
};

/**
 * Merchant ids are issued by the platform and never chosen by the seller.
 * The id is the handle the performance score hangs off, so it has to be stable
 * and collision-free — hence the uniqueness retry loop.
 */
export function newMerchantId(domain: CategoryId, taken: Set<string>): string {
  const code = DOMAIN_CODES[domain] ?? "GN";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const n = Math.floor(1000 + Math.random() * 9000);
    const id = `XM-${code}-${n}`;
    if (!taken.has(id)) return id;
  }
  // Practically unreachable, but never hand out a duplicate.
  return `XM-${code}-${Date.now().toString(36).toUpperCase()}`;
}

/* -------------------------------------------------------------------- reads */

export async function listAccounts(): Promise<Account[]> {
  return readAll();
}

export async function findAccount(
  predicate: (a: Account) => boolean
): Promise<Account | null> {
  const all = await readAll();
  return all.find(predicate) ?? null;
}

export async function findByEmail(email: string): Promise<Account | null> {
  const needle = email.trim().toLowerCase();
  return findAccount((a) => a.email === needle);
}

export async function findByMerchantId(
  merchantId: string
): Promise<Account | null> {
  const needle = merchantId.trim().toUpperCase();
  return findAccount((a) => a.merchantId === needle);
}

/* ------------------------------------------------------------------ writes */

/** Strips the hash before an account is ever sent to the browser. */
export function publicAccount(a: Account): Omit<Account, "passwordHash"> {
  const { passwordHash: _ignored, ...rest } = a;
  return rest;
}

export async function createBuyer(input: {
  email: string;
  password: string;
  displayName: string;
  company?: string;
}): Promise<Account> {
  const email = input.email.trim().toLowerCase();
  const accounts = await readAll();
  if (accounts.some((a) => a.email === email)) {
    throw new AccountError("An account with that email already exists.");
  }

  const account: Account = {
    id: `acc_${Math.random().toString(36).slice(2, 14)}`,
    role: "buyer",
    email,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    displayName: input.displayName.trim(),
    company: input.company?.trim() || undefined,
    performanceScore: 50,
    emailVerified: false,
    createdAt: new Date().toISOString(),
  };

  await writeAll([...accounts, account]);

  // Bridge into the marketplace so requirements this buyer posts resolve to a
  // readable name. Without it a seller's award notification shows a raw
  // account id instead of who actually finalised the offer.
  const { mutate } = await import("./db");
  await mutate((db) => {
    if (db.buyers.some((b) => b.id === account.id)) return null;
    db.buyers.unshift({
      id: account.id,
      name: account.displayName,
      company: account.company ?? "—",
      location: "—",
      initials: account.displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join(""),
      rating: 0,
      posted: 0,
      awarded: 0,
    });
    return null;
  });

  return account;
}

export async function createSeller(input: {
  email: string;
  password: string;
  merchantName: string;
  shopName: string;
  domain: CategoryId;
}): Promise<Account> {
  const email = input.email.trim().toLowerCase();
  const accounts = await readAll();
  if (accounts.some((a) => a.email === email)) {
    throw new AccountError("An account with that email already exists.");
  }

  const taken = new Set(
    accounts.map((a) => a.merchantId).filter((x): x is string => Boolean(x))
  );

  const account: Account = {
    id: `acc_${Math.random().toString(36).slice(2, 14)}`,
    role: "seller",
    email,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    displayName: input.shopName.trim(),
    merchantId: newMerchantId(input.domain, taken),
    merchantName: input.merchantName.trim(),
    shopName: input.shopName.trim(),
    domain: input.domain,
    // Every merchant starts level. The score moves with delivery outcomes, so
    // ranking reflects record rather than seniority.
    performanceScore: 50,
    emailVerified: false,
    createdAt: new Date().toISOString(),
  };

  await writeAll([...accounts, account]);

  // Bridge into the marketplace: the merchant ID must resolve as a provider or
  // every bid this seller places is rejected as an unknown provider.
  const { createProvider } = await import("./repo");
  await createProvider({
    id: account.merchantId!,
    name: account.shopName!,
    tagline: `${account.merchantName} — ${input.domain}`,
    location: "—",
    initials: account.shopName!
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join(""),
    categories: [input.domain],
    skills: [],
    // A new merchant has no record yet, so nothing is asserted: zero reviews,
    // zero completed jobs. The performance score starts level at 50.
    rating: 0,
    reviews: 0,
    completedJobs: 0,
    onTimeRate: 1,
    responseHours: 24,
    verified: false,
    memberSince: new Date().getFullYear(),
  });

  return account;
}

export async function verifyPassword(
  account: Account,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, account.passwordHash);
}

export class AccountError extends Error {}

/* ------------------------------------------------------- password management */

const RESET_SCHEMA = `
CREATE TABLE IF NOT EXISTS password_resets (
  token       text PRIMARY KEY,
  account_id  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
`;

const RESET_TTL_MS = 1000 * 60 * 30;

async function ensureResetTable(): Promise<void> {
  if (dbKind() === "postgres") await getPool().query(RESET_SCHEMA);
}

/**
 * Replace a password. Hashed with the same cost as registration.
 *
 * Callers are expected to revoke sessions afterwards — a password change is
 * exactly when every other device should be logged out.
 */
export async function updatePassword(
  accountId: string,
  newPassword: string
): Promise<void> {
  const accounts = await readAll();
  const index = accounts.findIndex((a) => a.id === accountId);
  if (index === -1) throw new AccountError("Account not found.");

  const next = [...accounts];
  next[index] = {
    ...next[index],
    passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
  };
  await writeAll(next);
}

/**
 * Issue a single-use reset token.
 *
 * The token is returned to the caller because there is no mail transport wired
 * up yet. In production this belongs in an email and the endpoint should return
 * nothing but a confirmation either way, so that it cannot be used to discover
 * which addresses are registered.
 */
export async function createResetToken(email: string): Promise<string | null> {
  const account = await findByEmail(email);
  if (!account) return null;

  await ensureResetTable();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();

  if (dbKind() === "postgres") {
    await getPool().query(
      "INSERT INTO password_resets (token, account_id, expires_at) VALUES ($1,$2,$3)",
      [token, account.id, expiresAt]
    );
  } else {
    const file = path.join(process.cwd(), "data", "password-resets.json");
    let all: { token: string; accountId: string; expiresAt: string; usedAt: string | null }[] = [];
    try {
      all = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      /* first token */
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(
      file,
      JSON.stringify([...all, { token, accountId: account.id, expiresAt, usedAt: null }], null, 2),
      "utf8"
    );
  }
  return token;
}

/** Consume a reset token. Returns the account id, or null if it is not usable. */
export async function consumeResetToken(token: string): Promise<string | null> {
  await ensureResetTable();
  const now = new Date().toISOString();

  if (dbKind() === "postgres") {
    const { rows } = await getPool().query<{ accountId: string }>(
      `UPDATE password_resets SET used_at = $1
        WHERE token = $2 AND used_at IS NULL AND expires_at > now()
        RETURNING account_id AS "accountId"`,
      [now, token]
    );
    return rows[0]?.accountId ?? null;
  }

  const file = path.join(process.cwd(), "data", "password-resets.json");
  let all: { token: string; accountId: string; expiresAt: string; usedAt: string | null }[] = [];
  try {
    all = JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
  const hit = all.find(
    (r) => r.token === token && !r.usedAt && new Date(r.expiresAt).getTime() > Date.now()
  );
  if (!hit) return null;

  const next = all.map((r) => (r.token === token ? { ...r, usedAt: now } : r));
  await fs.writeFile(file, JSON.stringify(next, null, 2), "utf8");
  return hit.accountId;
}

/* ------------------------------------------------------ email verification */

const VERIFY_SCHEMA = `
CREATE TABLE IF NOT EXISTS email_verifications (
  token       text PRIMARY KEY,
  account_id  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);
`;

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24;

type VerifyRow = {
  token: string;
  accountId: string;
  expiresAt: string;
  usedAt: string | null;
};

const VERIFY_FILE = () =>
  path.join(process.cwd(), "data", "email-verifications.json");

/**
 * Issue an email-verification token.
 *
 * Same shape as the password reset: single use, time limited, and the token is
 * returned to the caller because no mail transport exists yet. In production
 * this goes in the email and the endpoint returns only a confirmation.
 */
export async function createVerificationToken(
  email: string
): Promise<string | null> {
  const account = await findByEmail(email);
  if (!account) return null;

  if (dbKind() === "postgres") {
    await getPool().query(VERIFY_SCHEMA);
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + VERIFY_TTL_MS).toISOString();
    await getPool().query(
      "INSERT INTO email_verifications (token, account_id, expires_at) VALUES ($1,$2,$3)",
      [token, account.id, expiresAt]
    );
    return token;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFY_TTL_MS).toISOString();
  let all: VerifyRow[] = [];
  try {
    all = JSON.parse(await fs.readFile(VERIFY_FILE(), "utf8"));
  } catch {
    /* first token */
  }
  await fs.mkdir(path.dirname(VERIFY_FILE()), { recursive: true });
  await fs.writeFile(
    VERIFY_FILE(),
    JSON.stringify([...all, { token, accountId: account.id, expiresAt, usedAt: null }], null, 2),
    "utf8"
  );
  return token;
}

/** Consume a verification token and mark the account verified. */
export async function consumeVerificationToken(
  token: string
): Promise<string | null> {
  const now = new Date().toISOString();
  let accountId: string | null = null;

  if (dbKind() === "postgres") {
    await getPool().query(VERIFY_SCHEMA);
    const { rows } = await getPool().query<{ accountId: string }>(
      `UPDATE email_verifications SET used_at = $1
        WHERE token = $2 AND used_at IS NULL AND expires_at > now()
        RETURNING account_id AS "accountId"`,
      [now, token]
    );
    accountId = rows[0]?.accountId ?? null;
  } else {
    let all: VerifyRow[] = [];
    try {
      all = JSON.parse(await fs.readFile(VERIFY_FILE(), "utf8"));
    } catch {
      return null;
    }
    const hit = all.find(
      (r) => r.token === token && !r.usedAt && new Date(r.expiresAt).getTime() > Date.now()
    );
    if (!hit) return null;
    accountId = hit.accountId;
    const next = all.map((r) => (r.token === token ? { ...r, usedAt: now } : r));
    await fs.writeFile(VERIFY_FILE(), JSON.stringify(next, null, 2), "utf8");
  }

  if (!accountId) return null;

  const accounts = await readAll();
  const index = accounts.findIndex((a) => a.id === accountId);
  if (index === -1) return null;
  const next = [...accounts];
  next[index] = { ...next[index], emailVerified: true };
  await writeAll(next);
  return accountId;
}
