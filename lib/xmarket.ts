import type { CategoryId } from "./types";

export const DEMO_BUYER_ID = "acc_demo_buyer";
/** Provider row id and public ID for the seeded seller. */
export const DEMO_SELLER_ID = "XM-SELLER-MF-DEMO1";
export const DEMO_SELLER_ACCOUNT_ID = "acc_demo_seller";
export const DEMO_PASSWORD = "demo1234";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  manufacturing: "Manufacturing",
  electronics: "Electronics",
  logistics: "Logistics",
  design: "Design",
  construction: "Construction",
  software: "Software",
};

export const CATEGORY_CODES: Record<CategoryId, string> = {
  manufacturing: "MF",
  electronics: "EL",
  logistics: "LG",
  design: "DS",
  construction: "CN",
  software: "SW",
};

export const CATEGORY_IDS = Object.keys(CATEGORY_LABELS) as CategoryId[];

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function idSuffix(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function buyerXMarketId(taken: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const id = `XM-BUYER-${idSuffix()}`;
    if (!taken.has(id)) return id;
  }
  return `XM-BUYER-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export function sellerXMarketId(category: CategoryId, taken: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const id = `XM-SELLER-${CATEGORY_CODES[category] ?? "GN"}-${idSuffix()}`;
    if (!taken.has(id)) return id;
  }
  return `XM-SELLER-${CATEGORY_CODES[category] ?? "GN"}-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/** Stable display ID for seeded providers that have no user account. */
export function providerXMarketId(providerId: string, category?: CategoryId): string {
  let hash = 0;
  for (let i = 0; i < providerId.length; i += 1) hash = (hash * 31 + providerId.charCodeAt(i)) >>> 0;
  const code = CATEGORY_CODES[category ?? "manufacturing"] ?? "GN";
  const suffix = hash.toString(36).toUpperCase().padStart(6, "0").slice(-6);
  return `XM-SELLER-${code}-${suffix}`;
}

export function money(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function gradeFor(score: number): string {
  if (score >= 85) return "A";
  if (score >= 72) return "B";
  if (score >= 58) return "C";
  return "D";
}
