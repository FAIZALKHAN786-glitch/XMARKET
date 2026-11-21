import { ok, readQuery, route } from "@/lib/server/http";
import {
  listBids,
  listBidsForRequirement,
  listProviders,
  listRequirements,
  rank,
} from "@/lib/server/repo";
import { bidQuery } from "@/lib/server/schema";
import { providerXMarketId } from "@/lib/xmarket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/bids — bid ledger with the engine score attached for dashboards. */
export const GET = route(async (request: Request) => {
  const query = readQuery(request, bidQuery);

  let bids = query.requirementId
    ? await listBidsForRequirement(query.requirementId)
    : await listBids();

  if (query.providerId) bids = bids.filter((b) => b.providerId === query.providerId);
  if (query.status) bids = bids.filter((b) => b.status === query.status);
  if (query.buyerId) {
    const requirements = await listRequirements();
    const ids = new Set(
      requirements.filter((r) => r.buyerId === query.buyerId).map((r) => r.id)
    );
    bids = bids.filter((b) => ids.has(b.requirementId));
  }

  bids = bids
    .slice()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, query.limit);

  const [requirements, providers] = await Promise.all([listRequirements(), listProviders()]);
  const reqMap = new Map(requirements.map((r) => [r.id, r]));
  const scored = bids.map((bid) => {
    const requirement = reqMap.get(bid.requirementId);
    const provider = providers.find((p) => p.id === bid.providerId);
    const score = requirement ? rank(requirement, [bid], providers)[0]?.score : null;
    return {
      ...bid,
      provider,
      providerXMarketId: providerXMarketId(bid.providerId, provider?.categories[0]),
      score,
      requirement: requirement
        ? { id: requirement.id, title: requirement.title, category: requirement.category, budgetTarget: requirement.budgetTarget, status: requirement.status }
        : null,
    };
  });

  return ok({ bids: scored, meta: { count: scored.length } });
}, "GET /api/bids");
