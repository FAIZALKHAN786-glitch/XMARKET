import { ApiError, ok, readBody, route } from "@/lib/server/http";
import { recordEvent } from "@/lib/server/repo";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  type: z
    .enum([
      "requirement.created",
      "requirement.status",
      "bid.created",
      "bid.status",
      "ai.invoked",
      "provider.created",
    ]),
  actor: z.string().min(1).max(120),
  requirementId: z.string().max(120).optional(),
  bidId: z.string().max(120).optional(),
  summary: z.string().min(1).max(500),
  meta: z.record(z.string(), z.unknown()).optional(),
});

/**
 * The shared secret for sibling-service calls. XMARKET_INTERNAL_SECRET when
 * set, otherwise the session secret — both processes read the same env, so
 * the default keeps local development working with zero configuration.
 */
function internalSecret(): string {
  return (
    process.env.XMARKET_INTERNAL_SECRET ??
    process.env.XMARKET_SESSION_SECRET ??
    "unset-configure-me"
  );
}

/**
 * POST /api/internal/record-event — audit-log writer for sibling services.
 *
 * The FastAPI service answers the AI endpoints, so it records `ai.invoked`
 * events through this route instead of writing the store directly (the Next
 * process is the single writer of the marketplace store). The browser never
 * calls this; the `x-xmarket-internal-secret` header is the gate.
 */
export const POST = route(async (request: Request) => {
  const secret = request.headers.get("x-xmarket-internal-secret");
  if (!secret || secret !== internalSecret()) {
    throw new ApiError("unauthorized", "Invalid internal secret.");
  }
  const body = await readBody(request, input);
  const event = await recordEvent(body);
  return ok({ event });
}, "POST /api/internal/record-event");
