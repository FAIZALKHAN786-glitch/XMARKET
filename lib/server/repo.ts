import { DEFAULT_WEIGHTS, compatibility, rankBids } from "@/lib/engine";
import type {
  Bid,
  BidStatus,
  Requirement,
  RequirementStatus,
  Score,
  Weights,
} from "@/lib/types";
import { getDb, mutate, type AuditEvent } from "./db";

/* ==========================================================================
   Repository — the only module the API routes talk to.
   Every mutation writes an audit event, so the activity feed and any future
   compliance view read from the same log.
   ========================================================================== */

const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function record(event: Omit<AuditEvent, "id" | "at">) {
  return mutate((db) => {
    const entry: AuditEvent = { id: uid("ev"), at: new Date().toISOString(), ...event };
    db.events.unshift(entry);
    db.events = db.events.slice(0, 500);
    return entry;
  });
}

/* ------------------------------------------------------------ requirements */

export async function listRequirements() {
  const db = await getDb();
  return db.requirements;
}

export async function getRequirement(id: string) {
  const db = await getDb();
  return db.requirements.find((r) => r.id === id);
}

export async function createRequirement(
  input: Omit<Requirement, "id" | "postedAt" | "views" | "status">,
  actor = "buyer"
) {
  const requirement = await mutate((db) => {
    const record: Requirement = {
      ...input,
      id: uid("r"),
      postedAt: new Date().toISOString(),
      views: 0,
      status: "open",
    };
    db.requirements.unshift(record);
    return record;
  });
  await record({
    type: "requirement.created",
    actor,
    requirementId: requirement.id,
    summary: `Posted “${requirement.title}”`,
    meta: { category: requirement.category, budgetMax: requirement.budgetMax },
  });
  return requirement;
}

export async function setRequirementStatus(id: string, status: RequirementStatus) {
  const updated = await mutate((db) => {
    const requirement = db.requirements.find((r) => r.id === id);
    if (!requirement) return undefined;
    requirement.status = status;
    return requirement;
  });
  if (updated) {
    await record({
      type: "requirement.status",
      actor: "buyer",
      requirementId: id,
      summary: `Requirement moved to ${status}`,
    });
  }
  return updated;
}

export async function incrementViews(id: string) {
  return mutate((db) => {
    const requirement = db.requirements.find((r) => r.id === id);
    if (requirement) requirement.views += 1;
    return requirement?.views;
  });
}

/* -------------------------------------------------------------------- bids */

export async function listBids() {
  const db = await getDb();
  return db.bids;
}

export async function getBid(id: string) {
  const db = await getDb();
  return db.bids.find((b) => b.id === id);
}

export async function listBidsForRequirement(requirementId: string) {
  const db = await getDb();
  return db.bids.filter((b) => b.requirementId === requirementId);
}

export async function createBid(
  requirementId: string,
  input: Omit<Bid, "id" | "createdAt" | "status" | "requirementId">,
  actor = "provider"
) {
  const bid = await mutate((db) => {
    const record: Bid = {
      ...input,
      id: uid("bid"),
      requirementId,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    db.bids.unshift(record);
    return record;
  });
  await record({
    type: "bid.created",
    actor,
    requirementId,
    bidId: bid.id,
    summary: `Offer submitted at ${bid.price} over ${bid.deliveryDays} days`,
    meta: { price: bid.price, deliveryDays: bid.deliveryDays },
  });
  return bid;
}

/**
 * Status changes are guarded: an awarded requirement cannot receive a second
 * acceptance, and accepting one offer rejects the rest atomically.
 */
export async function setBidStatus(
  id: string,
  status: BidStatus,
  actor = "buyer"
): Promise<
  | { ok: true; bid: Bid; rejectedSiblings: string[] }
  | { ok: false; code: "not_found" | "conflict"; message: string }
> {
  const result = await mutate((db) => {
    const bid = db.bids.find((b) => b.id === id);
    if (!bid) {
      return {
        ok: false as const,
        code: "not_found" as const,
        message: "Bid not found",
      };
    }

    const requirement = db.requirements.find((r) => r.id === bid.requirementId);
    const alreadyAwarded = db.bids.find(
      (b) => b.requirementId === bid.requirementId && b.status === "accepted"
    );

    if (status === "accepted" && alreadyAwarded && alreadyAwarded.id !== id) {
      return {
        ok: false as const,
        code: "conflict" as const,
        message: `This requirement was already awarded to ${alreadyAwarded.providerId}`,
      };
    }

    const rejectedSiblings: string[] = [];
    if (status === "accepted") {
      for (const other of db.bids) {
        if (other.requirementId === bid.requirementId && other.id !== id) {
          if (other.status !== "rejected") rejectedSiblings.push(other.id);
          other.status = "rejected";
        }
      }
      if (requirement) requirement.status = "awarded";
    } else if (requirement && requirement.status === "awarded") {
      // Reopening the decision returns the requirement to review.
      requirement.status = "reviewing";
    }

    bid.status = status;
    return { ok: true as const, bid, rejectedSiblings };
  });

  if (result.ok) {
    await record({
      type: "bid.status",
      actor,
      bidId: id,
      requirementId: result.bid.requirementId,
      summary:
        status === "accepted"
          ? `Offer accepted — ${result.rejectedSiblings.length} other offers declined`
          : `Offer ${status}`,
      meta: { status, rejectedSiblings: result.rejectedSiblings },
    });
  }
  return result;
}

/* --------------------------------------------------------------- providers */

export async function listProviders() {
  const db = await getDb();
  return db.providers;
}

export async function getProvider(id: string) {
  const db = await getDb();
  return db.providers.find((p) => p.id === id);
}

export async function listBuyers() {
  const db = await getDb();
  return db.buyers;
}

export async function getBuyer(id: string) {
  const db = await getDb();
  return db.buyers.find((b) => b.id === id);
}

/* ---------------------------------------------------------------- ranking */

export interface RankOptions {
  weights?: Weights;
  /** Semantic fit per bid id, produced by the AI scoring endpoint. */
  semantic?: Record<string, number>;
}

export interface RankedBid {
  bid: Bid;
  provider: Awaited<ReturnType<typeof listProviders>>[number] | undefined;
  score: Score;
  /** Present only when a semantic score was blended in. */
  semantic?: number;
}

/**
 * Ranking always happens on the server so the buyer's dashboard, the feed
 * badges and the API consumers cannot disagree about who is winning.
 */
export function rank(
  requirement: Requirement,
  bids: Bid[],
  providers: Awaited<ReturnType<typeof listProviders>>,
  options: RankOptions = {}
) {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const semantic = options.semantic;
  const w = weights.semantic ?? 0;

  const ranked: RankedBid[] = rankBids(bids, requirement, providers, {
    budget: weights.budget,
    timeline: weights.timeline,
    relevance: weights.relevance,
  }).map((row) => {
    const sem = semantic?.[row.bid.id];
    if (sem === undefined || w <= 0) return { ...row };

    // The AI factor is additive and opt-in: it never replaces the deterministic
    // factors, it only shifts the blend when a caller asks for it.
    const base = Math.max(0.0001, 1 - w);
    const total = Math.round(base * row.score.total + w * sem);
    return {
      ...row,
      score: {
        ...row.score,
        total,
        grade:
          total >= 85
            ? ("Excellent" as const)
            : total >= 72
              ? ("Strong" as const)
              : total >= 58
                ? ("Fair" as const)
                : ("Weak" as const),
      },
      semantic: sem,
    };
  });

  return ranked.sort((a, b) => b.score.total - a.score.total);
}

/* ----------------------------------------------------------------- events */

export async function listEvents(limit = 50) {
  const db = await getDb();
  return db.events.slice(0, limit);
}

/* -------------------------------------------------------------- AI cache */

export async function readCache<T>(key: string) {
  const db = await getDb();
  const hit = db.aiCache[key];
  if (!hit) return undefined;
  const age = Date.now() - new Date(hit.at).getTime();
  if (age > 1000 * 60 * 60 * 24 * 7) return undefined;
  return hit as { value: T; at: string; provider: string };
}

/**
 * Drops every cached model reply. Worth doing after switching provider, model
 * or API key — otherwise yesterday's answers keep being served as fresh.
 */
export async function clearAiCache() {
  return mutate((db) => {
    const dropped = Object.keys(db.aiCache).length;
    db.aiCache = {};
    return dropped;
  });
}

export async function writeCache(key: string, value: unknown, provider: string) {
  return mutate((db) => {
    db.aiCache[key] = { value, at: new Date().toISOString(), provider };
    const keys = Object.keys(db.aiCache);
    if (keys.length > 400) {
      // Cheap eviction: drop the oldest quarter.
      const sorted = keys.sort(
        (a, b) =>
          new Date(db.aiCache[a].at).getTime() -
          new Date(db.aiCache[b].at).getTime()
      );
      for (const k of sorted.slice(0, Math.floor(keys.length / 4))) {
        delete db.aiCache[k];
      }
    }
  });
}

export { record as recordEvent, uid };
export { compatibility };
