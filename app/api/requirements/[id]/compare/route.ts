import { scoreBidsForBlend } from "@/lib/server/ai";
import { ApiError, ok, readQuery, route } from "@/lib/server/http";
import {
  getRequirement,
  listBidsForRequirement,
  listProviders,
  rank,
} from "@/lib/server/repo";
import { rankQuery } from "@/lib/server/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/requirements/:id/compare
 * The whole comparison workspace in one payload: ranked offers, factor-level
 * scores, and the normalised decision metrics the matrix renders.
 */
export const GET = route(async (request: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const query = readQuery(request, rankQuery);

  const requirement = await getRequirement(id);
  if (!requirement) throw new ApiError("not_found", `No requirement with id ${id}`);

  const [bids, providers] = await Promise.all([
    listBidsForRequirement(id),
    listProviders(),
  ]);

  const weights = {
    budget: query.wBudget ?? 0.35,
    timeline: query.wTimeline ?? 0.3,
    relevance: query.wRelevance ?? 0.35,
    semantic: query.wSemantic ?? 0,
  };

  // Semantic weighting is opt-in: the default comparison is deterministic and
  // costs nothing. A caller that passes ?wSemantic= asks for the model read and
  // gets back the same ranking with the AI factor blended in.
  const wantsSemantic = Boolean(query.semantic) || (weights.semantic ?? 0) > 0;
  const blend = wantsSemantic
    ? await scoreBidsForBlend(requirement, bids, providers)
    : null;

  const ranked = rank(requirement, bids, providers, {
    weights,
    semantic: blend?.scores,
  });
  const prices = ranked.map((r) => r.bid.price);
  const days = ranked.map((r) => r.bid.deliveryDays);
  const available = Math.max(
    1,
    Math.round((+new Date(requirement.deadline) - Date.now()) / 86_400_000)
  );

  return ok({
    requirement,
    weights,
    semanticMeta: blend?.meta ?? null,
    ranked: ranked.map((row) => ({
      bid: row.bid,
      provider: row.provider,
      score: row.score,
      semantic: row.semantic ?? null,
      metrics: {
        priceVsCeiling: row.bid.price / requirement.budgetMax,
        priceVsTarget: row.bid.price / requirement.budgetTarget,
        bufferDays: available - row.bid.deliveryDays,
        tagCoverage: requirement.tags.length
          ? row.bid.coversTags.filter((t) => requirement.tags.includes(t)).length /
            requirement.tags.length
          : 0,
      },
    })),
    benchmarks: {
      lowestPrice: prices.length ? Math.min(...prices) : null,
      highestPrice: prices.length ? Math.max(...prices) : null,
      priceSpread: prices.length ? Math.max(...prices) - Math.min(...prices) : 0,
      fastestDelivery: days.length ? Math.min(...days) : null,
      availableDays: available,
      bestScore: ranked[0]?.score.total ?? null,
    },
  });
}, "GET /api/requirements/:id/compare");
