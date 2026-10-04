import { resetDb } from "@/lib/server/db";
import { ApiError, ok, readQuery, route } from "@/lib/server/http";
import { clearAiCache } from "@/lib/server/repo";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resetInput = z
  .object({
    /**
     * `data` restores the seeded demo dataset, `ai-cache` only drops cached
     * model replies, `all` does both.
     */
    scope: z.enum(["data", "ai-cache", "all"]).default("data"),
  });

/**
 * POST /api/admin/reset — restore the seeded demo dataset and/or drop the
 * cached model replies. Disabled in production unless XMARKET_ALLOW_RESET=true,
 * because it is destructive and there is no auth layer yet.
 */
export const POST = route(async (request: Request) => {
  const allowed =
    process.env.NODE_ENV !== "production" || process.env.XMARKET_ALLOW_RESET === "true";

  if (!allowed) {
    throw new ApiError(
      "conflict",
      "Reset is disabled in production. Set XMARKET_ALLOW_RESET=true to enable it."
    );
  }

  // The scope travels in the query string so a bare POST keeps its old
  // meaning: restore the demo data.
  const { scope } = readQuery(request, resetInput);

  const droppedCacheEntries =
    scope === "data" ? 0 : await clearAiCache();

  if (scope === "ai-cache") {
    return ok({ reset: false, droppedCacheEntries });
  }

  const db = await resetDb();
  return ok({
    reset: true,
    scope,
    droppedCacheEntries,
    counts: {
      requirements: db.requirements.length,
      bids: db.bids.length,
      providers: db.providers.length,
    },
  });
}, "POST /api/admin/reset");
