import fs from "node:fs/promises";
import path from "node:path";
import { BIDS, BUYERS, PROVIDERS, REQUIREMENTS } from "@/lib/data";
import type { Bid, Buyer, Provider, Requirement } from "@/lib/types";

/* ==========================================================================
   Persistence layer
   A single JSON document behind a serialised write queue. It is deliberately
   boring: no native deps, no service to run, and it survives restarts. The
   repository API in ./repo.ts is the only thing the routes touch, so swapping
   this file for Postgres means reimplementing one module.
   ========================================================================== */

export interface AuditEvent {
  id: string;
  at: string;
  type:
    | "requirement.created"
    | "requirement.status"
    | "bid.created"
    | "bid.status"
    | "ai.invoked"
    | "db.seeded";
  actor: string;
  requirementId?: string;
  bidId?: string;
  summary: string;
  meta?: Record<string, unknown>;
}

export interface CacheEntry {
  value: unknown;
  at: string;
  provider: string;
}

export interface Database {
  version: number;
  buyers: Buyer[];
  providers: Provider[];
  requirements: Requirement[];
  bids: Bid[];
  events: AuditEvent[];
  aiCache: Record<string, CacheEntry>;
}

const DB_FILE = process.env.XMARKET_DB_FILE
  ? path.resolve(process.env.XMARKET_DB_FILE)
  : path.join(process.cwd(), "data", "xmarket.json");
const DB_VERSION = 1;

interface DbState {
  data: Database;
  ready: boolean;
  writable: boolean;
  queue: Promise<unknown>;
}

// Reused across hot reloads in dev, otherwise every module instance would
// hold its own copy and writes would clobber each other.
const globalRef = globalThis as unknown as { __xmarketDb?: DbState };

/**
 * `XMARKET_SEED=empty` boots with nothing but the schema, for deployments that
 * only want records that were actually posted or imported. Anything else keeps
 * the demo dataset, which is what makes a fresh clone worth looking at.
 */
function seeded(): Database {
  if ((process.env.XMARKET_SEED ?? "").toLowerCase() === "empty") {
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
          type: "db.seeded",
          actor: "system",
          summary: "Started with an empty store (XMARKET_SEED=empty)",
        },
      ],
      aiCache: {},
    };
  }

  return {
    version: DB_VERSION,
    buyers: structuredClone(BUYERS),
    providers: structuredClone(PROVIDERS),
    requirements: structuredClone(REQUIREMENTS),
    bids: structuredClone(BIDS),
    events: [
      {
        id: "ev_seed",
        at: new Date().toISOString(),
        type: "db.seeded",
        actor: "system",
        summary: `Seeded ${REQUIREMENTS.length} requirements, ${BIDS.length} offers and ${PROVIDERS.length} providers`,
      },
    ],
    aiCache: {},
  };
}

async function load(): Promise<{ data: Database; writable: boolean }> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Database;
    if (parsed?.version === DB_VERSION && Array.isArray(parsed.requirements)) {
      return {
        data: {
          ...parsed,
          events: parsed.events ?? [],
          aiCache: parsed.aiCache ?? {},
        },
        writable: true,
      };
    }
  } catch {
    /* first run, or a corrupt file we are about to replace */
  }

  const data = seeded();
  try {
    await persist(data);
    return { data, writable: true };
  } catch {
    // Read-only filesystem (some serverless targets). Serve from memory and
    // report it honestly through /api/health.
    return { data, writable: false };
  }
}

async function persist(data: Database) {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, DB_FILE);
}

export async function getDb(): Promise<Database> {
  const state = (globalRef.__xmarketDb ??= {
    data: seeded(),
    ready: false,
    writable: false,
    queue: Promise.resolve(),
  });

  if (!state.ready) {
    const { data, writable } = await load();
    state.data = data;
    state.writable = writable;
    state.ready = true;
  }
  return state.data;
}

export function isWritable() {
  return globalRef.__xmarketDb?.writable ?? false;
}

export function dbPath() {
  return DB_FILE;
}

/**
 * Serialises a read-modify-write cycle. Every mutation goes through here so
 * two concurrent requests can never interleave their reads.
 */
export async function mutate<T>(
  fn: (db: Database) => T | Promise<T>,
  options: { persist?: boolean } = {}
): Promise<T> {
  const state = (globalRef.__xmarketDb ??= {
    data: seeded(),
    ready: false,
    writable: false,
    queue: Promise.resolve(),
  });

  await getDb();

  const run = async () => {
    const result = await fn(state.data);
    if (options.persist !== false && state.writable) {
      try {
        await persist(state.data);
      } catch (error) {
        state.writable = false;
        console.warn(
          "[xmarket] persistence disabled — writes are now in-memory only:",
          error instanceof Error ? error.message : error
        );
      }
    }
    return result;
  };

  const next = state.queue.then(run, run);
  // Keep the chain alive even if a caller's promise rejects.
  state.queue = next.catch(() => undefined);
  return next;
}

/** Development helper used by POST /api/admin/reset. */
export async function resetDb() {
  return mutate((db) => {
    const fresh = seeded();
    Object.assign(db, fresh);
    return db;
  });
}
