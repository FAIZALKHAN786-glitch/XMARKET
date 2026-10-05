import { ApiError, ok, readBody, route } from "@/lib/server/http";
import { getBid, getRequirement, listProviders, rank, setBidStatus } from "@/lib/server/repo";
import { bidStatusPatch } from "@/lib/server/schema";
import { assertOwnsBid } from "@/lib/server/authz";
import { applyBidOutcome } from "@/lib/server/reputation";

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

  // Only the buyer who posted the requirement may change an offer's status.
  // Without this, anyone holding a bid id could award their own offer — the
  // bid id is not a secret, it appears in every listing response.
  await assertOwnsBid(id);

  const result = await setBidStatus(id, status, actor ?? "buyer");
  if (!result.ok) {
    throw new ApiError(
      result.code === "not_found" ? "not_found" : "conflict",
      result.message
    );
  }

  // The winner's score goes up. Everyone they beat goes down a little, so a
  // seller who keeps being passed over visibly drifts below one who is chosen.
  const awarded = result.bid ? await applyBidOutcome(result.bid.providerId, "accepted") : null;
  // rejectedSiblings holds bid ids, not bids, so each is resolved before the
  // seller behind it can be scored.
  for (const siblingId of result.rejectedSiblings ?? []) {
    const sibling = await getBid(siblingId);
    if (sibling) await applyBidOutcome(sibling.providerId, "rejected");
  }

  return ok({
    bid: result.bid,
    reputation: awarded,
    rejectedSiblings: result.rejectedSiblings,
    message:
      status === "accepted"
        ? `Accepted. ${result.rejectedSiblings.length} competing offer(s) declined.`
        : `Offer ${status}.`,
  });
}, "PATCH /api/bids/:id");
