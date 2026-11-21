import { daysUntil } from "@/lib/engine";
import { requireSeller } from "@/lib/server/authz";
import { ApiError, clientKey, ok, rateLimit, readBody, readQuery, route } from "@/lib/server/http";
import {
  createBid,
  getProvider,
  getRequirement,
  listBidsForRequirement,
  listProviders,
  rank,
} from "@/lib/server/repo";
import { bidInput, rankQuery } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const query = readQuery(request, rankQuery);
  const requirement = await getRequirement(id);
  if (!requirement) throw new ApiError("not_found", `No requirement with id ${id}`);

  const [bids, providers] = await Promise.all([
    listBidsForRequirement(id),
    listProviders(),
  ]);

  const weights = {
    budget: query.wBudget ?? 0.35,
    timeline: query.wTimeline ?? 0.3,
    relevance: query.wRelevance ?? 0.35,
  };
  const ranked = rank(requirement, bids, providers, { weights });

  return ok({ bids, ranked, weights });
}, "GET /api/requirements/:id/bids");

export const POST = route(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  rateLimit(clientKey(request, "bid"), 30, 60_000);

  const input = await readBody(request, bidInput);
  const requirement = await getRequirement(id);
  if (!requirement) throw new ApiError("not_found", `No requirement with id ${id}`);

  if (requirement.status === "awarded" || requirement.status === "closed") {
    throw new ApiError("conflict", `This requirement is ${requirement.status} and is no longer accepting offers`);
  }
  if (daysUntil(requirement.closesAt) <= 0) {
    throw new ApiError("conflict", "The bidding window for this requirement has closed");
  }
  if (input.price > requirement.budgetMax) {
    throw new ApiError(
      "unprocessable",
      `Offer exceeds the buyer's ceiling by $${(input.price - requirement.budgetMax).toLocaleString()}`,
      { budgetMax: requirement.budgetMax, price: input.price }
    );
  }
  const available = Math.round(daysUntil(requirement.deadline));
  if (input.deliveryDays > available) {
    throw new ApiError(
      "unprocessable",
      `Promised delivery runs ${input.deliveryDays - available} days past the buyer's deadline`,
      { availableDays: available, deliveryDays: input.deliveryDays }
    );
  }

  const account = await requireSeller();
  const providerId = account.merchantId ?? account.xMarketId;
  const provider = await getProvider(providerId);
  if (!provider) throw new ApiError("not_found", `Unknown provider ${providerId}`);

  const existing = (await listBidsForRequirement(id)).find(
    (b) => b.providerId === providerId && b.status !== "rejected"
  );
  if (existing) {
    throw new ApiError(
      "conflict",
      "You already have a live offer on this requirement — withdraw it before submitting another",
      { bidId: existing.id }
    );
  }

  const bid = await createBid(
    id,
    {
      providerId,
      price: input.price,
      deliveryDays: input.deliveryDays,
      pitch: input.pitch,
      coversTags: input.coversTags,
      milestones: input.milestones.length ? input.milestones : evenMilestones(input.deliveryDays),
    },
    provider.name
  );

  const providers = await listProviders();
  const ranked = rank(requirement, await listBidsForRequirement(id), providers);
  const scored = ranked.find((r) => r.bid.id === bid.id);

  return ok({ bid, score: scored?.score }, { status: 201 });
}, "POST /api/requirements/:id/bids");

function evenMilestones(deliveryDays: number) {
  const parts = [
    { label: "Kick-off and plan confirmation", at: 0.15 },
    { label: "Main delivery", at: 0.7 },
    { label: "Review and handover", at: 1 },
  ];
  return parts
    .map((p) => ({ label: p.label, days: Math.max(1, Math.round(deliveryDays * p.at)) }))
    .filter((m, i, arr) => i === 0 || m.days > arr[i - 1].days);
}
