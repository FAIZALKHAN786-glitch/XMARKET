import { Pool } from "pg";

/**
 * Seller reputation.
 *
 * The merchant account carries a performance score meant to rank a seller
 * against their peers. It was created at 50 and nothing ever moved it, and no
 * ranking read it — a field, not a mechanic. This is the mechanic.
 *
 * Scores move only on outcomes a buyer actually produced:
 *
 *   awarded            +5   the buyer chose this seller
 *   declined by buyer  -2   they were passed over
 *   shortlisted         0   no signal either way
 *
 * Deltas are small and clamped to 0..100, so one large contract cannot bury a
 * newcomer and a single rejection cannot erase a track record. The score
 * converges on observed behaviour rather than lurching with it.
 *
 * `providers` is a document table — id, name, rating, verified, doc — so the
 * score lives inside the `doc` jsonb and is updated with jsonb_set. There is no
 * performance_score column, and writing one would have been a silent no-op.
 *
 * Own pool, the way lib/server/session.ts does it: db.ts keeps its pool private.
 * Postgres only — with no DATABASE_URL there is no row to move, so every
 * function degrades to a no-op rather than throwing inside an award.
 */
let pool: Pool | null = null;

const MIN_SCORE = 0;
const MAX_SCORE = 100;
export const STARTING_SCORE = 50;

const DELTA: Record<string, number> = {
  accepted: 5,
  rejected: -2,
};

function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  return pool;
}

export async function applyBidOutcome(
  providerId: string,
  status: string
): Promise<{ providerId: string; before: number; after: number; delta: number } | null> {
  const delta = DELTA[status];
  if (delta === undefined) return null;

  const db = getPool();
  if (!db) return null;

  const current = await db.query<{ score: number | null }>(
    "SELECT (doc->>'performanceScore')::int AS score FROM providers WHERE id = $1",
    [providerId]
  );
  if (current.rows.length === 0) return null;

  const before = current.rows[0].score ?? STARTING_SCORE;
  const after = Math.min(MAX_SCORE, Math.max(MIN_SCORE, before + delta));
  if (after === before) return { providerId, before, after, delta: 0 };

  await db.query(
    `UPDATE providers
        SET doc = jsonb_set(doc, '{performanceScore}', to_jsonb($1::int))
      WHERE id = $2`,
    [after, providerId]
  );

  return { providerId, before, after, delta };
}

/** Every awarded or declined offer this seller has had — the audit trail. */
export async function reputationHistory(providerId: string) {
  const db = getPool();
  if (!db) return [];
  const { rows } = await db.query(
    // bids has no decided_at column — the decision time, when it is recorded
    // at all, sits inside the doc jsonb. created_at is always present, so it
    // orders the trail; decidedAt is surfaced only when something wrote it.
    `SELECT b.id,
            b.status,
            b.created_at,
            b.doc->>'decidedAt' AS decided_at,
            r.title
       FROM bids b
       JOIN requirements r ON r.id = b.requirement_id
      WHERE b.provider_id = $1
        AND b.status IN ('accepted','rejected')
      ORDER BY b.created_at DESC
      LIMIT 50`,
    [providerId]
  );
  return rows;
}
