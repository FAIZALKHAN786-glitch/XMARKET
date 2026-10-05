import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { BIDS, BUYERS, PROVIDERS, REQUIREMENTS } from "@/lib/data";
import type { Bid, Buyer, Provider, Requirement } from "@/lib/types";

/* ==========================================================================
   Persistence layer

   Two backends behind one interface:

     DATABASE_URL set   Postgres. Real tables, foreign keys, indexes, and
                        transactions. This is what a deployment should use.
     otherwise          The original single JSON document, so a fresh clone
                        still runs with no database to install.

   Either way `repo.ts` sees the same `Database` object and the same
   read-modify-write contract through `mutate()`, so none of the ranking,
   import or de-duplication logic knows which one is underneath.

   Rows are stored as a typed column set plus a `doc` jsonb that holds the
   full record. The columns are what you index, join and query on; the doc is
   the source of truth for the object shape the rest of the app consumes, so
   adding a field to a type never needs a migration.
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
    | "provider.created"
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

/** Set a connection string to use Postgres instead of the JSON file. */
const DATABASE_URL = process.env.DATABASE_URL ?? "";

interface DbState {
  data: Database;
  ready: boolean;
  writable: boolean;
  queue: Promise<unknown>;
  pool?: pg.Pool;
}

// Reused across hot reloads in dev, otherwise every module instance would
// hold its own copy and writes would clobber each other.
const globalRef = globalThis as unknown as { __xmarketDb?: DbState };

/* ------------------------------------------------------------------ schema */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS buyers (
  id  text PRIMARY KEY,
  doc jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS providers (
  id        text PRIMARY KEY,
  name      text NOT NULL,
  rating    numeric NOT NULL,
  verified  boolean NOT NULL,
  doc       jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS requirements (
  id         text PRIMARY KEY,
  title      text NOT NULL,
  category   text NOT NULL,
  status     text NOT NULL,
  budget_max numeric NOT NULL,
  posted_at  timestamptz NOT NULL,
  closes_at  timestamptz NOT NULL,
  doc        jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS bids (
  id             text PRIMARY KEY,
  requirement_id text NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  provider_id    text NOT NULL,
  price          numeric NOT NULL,
  status         text NOT NULL,
  created_at     timestamptz NOT NULL,
  doc            jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS bids_requirement_id_idx ON bids (requirement_id);
CREATE INDEX IF NOT EXISTS requirements_status_idx ON requirements (status);
CREATE INDEX IF NOT EXISTS requirements_category_idx ON requirements (category);

CREATE TABLE IF NOT EXISTS events (
  id  text PRIMARY KEY,
  at  timestamptz NOT NULL,
  doc jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS events_at_idx ON events (at DESC);

CREATE TABLE IF NOT EXISTS ai_cache (
  key      text PRIMARY KEY,
  value    jsonb NOT NULL,
  at       timestamptz NOT NULL,
  provider text NOT NULL
);

CREATE TABLE IF NOT EXISTS store_meta (
  k text PRIMARY KEY,
  v text NOT NULL
);
`;

/* ------------------------------------------------------------------- pool */

async function pool(state: DbState): Promise<pg.Pool> {
  if (!state.pool) {
    state.pool = new pg.Pool({
      connectionString: DATABASE_URL,
      max: Number(process.env.PGPOOL_MAX ?? 10),
    });
    await state.pool.query(SCHEMA);
  }
  return state.pool;
}

/* ------------------------------------------------------------------- seed */

/**
 * Seeding is opt-in and the default is an empty store: a marketplace should
 * show records that were actually posted or imported, not fabricated ones.
 *
 *   (unset)              empty — no buyers, providers, requirements or bids
 *   XMARKET_SEED=parties the people who can trade (buyers + providers) but no
 *                        requirements and no bids. Use this to demonstrate a
 *                        buyer workflow from a clean slate: nothing is
 *                        invented about procurement activity, and there is
 *                        somebody for the offers to come from.
 *   XMARKET_SEED=demo    the full invented demo dataset
 *
 * Categories are taxonomy rather than demo data, so they stay in lib/data.ts
 * and are never part of the store.
 */
function seeded(): Database {
  const seed = (process.env.XMARKET_SEED ?? "").toLowerCase();
  const demo = seed === "demo";
  const parties = seed === "parties";

  if (!demo && !parties) {
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
          summary: "Started empty. Post a requirement or run npm run data:import.",
        },
      ],
      aiCache: {},
    };
  }

  if (parties) {
    return {
      version: DB_VERSION,
      buyers: structuredClone(BUYERS),
      providers: structuredClone(PROVIDERS),
      requirements: [],
      bids: [],
      events: [
        {
          id: "ev_seed",
          at: new Date().toISOString(),
          type: "db.seeded",
          actor: "system",
          summary: `Started with ${BUYERS.length} buyers and ${PROVIDERS.length} providers, but no requirements or offers`,
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

/* --------------------------------------------------------------- postgres */

async function loadPg(state: DbState): Promise<Database> {
  const p = await pool(state);
  const [buyers, providers, requirements, bids, events, cache] =
    await Promise.all([
      p.query("SELECT doc FROM buyers"),
      p.query("SELECT doc FROM providers"),
      p.query("SELECT doc FROM requirements ORDER BY posted_at DESC"),
      p.query("SELECT doc FROM bids ORDER BY created_at DESC"),
      p.query("SELECT doc FROM events ORDER BY at DESC"),
      p.query("SELECT key, value, at, provider FROM ai_cache"),
    ]);

  const aiCache: Record<string, CacheEntry> = {};
  for (const row of cache.rows) {
    aiCache[row.key] = { value: row.value, at: row.at.toISOString(), provider: row.provider };
  }

  return {
    version: DB_VERSION,
    buyers: buyers.rows.map((r) => r.doc),
    providers: providers.rows.map((r) => r.doc),
    requirements: requirements.rows.map((r) => r.doc),
    bids: bids.rows.map((r) => r.doc),
    events: events.rows.map((r) => r.doc),
    aiCache,
  };
}

/** Replaces the stored rows with `data`, in one transaction. */
async function persistPg(state: DbState, data: Database) {
  const p = await pool(state);
  const client = await p.connect();
  try {
    await client.query("BEGIN");

    // Children first, then parents — bids carry a foreign key to requirements.
    await client.query("DELETE FROM bids WHERE id <> ALL($1::text[])", [
      data.bids.map((b) => b.id),
    ]);
    await client.query("DELETE FROM requirements WHERE id <> ALL($1::text[])", [
      data.requirements.map((r) => r.id),
    ]);
    await client.query("DELETE FROM providers WHERE id <> ALL($1::text[])", [
      data.providers.map((x) => x.id),
    ]);
    await client.query("DELETE FROM buyers WHERE id <> ALL($1::text[])", [
      data.buyers.map((x) => x.id),
    ]);
    await client.query("DELETE FROM events WHERE id <> ALL($1::text[])", [
      data.events.map((x) => x.id),
    ]);
    await client.query("DELETE FROM ai_cache WHERE key <> ALL($1::text[])", [
      Object.keys(data.aiCache),
    ]);

    for (const b of data.buyers) {
      await client.query(
        `INSERT INTO buyers (id, doc) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc`,
        [b.id, JSON.stringify(b)]
      );
    }
    for (const x of data.providers) {
      await client.query(
        `INSERT INTO providers (id, name, rating, verified, doc) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, rating = EXCLUDED.rating,
           verified = EXCLUDED.verified, doc = EXCLUDED.doc`,
        [x.id, x.name, x.rating, x.verified, JSON.stringify(x)]
      );
    }
    for (const r of data.requirements) {
      await client.query(
        `INSERT INTO requirements
           (id, title, category, status, budget_max, posted_at, closes_at, doc)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title, category = EXCLUDED.category,
           status = EXCLUDED.status, budget_max = EXCLUDED.budget_max,
           posted_at = EXCLUDED.posted_at, closes_at = EXCLUDED.closes_at,
           doc = EXCLUDED.doc`,
        [
          r.id, r.title, r.category, r.status, r.budgetMax,
          r.postedAt, r.closesAt, JSON.stringify(r),
        ]
      );
    }
    for (const b of data.bids) {
      await client.query(
        `INSERT INTO bids
           (id, requirement_id, provider_id, price, status, created_at, doc)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET
           requirement_id = EXCLUDED.requirement_id,
           provider_id = EXCLUDED.provider_id, price = EXCLUDED.price,
           status = EXCLUDED.status, created_at = EXCLUDED.created_at,
           doc = EXCLUDED.doc`,
        [
          b.id, b.requirementId, b.providerId, b.price,
          b.status, b.createdAt, JSON.stringify(b),
        ]
      );
    }
    for (const e of data.events) {
      await client.query(
        `INSERT INTO events (id, at, doc) VALUES ($1,$2,$3)
         ON CONFLICT (id) DO UPDATE SET at = EXCLUDED.at, doc = EXCLUDED.doc`,
        [e.id, e.at, JSON.stringify(e)]
      );
    }
    for (const [key, entry] of Object.entries(data.aiCache)) {
      await client.query(
        `INSERT INTO ai_cache (key, value, at, provider) VALUES ($1,$2,$3,$4)
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value, at = EXCLUDED.at, provider = EXCLUDED.provider`,
        [key, JSON.stringify(entry.value), entry.at, entry.provider]
      );
    }

    await client.query(
      `INSERT INTO store_meta (k, v) VALUES ('version', $1)
       ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v`,
      [String(data.version)]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/* ------------------------------------------------------------- json file */

async function loadFile(): Promise<Database> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Database;
    if (parsed?.version === DB_VERSION && Array.isArray(parsed.requirements)) {
      return {
        ...parsed,
        events: parsed.events ?? [],
        aiCache: parsed.aiCache ?? {},
      };
    }
  } catch {
    /* first run, or a corrupt file we are about to replace */
  }
  return seeded();
}

async function persistFile(data: Database) {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, DB_FILE);
}

/* --------------------------------------------------------------- dispatch */

async function load(state: DbState): Promise<{ data: Database; writable: boolean }> {
  if (DATABASE_URL) {
    const data = await loadPg(state);
    // First boot against an empty database: write the seed so store_meta
    // exists and the audit log has its opening entry.
    if (data.requirements.length === 0 && data.events.length === 0) {
      const fresh = seeded();
      await persistPg(state, fresh);
      return { data: fresh, writable: true };
    }
    return { data, writable: true };
  }

  const data = await loadFile();
  try {
    await persistFile(data);
    return { data, writable: true };
  } catch {
    // Read-only filesystem (some serverless targets). Serve from memory and
    // report it honestly through /api/health.
    return { data, writable: false };
  }
}

async function persist(state: DbState, data: Database) {
  if (DATABASE_URL) return persistPg(state, data);
  return persistFile(data);
}

/* ------------------------------------------------------------------ public */

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

/** What the store is backed by, for /api/health. Never leaks credentials. */
export function dbPath() {
  if (DATABASE_URL) {
    try {
      const u = new URL(DATABASE_URL);
      return `postgres://${u.host}${u.pathname}`;
    } catch {
      return "postgres://(unparseable DATABASE_URL)";
    }
  }
  return DB_FILE;
}

export function dbKind(): "postgres" | "json" {
  return DATABASE_URL ? "postgres" : "json";
}

/**
 * Serialises a read-modify-write cycle. Every mutation goes through here so
 * two concurrent requests can never interleave their reads.
 */
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
        console.warn(
          "[xmarket] persistence disabled — writes are now in-memory only:",
          error instanceof Error ? error.message : error
        );
      }
    }
    return result;
  };

  const next = s.queue.then(run, run);
  // Keep the chain alive even if a caller's promise rejects.
  s.queue = next.catch(() => undefined);
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
