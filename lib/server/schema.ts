import { z } from "zod";

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
  tags: z.array(z.string().trim().min(1).max(48)).max(12),
  mustHaves: z.array(z.string().trim().min(1).max(160)).max(12),
});

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

export const bidStatus = z.enum(["pending", "shortlisted", "accepted", "rejected"]);

export const requirementStatus = z.enum(["open", "reviewing", "awarded", "closed"]);

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
  sort: z.enum(["newest", "closing", "budget", "offers"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const rankQuery = z.object({
  wBudget: z.coerce.number().min(0).max(1).optional(),
  wTimeline: z.coerce.number().min(0).max(1).optional(),
  wRelevance: z.coerce.number().min(0).max(1).optional(),
  wSemantic: z.coerce.number().min(0).max(1).optional(),
  semantic: z.enum(["0", "1", "true", "false"]).optional().transform((v) => v === "1" || v === "true"),
});

export const bidQuery = z.object({
  providerId: z.string().optional(),
  requirementId: z.string().optional(),
  status: bidStatus.optional(),
  buyerId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export const loginInput = z
  .object({
    username: z.string().trim().min(3).max(20).optional(),
    email: z.string().email().optional(),
    password: z.string().min(1),
    role: z.enum(["buyer", "seller"]).optional(),
  })
  .refine((v) => Boolean(v.username || v.email), {
    message: "Username is required",
    path: ["username"],
  });

export const registerInput = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be at most 20 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.enum(["buyer", "seller"]),
    shopName: z.string().trim().min(3).max(50).optional(),
    shopLocation: z.string().trim().min(3).max(100).optional(),
    shopCategory: categoryId.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role !== "seller") return;
    if (!v.shopName || v.shopName.length < 3) {
      ctx.addIssue({ code: "custom", path: ["shopName"], message: "Shop name is required" });
    }
    if (!v.shopLocation || v.shopLocation.length < 3) {
      ctx.addIssue({ code: "custom", path: ["shopLocation"], message: "Shop location is required" });
    }
    if (!v.shopCategory) {
      ctx.addIssue({ code: "custom", path: ["shopCategory"], message: "Choose a shop category" });
    }
  });
