import { ok, readQuery, route } from "@/lib/server/http";
import { listProviders } from "@/lib/server/repo";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const query = z.object({
  category: z
    .enum(["manufacturing", "software", "logistics", "design", "construction", "electronics"])
    .optional(),
  q: z.string().trim().max(120).optional(),
  verified: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export const GET = route(async (request: Request) => {
  const filters = readQuery(request, query);
  let providers = await listProviders();

  if (filters.category) {
    providers = providers.filter((p) => p.categories.includes(filters.category!));
  }
  if (filters.verified) providers = providers.filter((p) => p.verified);
  if (filters.q) {
    const needle = filters.q.toLowerCase();
    providers = providers.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.tagline.toLowerCase().includes(needle) ||
        p.skills.some((s) => s.toLowerCase().includes(needle))
    );
  }

  return ok({ providers, meta: { count: providers.length } });
}, "GET /api/providers");
