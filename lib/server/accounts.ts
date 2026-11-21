import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import path from "node:path";
import type { Account, AccountRole, CategoryId } from "@/lib/types";
import {
  CATEGORY_LABELS,
  DEMO_BUYER_ID,
  DEMO_PASSWORD,
  DEMO_SELLER_ACCOUNT_ID,
  buyerXMarketId,
  sellerXMarketId,
} from "@/lib/xmarket";

const ACCOUNTS_FILE = path.join(process.cwd(), "data", "accounts.json");
const BCRYPT_ROUNDS = 10;

async function readAll(): Promise<Account[]> {
  try {
    const raw = await fs.readFile(ACCOUNTS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Account[];
    const migrated = await migrate(parsed);
    if (migrated) await writeAll(parsed);
    return parsed;
  } catch {
    return [];
  }
}

/** Adds demo identities and fills fields created after the first release. */
async function migrate(accounts: Account[]): Promise<boolean> {
  let changed = false;
  const taken = new Set(accounts.map((a) => a.xMarketId).filter(Boolean));

  for (const account of accounts) {
    if (!account.username) {
      account.username = (account.email || account.displayName || "user")
        .split("@")[0]
        .replace(/[^a-zA-Z0-9_]/g, "")
        .slice(0, 20) || "user";
      changed = true;
    }
    if (!account.xMarketId) {
      account.xMarketId =
        account.role === "seller"
          ? sellerXMarketId(account.domain ?? account.shopCategory ?? "manufacturing", taken)
          : buyerXMarketId(taken);
      if (account.role === "seller") account.merchantId = account.xMarketId;
      taken.add(account.xMarketId);
      changed = true;
    }
    if (!account.displayName) {
      account.displayName = account.username;
      changed = true;
    }
  }

  if (!accounts.some((a) => a.id === DEMO_BUYER_ID)) {
    const hash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
    accounts.push({
      id: DEMO_BUYER_ID,
      role: "buyer",
      email: "demo@xmarket.local",
      username: "demo",
      xMarketId: "XM-BUYER-DEMO01",
      passwordHash: hash,
      displayName: "demo",
      company: "Demo Buyer",
      performanceScore: 50,
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }
  if (!accounts.some((a) => a.id === DEMO_SELLER_ACCOUNT_ID)) {
    const hash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);
    accounts.push({
      id: DEMO_SELLER_ACCOUNT_ID,
      role: "seller",
      email: "shop@xmarket.local",
      username: "shop",
      xMarketId: "XM-SELLER-MF-DEMO1",
      merchantId: "XM-SELLER-MF-DEMO1",
      passwordHash: hash,
      displayName: "Demo Workshop",
      shopName: "Demo Workshop",
      shopLocation: "Austin, TX",
      shopCategory: "manufacturing",
      domain: "manufacturing",
      performanceScore: 92,
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }
  return changed;
}

async function writeAll(accounts: Account[]): Promise<void> {
  await fs.mkdir(path.dirname(ACCOUNTS_FILE), { recursive: true });
  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf8");
}

export function publicAccount(a: Account) {
  const { passwordHash: _ignored, ...rest } = a;
  return {
    ...rest,
    displayName: a.shopName || a.displayName,
  };
}

export async function listAccounts(): Promise<Account[]> {
  return readAll();
}

export async function findAccount(predicate: (a: Account) => boolean): Promise<Account | null> {
  const all = await readAll();
  return all.find(predicate) ?? null;
}

export async function findByLogin(login: string): Promise<Account | null> {
  const needle = login.trim().toLowerCase();
  return findAccount(
    (a) =>
      a.username?.toLowerCase() === needle ||
      a.email.toLowerCase() === needle ||
      a.shopName?.toLowerCase() === needle
  );
}

export async function findByEmail(email: string): Promise<Account | null> {
  const needle = email.trim().toLowerCase();
  return findAccount((a) => a.email === needle);
}

export async function findByMerchantId(merchantId: string): Promise<Account | null> {
  const needle = merchantId.trim().toUpperCase();
  return findAccount((a) => a.merchantId === needle);
}

export async function findByXMarketId(xMarketId: string): Promise<Account | null> {
  const needle = xMarketId.trim().toUpperCase();
  return findAccount((a) => a.xMarketId.toUpperCase() === needle);
}

export async function createBuyer(input: { username: string; password: string }): Promise<Account> {
  const username = input.username.trim().toLowerCase();
  const accounts = await readAll();
  if (accounts.some((a) => a.username?.toLowerCase() === username)) {
    throw new AccountError("An account with that username already exists.");
  }

  const account: Account = {
    id: `acc_${Math.random().toString(36).slice(2, 14)}`,
    role: "buyer",
    email: `${username}@xmarket.local`,
    username,
    xMarketId: buyerXMarketId(new Set(accounts.map((a) => a.xMarketId))),
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    displayName: username,
    performanceScore: 50,
    createdAt: new Date().toISOString(),
  };

  await writeAll([...accounts, account]);
  return account;
}

export async function createSeller(input: {
  username: string;
  password: string;
  shopName: string;
  shopLocation: string;
  shopCategory: CategoryId;
}): Promise<Account> {
  const username = input.username.trim().toLowerCase();
  const accounts = await readAll();
  if (accounts.some((a) => a.username?.toLowerCase() === username)) {
    throw new AccountError("An account with that username already exists.");
  }

  const xMarketId = sellerXMarketId(
    input.shopCategory,
    new Set(accounts.map((a) => a.xMarketId))
  );
  const account: Account = {
    id: `acc_${Math.random().toString(36).slice(2, 14)}`,
    role: "seller",
    email: `${username}@xmarket.local`,
    username,
    xMarketId,
    merchantId: xMarketId,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    displayName: input.shopName.trim(),
    shopName: input.shopName.trim(),
    shopLocation: input.shopLocation.trim(),
    shopCategory: input.shopCategory,
    domain: input.shopCategory,
    merchantName: input.shopName.trim(),
    performanceScore: 50,
    createdAt: new Date().toISOString(),
  };

  await writeAll([...accounts, account]);
  return account;
}

export async function verifyPassword(account: Account, password: string): Promise<boolean> {
  return bcrypt.compare(password, account.passwordHash);
}

export async function updatePassword(accountId: string, newPassword: string): Promise<void> {
  const accounts = await readAll();
  const index = accounts.findIndex((a) => a.id === accountId);
  if (index === -1) throw new Error("Account not found.");

  const next = [...accounts];
  next[index] = { ...next[index], passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) };
  await writeAll(next);
}

export async function setBudgetResetAt(accountId: string, at: string): Promise<void> {
  const accounts = await readAll();
  await writeAll(
    accounts.map((a) => (a.id === accountId ? { ...a, budgetResetAt: at } : a))
  );
}

export function categoryName(category?: CategoryId): string {
  return category ? CATEGORY_LABELS[category] : "General";
}

export class AccountError extends Error {}
