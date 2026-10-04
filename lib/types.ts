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
  key: "budget" | "timeline" | "relevance";
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
}
