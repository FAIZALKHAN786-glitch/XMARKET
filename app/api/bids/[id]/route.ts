import { ApiError, ok, readBody, route } from "@/lib/server/http";
import { getBid, getRequirement, listProviders, rank, setBidStatus } from "@/lib/server/repo";
import { bidStatusPatch } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const bid = await getBid(id);
  if (!bid) throw new ApiError("not_found", `No bid with id ${id}`);

  const requirement = await getRequirement(bid.requirementId);
  if (!requirement) throw new ApiError("not_found", "Parent requirement missing");

  const providers = await listProviders();
  const ranked = rank(requirement, [bid], providers, {});
  return ok({ bid, requirement, score: ranked[0]?.score });
}, "GET /api/bids/:id");

/**
 * PATCH /api/bids/:id — shortlist, accept or decline.
 * Accepting is transactional: siblings are rejected and the requirement is
 * marked awarded inside a single mutation, so the ledger can never show two
 * winners.
 */
export const PATCH = route(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { status, actor } = await readBody(request, bidStatusPatch);

  const result = await setBidStatus(id, status, actor ?? "buyer");
  if (!result.ok) {
    throw new ApiError(
      result.code === "not_found" ? "not_found" : "conflict",
      result.message
    );
  }

  return ok({
    bid: result.bid,
    rejectedSiblings: result.rejectedSiblings,
    message:
      status === "accepted"
        ? `Accepted. ${result.rejectedSiblings.length} competing offer(s) declined.`
        : `Offer ${status}.`,
  });
}, "PATCH /api/bids/:id");
