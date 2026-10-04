import { ok, readQuery, route } from "@/lib/server/http";
import { listBids, listBidsForRequirement } from "@/lib/server/repo";
import { bidQuery } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/bids — the offer ledger, filterable by provider, requirement, status or buyer. */
export const GET = route(async (request: Request) => {
  const query = readQuery(request, bidQuery);

  let bids = query.requirementId
    ? await listBidsForRequirement(query.requirementId)
    : await listBids();

  if (query.providerId) bids = bids.filter((b) => b.providerId === query.providerId);
  if (query.status) bids = bids.filter((b) => b.status === query.status);

  bids = bids
    .slice()
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, query.limit);

  return ok({ bids, meta: { count: bids.length } });
}, "GET /api/bids");
