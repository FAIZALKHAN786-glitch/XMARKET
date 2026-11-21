export type Role = "buyer" | "provider";

export type RequirementStatus = "open" | "reviewing" | "awarded" | "closed";

export type BidStatus = "pending" | "shortlisted" | "accepted" | "rejected";

export type CategoryId =
  | "manufacturing"
  | "software"
  | "logistics"
  | "design"
  | "construction"
  | "electronics";

export interface Category {
  id: CategoryId;
  label: string;
  blurb: string;
  icon: string;
}

export interface Buyer {
  id: string;
  name: string;
  company: string;
  location: string;
  initials: string;
  rating: number;
  posted: number;
  awarded: number;
}

export interface Provider {
  id: string;
  name: string;
  tagline: string;
  location: string;
  initials: string;
  categories: CategoryId[];
  skills: string[];
  rating: number;
  reviews: number;
  completedJobs: number;
  onTimeRate: number;
  responseHours: number;
  verified: boolean;
  memberSince: number;
}

/**
 * Provenance for records that were imported rather than composed in the app.
 * Kept on the record so a listing can always be traced back to its source and
 * so re-running an import can skip what it already brought in.
 */
export interface SourceRef {
  /** Human label, e.g. "UK Contracts Finder". */
  name: string;
  /** Canonical link to the original notice. */
  url: string;
  /** The source's own identifier for this record. */
  ref?: string;
  /** ISO timestamp of the import that created this record. */
  importedAt: string;
}

export interface Requirement {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: CategoryId;
  buyerId: string;
  /** Hard ceiling the buyer will not exceed, in USD. */
  budgetMax: number;
  /** What the buyer hopes to pay — the reference point for budget scoring. */
  budgetTarget: number;
  /** ISO date the buyer needs delivery by. */
  deadline: string;
  /** ISO date the buying window closes. */
  closesAt: string;
  postedAt: string;
  location: string;
  tags: string[];
  mustHaves: string[];
  status: RequirementStatus;
  views: number;
  /** Present only on imported records — see SourceRef. */
  source?: SourceRef;
}

export interface Milestone {
  label: string;
  days: number;
}

export interface Bid {
  id: string;
  requirementId: string;
  providerId: string;
  price: number;
  /** Calendar days from award to delivery. */
  deliveryDays: number;
  pitch: string;
  /** Requirement tags this provider explicitly claims to satisfy. */
  coversTags: string[];
  milestones: Milestone[];
  createdAt: string;
  status: BidStatus;
  attachments?: string[];
}

export interface ScoreFactor {
  /** `semantic` is only present on blended rows — see Weights.semantic. */
  key: "budget" | "timeline" | "relevance" | "semantic";
  label: string;
  /** 0 – 100 for this factor. */
  score: number;
  weight: number;
  /** Human-readable one-liner explaining the score. */
  detail: string;
}

export interface Score {
  total: number;
  grade: "Excellent" | "Strong" | "Fair" | "Weak";
  factors: ScoreFactor[];
  strengths: string[];
  risks: string[];
}

export interface Weights {
  budget: number;
  timeline: number;
  relevance: number;
  /**
   * Optional fourth axis: the AI-judged semantic fit between a proposal and
   * the requirement. Zero (or absent) means the deterministic three-factor
   * engine alone decides the ranking.
   */
  semantic?: number;
}

/* ----------------------------------------------------------------- accounts */

export type AccountRole = "buyer" | "seller";

/**
 * A signed-in user. Buyers and sellers share one table because they share one
 * login mechanism, but a seller carries the merchant identity the buyer side
 * never has.
 *
 * `passwordHash` must never leave the server — `publicAccount()` strips it.
 */
export interface Account {
  id: string;
  role: AccountRole;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
  /** Login handle. Legacy accounts fall back to the email local part. */
  username?: string;
  /** The multi-purpose public identifier used by every novelty feature. */
  xMarketId: string;
  /** Buyer-only. */
  company?: string;
  /** Seller-only. Same value as xMarketId — kept for the bid authorisation path. */
  merchantId?: string;
  merchantName?: string;
  shopName?: string;
  shopLocation?: string;
  shopCategory?: CategoryId;
  /** Budget records created before this instant are excluded from tracking. */
  budgetResetAt?: string;
  /** The single category this merchant trades in. Drives requirement routing. */
  domain?: CategoryId;
  /**
   * 0-100. Starts at 50 for everyone and moves with delivery outcomes, so
   * ranking reflects record rather than how long an account has existed.
   */
  performanceScore: number;
  /**
   * Absent on accounts created before verification existed, which is treated as
   * verified so introducing the check does not lock anyone out.
   */
  emailVerified?: boolean;
}
