import { z } from "zod";

/* ==========================================================================
   Input contracts. Every request body and query string is parsed with these,
   so route handlers only ever see validated data.
   ========================================================================== */

export const CATEGORY_IDS = [
  "manufacturing",
  "software",
  "logistics",
  "design",
  "construction",
  "electronics",
] as const;

export const categoryId = z.enum(CATEGORY_IDS);

export const weightsSchema = z.object({
  budget: z.number().min(0).max(1),
  timeline: z.number().min(0).max(1),
  relevance: z.number().min(0).max(1),
});

export const requirementInput = z.object({
  title: z.string().trim().min(8).max(140),
  summary: z.string().trim().min(10).max(240),
  description: z.string().trim().min(10).max(6000),
  category: categoryId,
  buyerId: z.string().min(1).optional(),
  budgetMax: z.number().int().positive().max(100_000_000),
  budgetTarget: z.number().int().positive().max(100_000_000),
  deadline: z.coerce.date(),
  closesAt: z.coerce.date(),
  location: z.string().trim().min(1).max(120),
  tags: z.array(z.string().trim().min(1).max(48)).min(2).max(12),
  mustHaves: z.array(z.string().trim().min(1).max(160)).max(12),
});
// `.refine` on the object keeps the inferred output type clean.
export const requirementCreate = requirementInput.refine(
  (v) => v.budgetTarget <= v.budgetMax,
  { message: "budgetTarget cannot exceed budgetMax", path: ["budgetTarget"] }
);

export const milestoneInput = z.object({
  label: z.string().trim().min(2).max(120),
  days: z.number().int().min(1).max(3650),
});

export const bidInput = z.object({
  providerId: z.string().min(1).optional(),
  price: z.number().int().positive().max(100_000_000),
  deliveryDays: z.number().int().min(1).max(3650),
  pitch: z.string().trim().min(40).max(4000),
  coversTags: z.array(z.string().trim().min(1).max(48)).min(1).max(12),
  milestones: z.array(milestoneInput).max(8).default([]),
});

export const bidStatus = z.enum([
  "pending",
  "shortlisted",
  "accepted",
  "rejected",
]);

export const requirementStatus = z.enum([
  "open",
  "reviewing",
  "awarded",
  "closed",
]);

export const bidStatusPatch = z.object({
  status: bidStatus,
  actor: z.string().max(80).optional(),
});

export const requirementStatusPatch = z.object({
  status: requirementStatus,
});

export const requirementQuery = z.object({
  q: z.string().trim().max(160).optional(),
  category: categoryId.optional(),
  status: requirementStatus.optional(),
  minBudget: z.coerce.number().int().nonnegative().optional(),
  maxBudget: z.coerce.number().int().positive().optional(),
  closingWithinDays: z.coerce.number().int().positive().max(365).optional(),
  buyerId: z.string().optional(),
  savedIds: z.string().optional(),
  sort: z
    .enum(["newest", "closing", "budget", "offers"])
    .default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const rankQuery = z.object({
  wBudget: z.coerce.number().min(0).max(1).optional(),
  wTimeline: z.coerce.number().min(0).max(1).optional(),
  wRelevance: z.coerce.number().min(0).max(1).optional(),
  wSemantic: z.coerce.number().min(0).max(1).optional(),
  semantic: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export const bidQuery = z.object({
  providerId: z.string().optional(),
  requirementId: z.string().optional(),
  status: bidStatus.optional(),
  buyerId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

/* ---------------------------------------------------------------- AI input */

export const parseRequirementInput = z.object({
  brief: z.string().trim().min(20).max(6000),
  defaults: z
    .object({
      category: categoryId.optional(),
      location: z.string().max(120).optional(),
    })
    .optional(),
});

export const scoreBidInput = z.object({
  requirementId: z.string().min(1),
  bidId: z.string().min(1),
});

export const draftBidInput = z.object({
  requirementId: z.string().min(1),
  providerId: z.string().optional(),
  targetPrice: z.number().int().positive().optional(),
  deliveryDays: z.number().int().min(1).max(3650).optional(),
  notes: z.string().max(1200).optional(),
});

export const summarizeInput = z.object({
  requirementId: z.string().min(1),
  weights: weightsSchema.optional(),
  focus: z.string().max(240).optional(),
});

/* ------------------------------------------------------- LLM output shapes */

/**
 * LLM responses are untrusted. They are parsed against these schemas before
 * anything downstream can read a field, so a hallucinated or malformed
 * payload fails closed instead of corrupting state.
 */
export const parsedRequirementSchema = z.object({
  title: z.string().min(6).max(140),
  summary: z.string().min(6).max(240),
  description: z.string().min(10).max(6000),
  category: categoryId,
  budgetMax: z.number().int().positive(),
  budgetTarget: z.number().int().positive(),
  deadlineInDays: z.number().int().min(1).max(730),
  closingInDays: z.number().int().min(1).max(120),
  location: z.string().min(1).max(120),
  tags: z.array(z.string().min(1).max(48)).min(2).max(12),
  mustHaves: z.array(z.string().min(1).max(160)).max(12),
  confidence: z.number().min(0).max(1),
  assumptions: z.array(z.string().max(200)).max(6).default([]),
});

export const semanticScoreSchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.string().min(3).max(160),
  addressed: z.array(z.string().max(120)).max(8).default([]),
  gaps: z.array(z.string().max(160)).max(8).default([]),
  confidence: z.number().min(0).max(1),
});

export const draftBidSchema = z.object({
  pitch: z.string().min(40).max(4000),
  milestones: z
    .array(z.object({ label: z.string().min(2).max(120), days: z.number().int().min(1).max(3650) }))
    .min(2)
    .max(8),
  coversTags: z.array(z.string().min(1).max(48)).min(1).max(12),
  risks: z.array(z.string().max(200)).max(6).default([]),
});

export const comparisonSummarySchema = z.object({
  headline: z.string().min(6).max(200),
  recommendation: z.string().min(10).max(400),
  tradeoffs: z
    .array(
      z.object({
        providerId: z.string().min(1),
        strength: z.string().max(200),
        risk: z.string().max(200),
      })
    )
    .max(6),
  watchFor: z.array(z.string().max(200)).max(6).default([]),
  confidence: z.number().min(0).max(1),
});

export type ParsedRequirement = z.infer<typeof parsedRequirementSchema>;
export type SemanticScore = z.infer<typeof semanticScoreSchema>;
export type DraftBid = z.infer<typeof draftBidSchema>;
export type ComparisonSummary = z.infer<typeof comparisonSummarySchema>;
