import { ok, readQuery, route } from "@/lib/server/http";
import { health, status } from "@/lib/server/llm";
import { listEvents } from "@/lib/server/repo";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusQuery = z.object({
  /**
   * Probe the provider with a real request. Off by default so that merely
   * looking at the status chip never spends quota.
   */
  probe: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

/**
 * GET /api/ai/status — which provider is answering, and a recent activity trace.
 * `?probe=1` additionally calls the provider so a broken key is reported as
 * broken instead of merely "configured".
 */
export const GET = route(async (request: Request) => {
  const query = readQuery(request, statusQuery);
  const events = await listEvents(40);
  const probe = query.probe ? await health() : undefined;

  return ok({
    ...status(),
    ...(probe ? { probe } : {}),
    capabilities: [
      {
        id: "parse-requirement",
        label: "Brief → structured requirement",
        endpoint: "POST /api/ai/parse-requirement",
      },
      {
        id: "score-bid",
        label: "Semantic fit for a proposal",
        endpoint: "POST /api/ai/score-bid",
      },
      {
        id: "draft-bid",
        label: "Proposal drafting for providers",
        endpoint: "POST /api/ai/draft-bid",
      },
      {
        id: "summarize",
        label: "Shortlist narrative for buyers",
        endpoint: "POST /api/ai/summarize",
      },
      {
        id: "copilot",
        label: "Role-aware marketplace assistant",
        endpoint: "POST /api/ai/copilot",
      },
    ],
    recent: events.filter((e) => e.type === "ai.invoked").slice(0, 8),
  });
}, "GET /api/ai/status");
