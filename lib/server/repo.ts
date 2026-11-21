import { DEFAULT_WEIGHTS, compatibility, rankBids } from "@/lib/engine";
import type { Bid, BidStatus, Provider, Requirement, RequirementStatus, Weights } from "@/lib/types";
import { getDb, mutate, type AuditEvent } from "./db";

const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

async function record(event: Omit<AuditEvent, "id" | "at">) {
  const entry = await mutate((db) => {
    const created: AuditEvent = {
      id: uid("ev"),
      at: new Date().toISOString(),
      ...event,
    };
    db.events.unshift(created);
    db.events = db.events.slice(0, 200);
    return created;
  });
  return entry;
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
      return { ok: false as const, code: "not_found" as const, message: "Bid not found" };
    }

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
      summary: status === "accepted" ? `Offer accepted — ${result.rejectedSiblings.length} declined` : `Offer ${status}`,
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

export async function createProvider(input: Omit<Provider, "id"> & { id: string }): Promise<Provider> {
  const existing = await getProvider(input.id);
  if (existing) return existing;

  const provider = await mutate((db) => {
    const record: Provider = { ...input };
    db.providers.unshift(record);
    return record;
  });
  await record({
    type: "requirement.created",
    actor: "system",
    summary: `Provider ${provider.name} registered`,
    meta: { providerId: provider.id },
  });
  return provider;
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
  semantic?: Record<string, number>;
}

export interface RankedBid {
  bid: Bid;
  provider: Provider | undefined;
  score: ReturnType<typeof compatibility>;
  semantic?: number;
}

export function rank(
  requirement: Requirement,
  bids: Bid[],
  providers: Provider[],
  options: RankOptions = {}
) {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const semantic = options.semantic;
  const w = weights.semantic ?? 0;

  const ranked: RankedBid[] = rankBids(bids, requirement, providers, weights).map((row) => {
    const sem = semantic?.[row.bid.id];
    if (sem === undefined || w <= 0) return { ...row };

    const base = Math.max(0.0001, 1 - w);
    const total = Math.round(base * row.score.total + w * sem);
    return {
      ...row,
      score: { ...row.score, total },
      semantic: sem,
    };
  });

  return ranked.sort((a, b) => b.score.total - a.score.total);
}

/* -------------------------------------------------------------- events */

export async function listEvents(limit = 50) {
  const db = await getDb();
  return db.events.slice(0, limit);
}

export { record as recordEvent, uid };
