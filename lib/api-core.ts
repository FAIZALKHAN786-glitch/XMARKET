/* ==========================================================================
   Shared API contract: the envelope every XMARKET endpoint speaks and the
   error type the UI reacts to. Kept in its own module so both the Next.js
   client (api-client.ts) and the FastAPI client (fastapi-client.ts) can
   import it without a circular dependency.
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
