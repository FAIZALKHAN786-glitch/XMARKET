import { summarizeComparison } from "@/lib/server/ai";
import { DEFAULT_WEIGHTS } from "@/lib/engine";
import { ApiError, clientKey, ok, rateLimit, readBody, route } from "@/lib/server/http";
import {
  getRequirement,
  listBidsForRequirement,
  listProviders,
} from "@/lib/server/repo";
import { summarizeInput } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai/summarize — the buyer-facing read on their shortlist.
 * Summaries are grounded in the engine's factor scores; the model may explain
 * them but is instructed not to contradict them, and awarding stays manual.
 */
export const POST = route(async (request: Request) => {
  rateLimit(clientKey(request, "ai-summary"), 20, 60_000);
  const input = await readBody(request, summarizeInput);

  const requirement = await getRequirement(input.requirementId);
  if (!requirement) {
    throw new ApiError("not_found", `No requirement with id ${input.requirementId}`);
  }

  const [bids, providers] = await Promise.all([
    listBidsForRequirement(requirement.id),
    listProviders(),
  ]);

  if (bids.length === 0) {
    throw new ApiError("unprocessable", "There are no offers to summarise yet");
  }

  const { data, meta } = await summarizeComparison(
    requirement,
    bids,
    providers,
    input.weights ?? DEFAULT_WEIGHTS,
    input.focus
  );

  return ok({ summary: data, offerCount: bids.length, meta });
}, "POST /api/ai/summarize");
