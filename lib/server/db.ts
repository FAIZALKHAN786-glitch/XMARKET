import fs from "node:fs/promises";
import path from "node:path";
import { BIDS, BUYERS, ME_BUYER, PROVIDERS, REQUIREMENTS } from "@/lib/data";
import type { Bid, Buyer, Provider, Requirement } from "@/lib/types";
import { DEMO_BUYER_ID } from "@/lib/xmarket";

/* Persistence: single JSON document behind a serialised write queue. */

export interface AuditEvent {
  id: string;
  at: string;
  type: "requirement.created" | "requirement.status" | "bid.created" | "bid.status";
  actor: string;
  requirementId?: string;
  bidId?: string;
  summary: string;
  meta?: Record<string, unknown>;
}

export interface Database {
  version: number;
  buyers: Buyer[];
  providers: Provider[];
  requirements: Requirement[];
  bids: Bid[];
  events: AuditEvent[];
}

const DB_FILE = path.join(process.cwd(), "data", "xmarket.json");
const DB_VERSION = 1;

interface DbState {
  data: Database;
  ready: boolean;
  writable: boolean;
  queue: Promise<unknown>;
}

const globalRef = globalThis as unknown as { __xmarketDb?: DbState };

function seeded(): Database {
  // Demo data is the default so the marketplace works on first run.
  // Set XMARKET_SEED=empty to start with a blank ledger.
  const seed = (process.env.XMARKET_SEED ?? "demo").toLowerCase();
  const demo = !["empty", "off", "none"].includes(seed);

  if (!demo) {
    return {
      version: DB_VERSION,
      buyers: [],
      providers: [],
      requirements: [],
      bids: [],
      events: [
        {
          id: "ev_seed",
          at: new Date().toISOString(),
          type: "requirement.created",
          actor: "system",
          summary: "Started empty. Post a requirement or register.",
        },
      ],
    };
  }

  return {
    version: DB_VERSION,
    buyers: structuredClone(BUYERS).map((b) =>
      b.id === ME_BUYER ? { ...b, id: DEMO_BUYER_ID } : b
    ),
    providers: structuredClone(PROVIDERS),
    requirements: structuredClone(REQUIREMENTS).map((r) =>
      r.buyerId === ME_BUYER ? { ...r, buyerId: DEMO_BUYER_ID } : r
    ),
    bids: structuredClone(BIDS),
    events: [
      {
        id: "ev_seed",
        at: new Date().toISOString(),
        type: "requirement.created",
        actor: "system",
        summary: `Seeded ${REQUIREMENTS.length} requirements, ${BIDS.length} bids`,
      },
    ],
  };
}

async function loadFile(): Promise<Database> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Database;
    if (
      parsed?.version === DB_VERSION &&
      Array.isArray(parsed.requirements) &&
      (parsed.requirements.length > 0 || process.env.XMARKET_NO_SEED === "1")
    ) {
      return { ...parsed, events: parsed.events ?? [] };
    }
  } catch {
    /* first run, or a corrupt file */
  }
  return seeded();
}

async function persistFile(data: Database) {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, DB_FILE);
}

async function load(state: DbState) {
  const data = await loadFile();
  try {
    await persistFile(data);
    return { data, writable: true };
  } catch {
    return { data, writable: false };
  }
}

async function persist(state: DbState, data: Database) {
  return persistFile(data);
}

function state(): DbState {
  return (globalRef.__xmarketDb ??= {
    data: seeded(),
    ready: false,
    writable: false,
    queue: Promise.resolve(),
  });
}

export async function getDb(): Promise<Database> {
  const s = state();
  if (!s.ready) {
    const { data, writable } = await load(s);
    s.data = data;
    s.writable = writable;
    s.ready = true;
  }
  return s.data;
}

export function isWritable() {
  return globalRef.__xmarketDb?.writable ?? false;
}

export function dbPath() {
  return DB_FILE;
}

/** Serialises a read-modify-write cycle. */
export async function mutate<T>(
  fn: (db: Database) => T | Promise<T>,
  options: { persist?: boolean } = {}
): Promise<T> {
  const s = state();
  await getDb();

  const run = async () => {
    const result = await fn(s.data);
    if (options.persist !== false && s.writable) {
      try {
        await persist(s, s.data);
      } catch (error) {
        s.writable = false;
        console.warn("[xmarket] persistence disabled — in-memory only:", error);
      }
    }
    return result;
  };

  const next = s.queue.then(run, run);
  s.queue = next.catch(() => undefined);
  return next;
}

export async function resetDb() {
  return mutate((db) => {
    const fresh = seeded();
    Object.assign(db, fresh);
    return db;
  });
}

export function dbKind(): "json" {
  return "json";
}
