import { CATEGORIES } from "@/lib/data";
import { ApiError, ok, readBody, readQuery, route } from "@/lib/server/http";
import { createRequirement, listRequirements } from "@/lib/server/repo";
import { requirementCreate, requirementQuery } from "@/lib/server/schema";
import { requireAccount } from "@/lib/server/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request: Request) => {
  const query = readQuery(request, requirementQuery);
  const requirements = await listRequirements();

  let rows = requirements.filter((r) => r.status === "open" || r.status === "reviewing");

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
  if (query.buyerId) rows = rows.filter((r) => r.buyerId === query.buyerId);
  if (query.minBudget !== undefined) rows = rows.filter((r) => r.budgetMax >= query.minBudget!);
  if (query.maxBudget !== undefined) rows = rows.filter((r) => r.budgetMax <= query.maxBudget!);
  if (query.closingWithinDays !== undefined) {
    rows = rows.filter((r) => {
      const left = Math.round((new Date(r.closesAt).getTime() - Date.now()) / 86_400_000);
      return left >= 0 && left <= query.closingWithinDays!;
    });
  }

  const sorters: Record<string, (a: typeof rows[number], b: typeof rows[number]) => number> = {
    newest: (a, b) => +new Date(b.postedAt) - +new Date(a.postedAt),
    closing: (a, b) => +new Date(a.closesAt) - +new Date(b.closesAt),
    budget: (a, b) => b.budgetMax - a.budgetMax,
    offers: (a, b) => 0,
  };
  rows.sort(sorters[query.sort]);

  const total = rows.length;
  const page = rows.slice(query.offset, query.offset + query.limit);

  return ok({
    requirements: page,
    meta: { total, limit: query.limit, offset: query.offset, hasMore: query.offset + page.length < total, categories: CATEGORIES.map((c) => c.id), sort: query.sort },
  });
}, "GET /api/requirements");

export const POST = route(async (request: Request) => {
  const account = await requireAccount();
  if (account.role !== "buyer") {
    throw new ApiError("forbidden", "Only buyers can post requirements.");
  }
  const input = await readBody(request, requirementCreate);
  const requirement = await createRequirement({
    title: input.title,
    summary: input.summary,
    description: input.description,
    category: input.category,
    buyerId: account.id,
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
