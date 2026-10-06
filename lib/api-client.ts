import type { Bid, Buyer, Provider, Requirement, Weights } from "@/lib/types";
import { fastapiRequest, FastapiUnreachableError } from "@/lib/fastapi-client";

export type { ApiEnvelope } from "@/lib/api-core";
export { ApiClientError } from "@/lib/api-core";
import type { ApiEnvelope } from "@/lib/api-core";
import { ApiClientError } from "@/lib/api-core";

/* ==========================================================================
   Typed client for the XMARKET API.
   Every call returns parsed data or throws an ApiClientError carrying the
   server's code and message, so the UI can show the real reason a write failed
   instead of a generic failure toast.

   The marketplace data calls hit the Next.js /api/* routes directly. The AI
   calls go to the FastAPI service through the /fastapi/* rewrite; if that
   process is down we transparently fall back to the equivalent Next.js
   /api/ai/* route so the features keep working.
   ========================================================================== */

export interface AiMeta {
  provider: string;
  model: string;
  mode: "llm" | "heuristic";
  cached: boolean;
  latencyMs: number;
  note?: string;
}

export interface AiProbe {
  ok: boolean;
  provider: string;
  model: string;
  latencyMs?: number;
  detail?: string;
  code?: string;
  cached?: boolean;
}

export interface AiStatus extends AiMeta {
  live: boolean;
  capabilities: { id: string; label: string; endpoint: string }[];
  recent: AuditEvent[];
  /** Present only when the caller asked for a live probe. */
  probe?: AiProbe;
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

/**
 * AI calls run on the FastAPI service. If that process is unreachable (the
 * proxy surfaces it as a 5xx / network failure) we retry the same call on the
 * Next.js /api/ai/* implementation, which carries the identical contract.
 * Real API errors (auth, validation, rate limits) are never swallowed.
 */
async function aiViaFastapi<T>(
  fastapi: () => Promise<T>,
  legacy: () => Promise<T>
): Promise<T> {
  try {
    return await fastapi();
  } catch (error) {
    if (error instanceof FastapiUnreachableError) return legacy();
    throw error;
  }
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

  // The AI capabilities live on the FastAPI service (`/fastapi/v1/ai/*`), with
  // an automatic fallback to the Next.js `/api/ai/*` routes if it is down.
  ai: {
    status: (options: { probe?: boolean } = {}) =>
      aiViaFastapi<AiStatus>(
        () => fastapiRequest<AiStatus>(`/v1/ai/status${options.probe ? "?probe=1" : ""}`),
        () => request<AiStatus>(`/api/ai/status${options.probe ? "?probe=1" : ""}`)
      ),

    parseRequirement: (brief: string, defaults?: { category?: string; location?: string }) =>
      aiViaFastapi<{ draft: ParsedDraft; meta: AiMeta }>(
        () =>
          fastapiRequest<{ draft: ParsedDraft; meta: AiMeta }>("/v1/ai/parse-requirement", {
            method: "POST",
            json: { brief, defaults },
          }),
        () =>
          request<{ draft: ParsedDraft; meta: AiMeta }>("/api/ai/parse-requirement", {
            method: "POST",
            json: { brief, defaults },
          })
      ),

    scoreBid: (requirementId: string, bidId: string) =>
      aiViaFastapi<{ semantic: SemanticScore; meta: AiMeta }>(
        () =>
          fastapiRequest<{ semantic: SemanticScore; meta: AiMeta }>("/v1/ai/score-bid", {
            method: "POST",
            json: { requirementId, bidId },
          }),
        () =>
          request<{ semantic: SemanticScore; meta: AiMeta }>("/api/ai/score-bid", {
            method: "POST",
            json: { requirementId, bidId },
          })
      ),

    draftBid: (
      requirementId: string,
      options: { providerId?: string; targetPrice?: number; deliveryDays?: number; notes?: string } = {}
    ) =>
      aiViaFastapi<{ draft: DraftBid; meta: AiMeta }>(
        () =>
          fastapiRequest<{ draft: DraftBid; meta: AiMeta }>("/v1/ai/draft-bid", {
            method: "POST",
            json: { requirementId, ...options },
          }),
        () =>
          request<{ draft: DraftBid; meta: AiMeta }>("/api/ai/draft-bid", {
            method: "POST",
            json: { requirementId, ...options },
          })
      ),

    summarize: (requirementId: string, weights?: Weights, focus?: string) =>
      aiViaFastapi<{ summary: ComparisonSummary; offerCount: number; meta: AiMeta }>(
        () =>
          fastapiRequest<{ summary: ComparisonSummary; offerCount: number; meta: AiMeta }>(
            "/v1/ai/summarize",
            { method: "POST", json: { requirementId, weights, focus } }
          ),
        () =>
          request<{ summary: ComparisonSummary; offerCount: number; meta: AiMeta }>(
            "/api/ai/summarize",
            { method: "POST", json: { requirementId, weights, focus } }
          )
      ),

    copilot: (message: string, history: { role: "user" | "assistant"; content: string }[] = []) => {
      type CopilotResponse = {
        reply: string;
        meta: AiMeta & {
          requirementsInContext?: number;
          role?: "buyer" | "seller";
        };
      };
      return aiViaFastapi<CopilotResponse>(
        () =>
          fastapiRequest<CopilotResponse>("/v1/ai/copilot", {
            method: "POST",
            json: { message, history },
          }),
        () =>
          request<CopilotResponse>("/api/ai/copilot", {
            method: "POST",
            json: { message, history },
          })
      );
    },
  },
};

export function isApiError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}
