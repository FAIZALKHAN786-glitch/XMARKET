import { z } from "zod";
import { ok, readQuery, route } from "@/lib/server/http";
import { listEvents } from "@/lib/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const query = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  type: z.string().optional(),
});

/** GET /api/events — the audit log behind the activity feed. */
export const GET = route(async (request: Request) => {
  const { limit, type } = readQuery(request, query);
  let events = await listEvents(limit);
  if (type) events = events.filter((e) => e.type === type);
  return ok({ events, meta: { count: events.length } });
}, "GET /api/events");
