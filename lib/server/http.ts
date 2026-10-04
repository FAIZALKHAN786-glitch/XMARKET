import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

/* ==========================================================================
   Small HTTP layer: one error shape, one place to log, one place to parse.
   ========================================================================== */

export type ApiErrorCode =
  | "bad_request"
  | "not_found"
  | "conflict"
  | "unprocessable"
  | "rate_limited"
  | "ai_unavailable"
  /** The configured provider rejected our credentials. */
  | "auth"
  /** The provider failed on its side (5xx) — transient. */
  | "upstream"
  | "internal";

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  not_found: 404,
  conflict: 409,
  unprocessable: 422,
  rate_limited: 429,
  ai_unavailable: 503,
  auth: 502,
  upstream: 502,
  internal: 500,
};

export class ApiError extends Error {
  code: ApiErrorCode;
  details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(code: ApiErrorCode, message: string, details?: unknown) {
  return NextResponse.json(
    { ok: false, error: { code, message, details } },
    { status: STATUS[code] }
  );
}

/** Wraps a handler so thrown errors become consistent JSON responses. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
  name: string
) {
  return async (...args: Args): Promise<Response> => {
    const started = Date.now();
    try {
      const response = await handler(...args);
      log(name, response.status, started);
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        log(name, STATUS[error.code], started, error.message);
        return fail(error.code, error.message, error.details);
      }
      if (error instanceof ZodError) {
        log(name, 400, started, "validation");
        return fail("bad_request", "Request failed validation", flattenZod(error));
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      log(name, 500, started, message);
      return fail("internal", "Something went wrong", { message });
    }
  };
}

function log(name: string, status: number, started: number, note?: string) {
  const ms = Date.now() - started;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
  const line = `[api] ${name} ${status} ${ms}ms${note ? ` — ${note}` : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function flattenZod(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

/** Parses a JSON body against a schema, raising a clean 400 on failure. */
export async function readBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("bad_request", "Body must be valid JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("bad_request", "Request failed validation", flattenZod(parsed.error));
  }
  return parsed.data;
}

export function readQuery<T>(request: Request, schema: ZodType<T>): T {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  for (const [key, value] of url.searchParams) raw[key] = value;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("bad_request", "Invalid query parameters", flattenZod(parsed.error));
  }
  return parsed.data;
}

/** Naive fixed-window limiter — enough to stop a runaway client or a bill. */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new ApiError(
      "rate_limited",
      `Rate limit exceeded — try again in ${Math.ceil((bucket.resetAt - now) / 1000)}s`,
      { limit, windowMs }
    );
  }
  return { allowed: true, remaining: limit - bucket.count };
}

export function clientKey(request: Request, scope: string) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local";
  return `${scope}:${ip}`;
}
