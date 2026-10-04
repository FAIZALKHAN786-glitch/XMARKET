import { scoreSemanticFit } from "@/lib/server/ai";
import { ApiError, clientKey, ok, rateLimit, readBody, route } from "@/lib/server/http";
import { getBid, getProvider, getRequirement } from "@/lib/server/repo";
import { scoreBidInput } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai/score-bid — semantic fit between one proposal and one requirement.
 *
 * This is deliberately a separate axis from the deterministic engine: price and
 * schedule are arithmetic, this is judgement. Callers opt into blending it (see
 * rankQuery.wSemantic) rather than having it silently change the ranking.
 */
export const POST = route(async (request: Request) => {
  rateLimit(clientKey(request, "ai-score"), 30, 60_000);
  const { requirementId, bidId } = await readBody(request, scoreBidInput);

  const requirement = await getRequirement(requirementId);
  if (!requirement) throw new ApiError("not_found", `No requirement with id ${requirementId}`);

  const bid = await getBid(bidId);
  if (!bid || bid.requirementId !== requirementId) {
    throw new ApiError("not_found", `No bid ${bidId} on requirement ${requirementId}`);
  }

  const provider = await getProvider(bid.providerId);
  const { data, meta } = await scoreSemanticFit(requirement, bid, provider);

  return ok({
    semantic: data,
    blendHint: {
      note: "Add ?wSemantic=0.25 to the compare endpoint to blend this into the total.",
      suggestedWeight: 0.25,
    },
    meta,
  });
}, "POST /api/ai/score-bid");
