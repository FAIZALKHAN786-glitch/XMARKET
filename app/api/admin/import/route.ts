import { ApiError, ok, readBody, route } from "@/lib/server/http";
import { importRequirements } from "@/lib/server/repo";
import { importInput } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/import — bulk-create requirements that came from an external
 * source (see scripts/import-tenders.mjs).
 *
 * Records are de-duplicated on the source's own identifier, so running an
 * import twice is safe and a scheduled re-run only brings in what is new.
 * `dryRun` validates and reports without writing anything.
 *
 * Disabled in production unless XMARKET_ALLOW_IMPORT=true, because it writes
 * records that no signed-in user created.
 */
export const POST = route(async (request: Request) => {
  const allowed =
    process.env.NODE_ENV !== "production" || process.env.XMARKET_ALLOW_IMPORT === "true";

  if (!allowed) {
    throw new ApiError(
      "conflict",
      "Import is disabled in production. Set XMARKET_ALLOW_IMPORT=true to enable it."
    );
  }

  const input = await readBody(request, importInput);

  // zod coerced the dates; the store keeps ISO strings.
  const records = input.requirements.map((r) => ({
    ...r,
    deadline: r.deadline.toISOString(),
    closesAt: r.closesAt.toISOString(),
  }));

  const outcome = await importRequirements(records, {
    actor: "import",
    dryRun: input.dryRun,
  });

  return ok(
    {
      ...outcome,
      dryRun: input.dryRun,
      source: input.requirements[0]?.source.name ?? null,
    },
    { status: input.dryRun ? 200 : 201 }
  );
}, "POST /api/admin/import");
