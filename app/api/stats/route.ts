import { z } from "zod";
import { ok, readQuery, route } from "@/lib/server/http";
import {
  listBids,
  listEvents,
  listProviders,
  listRequirements,
  rank,
} from "@/lib/server/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const query = z.object({
  role: z.enum(["buyer", "provider"]).default("buyer"),
  buyerId: z.string().default("b_me"),
  providerId: z.string().default("p_me"),
});

/** GET /api/stats — the dashboard aggregates, computed once on the server. */
export const GET = route(async (request: Request) => {
  const { role, buyerId, providerId } = readQuery(request, query);
  const [requirements, bids, providers, events] = await Promise.all([
    listRequirements(),
    listBids(),
    listProviders(),
    listEvents(12),
  ]);

  if (role === "buyer") {
    const mine = requirements.filter((r) => r.buyerId === buyerId);
    const mineIds = new Set(mine.map((r) => r.id));
    const mineBids = bids.filter((b) => mineIds.has(b.requirementId));

    const scored = mineBids.flatMap((bid) => {
      const requirement = requirements.find((r) => r.id === bid.requirementId);
      if (!requirement) return [];
      const ranked = rank(requirement, [bid], providers);
      return ranked.length ? [ranked[0].score.total] : [];
    });

    const ceiling = mine.reduce((sum, r) => sum + r.budgetMax, 0);
    const lowest = mine.reduce((sum, r) => {
      const ranked = rank(
        r,
        bids.filter((b) => b.requirementId === r.id),
        providers
      );
      return sum + (ranked.length ? Math.min(...ranked.map((x) => x.bid.price)) : 0);
    }, 0);

    const statusCounts = (["pending", "shortlisted", "accepted", "rejected"] as const).map(
      (status) => ({
        status,
        count: mineBids.filter((b) => b.status === status).length,
      })
    );

    const pipeline = mineBids
      .map((bid) => {
        const requirement = requirements.find((r) => r.id === bid.requirementId)!;
        const provider = providers.find((p) => p.id === bid.providerId);
        const scoredBid = rank(requirement, [bid], provider ? [provider] : providers)[0];
        return {
          bidId: bid.id,
          requirementId: requirement.id,
          requirementTitle: requirement.title,
          providerName: provider?.name ?? bid.providerId,
          price: bid.price,
          deliveryDays: bid.deliveryDays,
          status: bid.status,
          score: scoredBid?.score.total ?? null,
        };
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return ok({
      role,
      totals: {
        requirements: mine.length,
        openRequirements: mine.filter((r) => r.status !== "awarded").length,
        offers: mineBids.length,
        awaitingReview: mineBids.filter((b) => b.status === "pending").length,
        awardedValue: mineBids
          .filter((b) => b.status === "accepted")
          .reduce((s, b) => s + b.price, 0),
        averageCompatibility: scored.length
          ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
          : 0,
      },
      budget: {
        ceiling,
        lowestOffers: lowest,
        potentialSaving: Math.max(0, ceiling - lowest),
        discountPercent: ceiling ? Math.round(((ceiling - lowest) / ceiling) * 100) : 0,
      },
      statusCounts,
      pipeline,
      closingSoon: mine
        .filter((r) => r.status !== "awarded")
        .sort((a, b) => +new Date(a.closesAt) - +new Date(b.closesAt))
        .slice(0, 5)
        .map((r) => ({ id: r.id, title: r.title, closesAt: r.closesAt })),
      events,
    });
  }

  const me = providers.find((p) => p.id === providerId);
  const myBids = bids.filter((b) => b.providerId === providerId);

  const withRank = myBids.map((bid) => {
    const requirement = requirements.find((r) => r.id === bid.requirementId)!;
    const ranked = rank(
      requirement,
      bids.filter((b) => b.requirementId === bid.requirementId),
      providers
    );
    const index = ranked.findIndex((r) => r.bid.id === bid.id);
    return {
      bidId: bid.id,
      requirementId: requirement.id,
      requirementTitle: requirement.title,
      price: bid.price,
      deliveryDays: bid.deliveryDays,
      status: bid.status,
      rank: index + 1,
      of: ranked.length,
      score: ranked[index]?.score.total ?? null,
    };
  });

  const won = myBids.filter((b) => b.status === "accepted");

  return ok({
    role,
    provider: me ?? null,
    totals: {
      bids: myBids.length,
      pending: myBids.filter((b) => b.status === "pending").length,
      shortlisted: myBids.filter((b) => b.status === "shortlisted").length,
      won: won.length,
      winRate: myBids.length ? Math.round((won.length / myBids.length) * 100) : 0,
      pipelineValue: myBids
        .filter((b) => b.status === "pending" || b.status === "shortlisted")
        .reduce((s, b) => s + b.price, 0),
    },
    bids: withRank.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    events,
  });
}, "GET /api/stats");
