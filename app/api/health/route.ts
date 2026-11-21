import { ok, route } from "@/lib/server/http";
import { dbPath, isWritable, dbKind } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  return ok({
    ok: true,
    service: "xmarket",
    database: { kind: dbKind(), path: dbPath(), writable: isWritable() },
  });
}, "GET /api/health");
