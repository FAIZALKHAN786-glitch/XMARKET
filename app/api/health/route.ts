import { dbKind, dbPath, getDb, isWritable } from "@/lib/server/db";
import { ok, route } from "@/lib/server/http";
import { status as llmStatus } from "@/lib/server/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness plus the two facts that actually matter: is data persisting, is a model configured. */
export const GET = route(async () => {
  const db = await getDb();
  return ok({
    service: "xmarket-api",
    version: 1,
    time: new Date().toISOString(),
    database: {
      driver: dbKind(),
      path: dbPath(),
      writable: isWritable(),
      mode: isWritable() ? "persistent" : "in-memory",
      counts: {
        requirements: db.requirements.length,
        bids: db.bids.length,
        providers: db.providers.length,
        buyers: db.buyers.length,
        events: db.events.length,
      },
    },
    ai: llmStatus(),
  });
}, "GET /api/health");
