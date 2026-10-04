import { parseRequirement } from "@/lib/server/ai";
import { clientKey, ok, rateLimit, readBody, route } from "@/lib/server/http";
import { parseRequirementInput } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/ai/parse-requirement
 * Turns a pasted brief into a filled-in requirement draft. The response is a
 * suggestion: the buyer still reviews every field in the wizard, and the
 * response says whether a model or the heuristic engine produced it.
 */
export const POST = route(async (request: Request) => {
  rateLimit(clientKey(request, "ai-parse"), 20, 60_000);
  const input = await readBody(request, parseRequirementInput);

  const { data, meta } = await parseRequirement(input.brief, input.defaults);

  return ok({
    draft: {
      ...data,
      deadline: new Date(Date.now() + data.deadlineInDays * 86_400_000).toISOString(),
      closesAt: new Date(Date.now() + data.closingInDays * 86_400_000).toISOString(),
    },
    meta,
  });
}, "POST /api/ai/parse-requirement");
