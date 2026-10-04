import { ok, route } from "@/lib/server/http";
import { status } from "@/lib/server/llm";
import { listEvents } from "@/lib/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/status — which provider is answering, and a recent activity trace. */
export const GET = route(async () => {
  const events = await listEvents(40);
  return ok({
    ...status(),
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
    ],
    recent: events.filter((e) => e.type === "ai.invoked").slice(0, 8),
  });
}, "GET /api/ai/status");
