import { CATEGORIES } from "@/lib/data";
import { daysUntil } from "@/lib/engine";
import type { Requirement } from "@/lib/types";
import { ok, readBody, readQuery, route } from "@/lib/server/http";
import { createRequirement, listBids, listRequirements } from "@/lib/server/repo";
import { requirementCreate, requirementQuery } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/requirements — filtered, sorted, paginated feed. */
export const GET = route(async (request: Request) => {
  const query = readQuery(request, requirementQuery);
  const [requirements, bids] = await Promise.all([listRequirements(), listBids()]);

  const offerCounts = new Map<string, number>();
  for (const bid of bids) {
    offerCounts.set(bid.requirementId, (offerCounts.get(bid.requirementId) ?? 0) + 1);
  }

  const savedIds = query.savedIds
    ? new Set(query.savedIds.split(",").filter(Boolean))
    : undefined;

  let rows: (Requirement & { offerCount: number })[] = requirements.map((r) => ({
    ...r,
    offerCount: offerCounts.get(r.id) ?? 0,
  }));

  if (query.q) {
    const needle = query.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.summary.toLowerCase().includes(needle) ||
        r.location.toLowerCase().includes(needle) ||
        r.tags.some((t) => t.toLowerCase().includes(needle))
    );
  }
  if (query.category) rows = rows.filter((r) => r.category === query.category);
  if (query.status) rows = rows.filter((r) => r.status === query.status);
  if (query.buyerId) rows = rows.filter((r) => r.buyerId === query.buyerId);
  if (query.minBudget !== undefined) rows = rows.filter((r) => r.budgetMax >= query.minBudget!);
  if (query.maxBudget !== undefined) rows = rows.filter((r) => r.budgetMax <= query.maxBudget!);
  if (query.closingWithinDays !== undefined) {
    rows = rows.filter((r) => {
      const left = daysUntil(r.closesAt);
      return left >= 0 && left <= query.closingWithinDays!;
    });
  }
  if (savedIds) rows = rows.filter((r) => savedIds.has(r.id));

  const sorters: Record<string, (a: typeof rows[number], b: typeof rows[number]) => number> = {
    newest: (a, b) => +new Date(b.postedAt) - +new Date(a.postedAt),
    closing: (a, b) => +new Date(a.closesAt) - +new Date(b.closesAt),
    budget: (a, b) => b.budgetMax - a.budgetMax,
    offers: (a, b) => b.offerCount - a.offerCount,
  };
  rows.sort(sorters[query.sort]);

  const total = rows.length;
  const page = rows.slice(query.offset, query.offset + query.limit);

  return ok({
    requirements: page,
    meta: {
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + page.length < total,
      categories: CATEGORIES.map((c) => c.id),
      sort: query.sort,
    },
  });
}, "GET /api/requirements");

/** POST /api/requirements — publish a requirement. */
export const POST = route(async (request: Request) => {
  const input = await readBody(request, requirementCreate);
  const requirement = await createRequirement({
    title: input.title,
    summary: input.summary,
    description: input.description,
    category: input.category,
    buyerId: input.buyerId ?? "b_me",
    budgetMax: input.budgetMax,
    budgetTarget: input.budgetTarget,
    deadline: input.deadline.toISOString(),
    closesAt: input.closesAt.toISOString(),
    location: input.location,
    tags: input.tags,
    mustHaves: input.mustHaves,
  });
  return ok({ requirement }, { status: 201 });
}, "POST /api/requirements");
