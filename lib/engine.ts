import type {
  Bid,
  Provider,
  Requirement,
  Score,
  ScoreFactor,
  Weights,
} from "./types";

export const DEFAULT_WEIGHTS: Weights = {
  budget: 0.35,
  timeline: 0.3,
  relevance: 0.35,
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

export function daysBetween(from: Date | string, to: Date | string) {
  const a = typeof from === "string" ? new Date(from) : from;
  const b = typeof to === "string" ? new Date(to) : to;
  return (b.getTime() - a.getTime()) / 86_400_000;
}

export function daysUntil(iso: string) {
  return daysBetween(new Date(), iso);
}

/**
 * How well the offer price sits inside the buyer's budget envelope.
 *
 * - at or under the buyer's target price  -> rewarded (100)
 * - between target and hard ceiling       -> gently decays toward 70
 * - above the ceiling                     -> falls away fast
 * - suspiciously cheap (< 45% of target)  -> small credibility penalty
 */
function scoreBudget(price: number, req: Requirement) {
  const { budgetMax, budgetTarget } = req;
  let score: number;
  let detail: string;

  if (price <= budgetTarget) {
    const ratio = price / budgetTarget;
    if (ratio < 0.45) {
      score = 82 - (0.45 - ratio) * 90;
      detail = `${article(price)} is far below the $${budgetTarget.toLocaleString()} target — verify scope and quality.`;
    } else {
      score = 100 - (1 - ratio) * 6;
      detail = `Comes in at or under the $${budgetTarget.toLocaleString()} target price.`;
    }
  } else if (price <= budgetMax) {
    const t = (price - budgetTarget) / Math.max(1, budgetMax - budgetTarget);
    score = 100 - t * 30;
    detail = `Above target but still inside the $${budgetMax.toLocaleString()} ceiling.`;
  } else {
    const over = price / budgetMax - 1;
    score = clamp(62 - over * 220);
    detail = `Exceeds the $${budgetMax.toLocaleString()} budget ceiling by ${Math.round(
      over * 100
    )}%.`;
  }

  return { score: clamp(score), detail };
}

/**
 * Delivery feasibility against the buyer's deadline.
 */
function scoreTimeline(bid: Bid, req: Requirement) {
  // Whole days on purpose: fractional day counts would let the server and the
  // client disagree about `available` (and therefore about the score, the bar
  // width and the explanation text) across a hydration boundary.
  const available = Math.round(daysUntil(req.deadline));
  const promised = Math.round(bid.deliveryDays);
  let score: number;
  let detail: string;

  if (available <= 0) {
    return { score: 40, detail: "The buying window has already closed." };
  }

  const slack = available - promised;
  if (promised <= available * 0.65) {
    score = 100;
    detail = `Delivers in ${promised} days with ${Math.round(
      slack
    )} days of buffer before the deadline.`;
  } else if (promised <= available) {
    score = 100 - (promised - available * 0.65) / (available * 0.35) * 26;
    detail = `Meets the deadline with ${Math.round(slack)} days to spare.`;
  } else {
    const late = promised - available;
    score = clamp(74 - late * (late > 30 ? 1.4 : 2.6));
    detail = `Runs ${Math.round(late)} days past the buyer's deadline.`;
  }

  return { score: clamp(score), detail };
}

/**
 * Category fit, claimed-tag coverage, and provider track record.
 */
function scoreRelevance(bid: Bid, req: Requirement, provider?: Provider) {
  const tagCoverage = req.tags.length
    ? bid.coversTags.filter((t) => req.tags.includes(t)).length / req.tags.length
    : 0.7;

  const categoryFit = provider?.categories.includes(req.category) ? 1 : 0.22;
  const rating = provider ? (provider.rating - 3) / 2 : 0.5; // 3★..5★ -> 0..1
  const reliability = provider ? provider.onTimeRate / 100 : 0.7;
  const verified = provider?.verified ? 1 : 0.72;
  const response = provider ? clamp(1 - (provider.responseHours - 1) / 36, 0.4, 1) : 0.7;

  const raw =
    tagCoverage * 0.44 +
    categoryFit * 0.26 +
    rating * 0.12 +
    reliability * 0.08 +
    response * 0.06 +
    verified * 0.04;

  const claimed = req.tags.filter((t) => bid.coversTags.includes(t)).length;

  return {
    score: clamp(raw * 100),
    detail: `${claimed}/${req.tags.length} requirement tags covered${
      provider ? ` · ${provider.rating.toFixed(1)}★ over ${provider.reviews} reviews` : ""
    }.`,
  };
}

function article(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export function compatibility(
  bid: Bid,
  req: Requirement,
  provider?: Provider,
  weights: Weights = DEFAULT_WEIGHTS
): Score {
  const budget = scoreBudget(bid.price, req);
  const timeline = scoreTimeline(bid, req);
  const relevance = scoreRelevance(bid, req, provider);

  const totalWeight = weights.budget + weights.timeline + weights.relevance || 1;

  const factors: ScoreFactor[] = [
    {
      key: "budget",
      label: "Budget fit",
      score: Math.round(budget.score),
      weight: weights.budget / totalWeight,
      detail: budget.detail,
    },
    {
      key: "timeline",
      label: "Timeline match",
      score: Math.round(timeline.score),
      weight: weights.timeline / totalWeight,
      detail: timeline.detail,
    },
    {
      key: "relevance",
      label: "Requirement relevance",
      score: Math.round(relevance.score),
      weight: weights.relevance / totalWeight,
      detail: relevance.detail,
    },
  ];

  const total = clamp(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  const strengths = factors
    .filter((f) => f.score >= 82)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((f) => f.detail);
  const risks = factors
    .filter((f) => f.score < 68)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((f) => f.detail);

  return {
    total: Math.round(total),
    grade: grade(total),
    factors,
    strengths,
    risks,
  };
}

export function grade(score: number): Score["grade"] {
  if (score >= 85) return "Excellent";
  if (score >= 72) return "Strong";
  if (score >= 58) return "Fair";
  return "Weak";
}

export function scoreToken(score: number) {
  // Monochrome intensity ramp: brighter fill == stronger score.
  if (score >= 85)
    return {
      text: "text-white",
      bg: "bg-white",
      soft: "bg-white/12",
      ring: "border-white/45",
      hex: "#ffffff",
    };
  if (score >= 70)
    return {
      text: "text-white/75",
      bg: "bg-white/55",
      soft: "bg-white/8",
      ring: "border-white/25",
      hex: "#a6a6a6",
    };
  return {
    text: "text-white/50",
    bg: "bg-white/30",
    soft: "bg-white/5",
    ring: "border-white/12",
    hex: "#6b6b6b",
  };
}

export function rankBids(
  bids: Bid[],
  req: Requirement,
  providers: Provider[],
  weights: Weights = DEFAULT_WEIGHTS
) {
  return bids
    .map((bid) => ({
      bid,
      provider: providers.find((p) => p.id === bid.providerId),
      score: compatibility(
        bid,
        req,
        providers.find((p) => p.id === bid.providerId),
        weights
      ),
    }))
    .sort((a, b) => b.score.total - a.score.total);
}
