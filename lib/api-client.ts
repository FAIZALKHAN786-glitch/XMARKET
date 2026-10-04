import type { Bid, Buyer, Provider, Requirement, Weights } from "@/lib/types";

/* ==========================================================================
   Typed client for the XMARKET API.
   Every call returns parsed data or throws an ApiClientError carrying the
   server's code and message, so the UI can show the real reason a write failed
   instead of a generic failure toast.
   ========================================================================== */

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export class ApiClientError extends Error {
  code: string;
  details?: unknown;
  status: number;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export interface AiMeta {
  provider: string;
  model: string;
  mode: "llm" | "heuristic";
  cached: boolean;
  latencyMs: number;
  note?: string;
}

export interface AiStatus extends AiMeta {
  live: boolean;
  capabilities: { id: string; label: string; endpoint: string }[];
  recent: AuditEvent[];
}

export interface AuditEvent {
  id: string;
  at: string;
  type: string;
  actor: string;
  requirementId?: string;
  bidId?: string;
  summary: string;
  meta?: Record<string, unknown>;
}

export interface BootstrapPayload {
  requirements: Requirement[];
  bids: Bid[];
  providers: Provider[];
  buyers: Buyer[];
  events: AuditEvent[];
  serverTime: string;
}

export interface HealthPayload {
  service: string;
  version: number;
  time: string;
  database: {
    path: string;
    writable: boolean;
    mode: "persistent" | "in-memory";
    counts: Record<string, number>;
  };
  ai: { provider: string; model: string; live: boolean; mode: string; note: string };
}

export interface ParsedDraft {
  title: string;
  summary: string;
  description: string;
  category: string;
  budgetMax: number;
  budgetTarget: number;
  deadlineInDays: number;
  closingInDays: number;
  deadline: string;
  closesAt: string;
  location: string;
  tags: string[];
  mustHaves: string[];
  confidence: number;
  assumptions: string[];
}

export interface SemanticScore {
  score: number;
  verdict: string;
  addressed: string[];
  gaps: string[];
  confidence: number;
}

export interface DraftBid {
  pitch: string;
  milestones: { label: string; days: number }[];
  coversTags: string[];
  risks: string[];
}

export interface ComparisonSummary {
  headline: string;
  recommendation: string;
  tradeoffs: { providerId: string; strength: string; risk: string }[];
  watchFor: string[];
  confidence: number;
  rankedIds: string[];
}

/* --------------------------------------------------------------- transport */

async function request<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(json ? { "content-type": "application/json" } : {}),
      ...(rest.headers ?? {}),
    },
    body: json ? JSON.stringify(json) : rest.body,
  });

  let payload: ApiEnvelope<T> | undefined;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError(
      `The API returned a non-JSON response (${response.status})`,
      "bad_response",
      response.status
    );
  }

  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new ApiClientError(
      payload?.error?.message ?? `Request failed with ${response.status}`,
      payload?.error?.code ?? "unknown",
      response.status,
      payload?.error?.details
    );
  }
  return payload.data;
}

/* ------------------------------------------------------------------ calls */

/** Extra provenance attached only when a comparison blended AI fit in. */
export type SemanticBlendMeta = AiMeta & {
  scoredBids: number;
  requestedBids: number;
};

export const api = {
  health: () => request<HealthPayload>("/api/health"),

  bootstrap: () => request<BootstrapPayload>("/api/bootstrap"),

  createRequirement: (input: {
    title: string;
    summary: string;
    description: string;
    category: string;
    budgetMax: number;
    budgetTarget: number;
    deadline: string;
    closesAt: string;
    location: string;
    tags: string[];
    mustHaves: string[];
    buyerId?: string;
  }) =>
    request<{ requirement: Requirement }>("/api/requirements", {
      method: "POST",
      json: input,
    }),

  updateRequirementStatus: (id: string, status: string) =>
    request<{ requirement: Requirement }>(`/api/requirements/${id}`, {
      method: "PATCH",
      json: { status },
    }),

  createBid: (
    requirementId: string,
    input: {
      price: number;
      deliveryDays: number;
      pitch: string;
      coversTags: string[];
      milestones: { label: string; days: number }[];
      providerId?: string;
    }
  ) =>
    request<{ bid: Bid; score?: unknown }>(
      `/api/requirements/${requirementId}/bids`,
      { method: "POST", json: input }
    ),

  updateBidStatus: (bidId: string, status: string) =>
    request<{ bid: Bid; rejectedSiblings: string[]; message: string }>(
      `/api/bids/${bidId}`,
      { method: "PATCH", json: { status } }
    ),

  compare: (
    requirementId: string,
    weights?: Partial<Weights>
  ) => {
    const params = new URLSearchParams();
    if (weights?.budget !== undefined) params.set("wBudget", String(weights.budget));
    if (weights?.timeline !== undefined) params.set("wTimeline", String(weights.timeline));
    if (weights?.relevance !== undefined) params.set("wRelevance", String(weights.relevance));
    if (weights?.semantic) params.set("wSemantic", String(weights.semantic));
    const qs = params.toString();
    return request<{
      requirement: Requirement;
      weights: Weights;
      ranked: {
        bid: Bid;
        provider?: Provider;
        score: import("@/lib/types").Score;
        semantic: number | null;
        metrics: {
          priceVsCeiling: number;
          priceVsTarget: number;
          bufferDays: number;
          tagCoverage: number;
        };
      }[];
      benchmarks: Record<string, number | null>;
      semanticMeta: SemanticBlendMeta | null;
    }>(`/api/requirements/${requirementId}/compare${qs ? `?${qs}` : ""}`);
  },

  stats: (role: "buyer" | "provider") =>
    request<Record<string, unknown>>(`/api/stats?role=${role}`),

  events: (limit = 25) =>
    request<{ events: AuditEvent[] }>(`/api/events?limit=${limit}`),

  resetDemoData: (scope: "data" | "ai-cache" | "all" = "data") =>
    request<{ reset: boolean; droppedCacheEntries?: number }>(
      `/api/admin/reset?scope=${scope}`,
      { method: "POST" }
    ),

  ai: {
    status: () => request<AiStatus>("/api/ai/status"),

    parseRequirement: (brief: string, defaults?: { category?: string; location?: string }) =>
      request<{ draft: ParsedDraft; meta: AiMeta }>(
        "/api/ai/parse-requirement",
        { method: "POST", json: { brief, defaults } }
      ),

    scoreBid: (requirementId: string, bidId: string) =>
      request<{ semantic: SemanticScore; meta: AiMeta }>("/api/ai/score-bid", {
        method: "POST",
        json: { requirementId, bidId },
      }),

    draftBid: (
      requirementId: string,
      options: { providerId?: string; targetPrice?: number; deliveryDays?: number; notes?: string } = {}
    ) =>
      request<{ draft: DraftBid; meta: AiMeta }>("/api/ai/draft-bid", {
        method: "POST",
        json: { requirementId, ...options },
      }),

    summarize: (requirementId: string, weights?: Weights, focus?: string) =>
      request<{ summary: ComparisonSummary; offerCount: number; meta: AiMeta }>(
        "/api/ai/summarize",
        { method: "POST", json: { requirementId, weights, focus } }
      ),
  },
};

export function isApiError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}
