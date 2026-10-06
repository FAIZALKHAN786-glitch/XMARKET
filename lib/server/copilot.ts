import type { Account, Bid, Provider, Requirement } from "@/lib/types";

export type CopilotRole = "buyer" | "seller";

export interface CopilotContext {
  role: CopilotRole;
  content: string;
  requirementsInContext: number;
}

const MAX_REQUIREMENTS = 12;
const MAX_OFFERS_PER_REQUIREMENT = 5;
const MAX_SELLER_BIDS = 20;

function text(value: unknown, limit = 360): string {
  if (typeof value !== "string") return "not provided";
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, limit) : "not provided";
}

function currency(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `$${Math.round(value).toLocaleString("en-US")}`
    : "not provided";
}

function newestFirst<T extends { postedAt?: string; createdAt?: string }>(a: T, b: T) {
  const dateA = a.postedAt ?? a.createdAt ?? "";
  const dateB = b.postedAt ?? b.createdAt ?? "";
  return Date.parse(dateB) - Date.parse(dateA);
}

function requirementLines(requirement: Requirement): string[] {
  return [
    `Requirement ${requirement.id}: ${text(requirement.title, 140)}`,
    `  Summary: ${text(requirement.summary, 260)}`,
    `  Category: ${requirement.category}; location: ${text(requirement.location, 100)}; status: ${requirement.status}`,
    `  Budget target: ${currency(requirement.budgetTarget)}; hard ceiling: ${currency(requirement.budgetMax)}; delivery deadline: ${text(requirement.deadline?.slice(0, 10), 20)}`,
    `  Specs: ${text(requirement.description, 360)}`,
    `  Tags: ${(requirement.tags ?? []).slice(0, 8).map((tag) => text(tag, 48)).join(", ") || "none listed"}`,
    `  Must-haves: ${(requirement.mustHaves ?? []).slice(0, 8).map((item) => text(item, 120)).join("; ") || "none listed"}`,
  ];
}

function buyerContext(
  account: Account,
  requirements: Requirement[],
  bids: Bid[],
  providers: Provider[]
): CopilotContext {
  const providerById = new Map(providers.map((provider) => [provider.id, provider]));
  const allMine = requirements
    .filter((requirement) => requirement.buyerId === account.id)
    .sort(newestFirst);
  const selected = allMine.slice(0, MAX_REQUIREMENTS);
  const sections = selected.map((requirement) => {
    const offers = bids
      .filter((bid) => bid.requirementId === requirement.id)
      .sort(newestFirst);
    const visibleOffers = offers.slice(0, MAX_OFFERS_PER_REQUIREMENT);
    const offerLines = visibleOffers.flatMap((bid) => {
      const provider = providerById.get(bid.providerId);
      const name = provider?.name ? `${text(provider.name, 100)} (${bid.providerId})` : bid.providerId;
      const profile = provider
        ? `; rating ${Number.isFinite(provider.rating) ? provider.rating : "not listed"}/5, ${provider.reviews ?? 0} reviews, verified ${provider.verified ? "yes" : "no"}`
        : "";
      return [
        `  Offer ${bid.id} from ${name}: ${currency(bid.price)}, ${bid.deliveryDays} delivery days, status ${bid.status}${profile}`,
        `    Covers tags: ${(bid.coversTags ?? []).slice(0, 8).map((tag) => text(tag, 48)).join(", ") || "none listed"}`,
        `    Pitch: ${text(bid.pitch, 220)}`,
        ...(bid.milestones?.length
          ? [`    Milestones: ${bid.milestones.slice(0, 5).map((milestone) => `${text(milestone.label, 70)} (${milestone.days} days)`).join("; ")}`]
          : []),
      ];
    });
    if (offers.length > visibleOffers.length) {
      offerLines.push(`  ${offers.length - visibleOffers.length} older offer(s) omitted from context.`);
    }
    return [
      ...requirementLines(requirement),
      "  Incoming offers:",
      ...(offerLines.length ? offerLines : ["    No offers yet."]),
    ].join("\n");
  });

  if (allMine.length > selected.length) {
    sections.push(`${allMine.length - selected.length} older requirement(s) omitted; the context contains the ${selected.length} most recently posted.`);
  }

  return {
    role: "buyer",
    content: sections.length
      ? sections.join("\n\n")
      : "No requirement or offer records are available for this buyer yet.",
    requirementsInContext: selected.length,
  };
}

function sellerContext(
  account: Account,
  requirements: Requirement[],
  bids: Bid[],
  providers: Provider[]
): CopilotContext {
  const providerId = account.merchantId ?? "";
  const provider = providers.find((item) => item.id === providerId);
  const ownBids = bids
    .filter((bid) => bid.providerId === providerId)
    .sort(newestFirst);
  const ownBidRequirementIds = new Set(ownBids.map((bid) => bid.requirementId));
  const openOpportunities = requirements
    .filter(
      (requirement) =>
        requirement.status === "open" &&
        (!account.domain || requirement.category === account.domain)
    )
    .sort(newestFirst)
    .slice(0, MAX_REQUIREMENTS);
  const ownRequirements = requirements
    .filter((requirement) => ownBidRequirementIds.has(requirement.id))
    .sort(newestFirst)
    .slice(0, MAX_SELLER_BIDS);
  const includedRequirements = new Map<string, Requirement>();
  for (const requirement of [...openOpportunities, ...ownRequirements]) {
    includedRequirements.set(requirement.id, requirement);
  }

  const profile = [
    `Shop: ${text(account.shopName ?? provider?.name, 100)}; merchant: ${text(account.merchantName ?? provider?.tagline, 120)}; trade: ${text(account.domain ?? provider?.categories?.join(", "), 100)}.`,
    `Seller performance score: ${Number.isFinite(account.performanceScore) ? account.performanceScore : "not listed"}/100.`,
    `Profile skills: ${(provider?.skills ?? []).slice(0, 10).map((skill) => text(skill, 48)).join(", ") || "none listed"}.`,
    provider
      ? `Public profile: rating ${provider.rating}/5 from ${provider.reviews} reviews; ${provider.completedJobs} completed jobs; on-time rate ${Math.round(provider.onTimeRate * 100)}%.`
      : "No separate public provider profile was found.",
  ];

  const recentBids = ownBids.slice(0, MAX_SELLER_BIDS).map((bid) => {
    const requirement = requirements.find((item) => item.id === bid.requirementId);
    return [
      `  Bid ${bid.id} on ${requirement ? text(requirement.title, 120) : bid.requirementId}: ${currency(bid.price)}, ${bid.deliveryDays} delivery days, status ${bid.status}.`,
      `    Covers tags: ${(bid.coversTags ?? []).slice(0, 8).map((tag) => text(tag, 48)).join(", ") || "none listed"}. Pitch: ${text(bid.pitch, 220)}`,
    ].join("\n");
  });

  const opportunitySections = openOpportunities.map((requirement) =>
    requirementLines(requirement).join("\n")
  );
  const ownRequirementSections = ownRequirements
    .filter((requirement) => !openOpportunities.some((open) => open.id === requirement.id))
    .slice(0, MAX_SELLER_BIDS)
    .map((requirement) => requirementLines(requirement).join("\n"));

  return {
    role: "seller",
    content: [
      "Your provider profile:",
      ...profile.map((line) => `  ${line}`),
      "\nYour recent bids (only your own submissions; no competitor bid data is included):",
      ...(recentBids.length ? recentBids : ["  You have not submitted any bids yet."]),
      ownBids.length > recentBids.length
        ? `  ${ownBids.length - recentBids.length} older bid(s) omitted from context.`
        : "",
      "\nOpen opportunities in your trade:",
      ...(opportunitySections.length ? opportunitySections : ["  No open opportunities were found in this context."]),
      "\nOther requirements tied to your own bids:",
      ...(ownRequirementSections.length ? ownRequirementSections : ["  None."]),
      requirements.length > openOpportunities.length + ownRequirementSections.length
        ? "  The opportunity list is limited to the most recent open requirements and your own bid history."
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
    requirementsInContext: includedRequirements.size,
  };
}

/** Build a narrowly-scoped, role-aware context from server-owned marketplace data. */
export function buildCopilotContext(
  account: Account,
  requirements: Requirement[],
  bids: Bid[],
  providers: Provider[]
): CopilotContext {
  return account.role === "seller"
    ? sellerContext(account, requirements, bids, providers)
    : buyerContext(account, requirements, bids, providers);
}
