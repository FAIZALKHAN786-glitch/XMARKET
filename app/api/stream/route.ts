import { recentEvents, subscribe } from "@/lib/server/stream";
import type { AuditEvent } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How often to send a comment line so idle connections are not reaped. */
const HEARTBEAT_MS = 25_000;

/**
 * GET /api/stream — server-sent events for the activity feed.
 *
 * The client subscribes with EventSource and refetches on each event, so the
 * payload only has to say *that* something changed and roughly what; it is not
 * the transport for the records themselves. That keeps this endpoint trivial
 * and means a missed event costs one extra bootstrap call, not lost data.
 *
 * On a platform that caps request duration this connection will be closed and
 * EventSource will reconnect on its own; the backfill below covers the gap.
 */
export async function GET() {
  const encoder = new TextEncoder();

  const frame = (event: AuditEvent) =>
    encoder.encode(
      `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify({
        id: event.id,
        at: event.at,
        type: event.type,
        actor: event.actor,
        summary: event.summary,
        requirementId: event.requirementId ?? null,
        bidId: event.bidId ?? null,
      })}\n\n`
    );

  // Declared before the stream: ReadableStream runs start() synchronously
  // during construction, and that closure assigns to this.
  let cleanup: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const safe = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      // A leading comment flushes the response headers immediately, so the
      // browser fires onopen instead of waiting for the first real event.
      safe(encoder.encode(": xmarket activity stream\n\n"));

      // Backfill: anything published since the client last looked.
      for (const event of [...recentEvents()].reverse()) safe(frame(event));

      const unsubscribe = subscribe((event) => safe(frame(event)));

      const heartbeat = setInterval(
        () => safe(encoder.encode(": ping\n\n")),
        HEARTBEAT_MS
      );

      cleanup = () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
    cancel() {
      cleanup?.();
      cleanup = undefined;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx and several proxies buffer text/event-stream otherwise.
      "X-Accel-Buffering": "no",
    },
  });
}
