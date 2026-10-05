import bcrypt from "bcryptjs";
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
    createdAt: new Date().toISOString(),
  };

  await writeAll([...accounts, account]);
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
    createdAt: new Date().toISOString(),
  };

  await writeAll([...accounts, account]);
  return account;
}

export async function verifyPassword(
  account: Account,
  password: string
): Promise<boolean> {
  return bcrypt.compare(password, account.passwordHash);
}

export class AccountError extends Error {}
