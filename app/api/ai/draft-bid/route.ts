import { draftBid } from "@/lib/server/ai";
import { ApiError, clientKey, ok, rateLimit, readBody, route } from "@/lib/server/http";
import { getProvider, getRequirement } from "@/lib/server/repo";
import { draftBidInput } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai/draft-bid — a starting proposal for a provider.
 * The draft is never submitted automatically; it is returned as form values
 * for the provider to edit, and it refuses to claim tags the profile lacks.
 */
export const POST = route(async (request: Request) => {
  rateLimit(clientKey(request, "ai-draft"), 20, 60_000);
  const input = await readBody(request, draftBidInput);

  const requirement = await getRequirement(input.requirementId);
  if (!requirement) {
    throw new ApiError("not_found", `No requirement with id ${input.requirementId}`);
  }

  const provider = await getProvider(input.providerId ?? "p_me");
  if (!provider) throw new ApiError("not_found", `Unknown provider ${input.providerId}`);

  const { data, meta } = await draftBid(requirement, provider, {
    targetPrice: input.targetPrice,
    deliveryDays: input.deliveryDays,
    notes: input.notes,
  });

  return ok({
    draft: data,
    requirement: {
      id: requirement.id,
      title: requirement.title,
      tags: requirement.tags,
      budgetMax: requirement.budgetMax,
      budgetTarget: requirement.budgetTarget,
    },
    meta,
  });
}, "POST /api/ai/draft-bid");
