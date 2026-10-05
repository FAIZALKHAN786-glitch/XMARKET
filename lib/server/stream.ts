import type { AuditEvent } from "./db";

/**
 * In-process fan-out for the live activity stream.
 *
 * Every audit event written through `record()` in repo.ts is published here,
 * and the SSE route at /api/stream forwards it to whoever is listening. This
 * is deliberately a single-process EventEmitter rather than a broker: the app
 * is one Node server, and if it ever runs as several replicas the honest fix
 * is Postgres LISTEN/NOTIFY, which needs a one-line change in publish() and
 * nothing anywhere else.
 *
 * Held on globalThis so Next.js hot reloads in dev share one listener set
 * instead of leaking a new one per recompile.
 */

type Listener = (event: AuditEvent) => void;

interface StreamState {
  listeners: Set<Listener>;
  /** Ring buffer so a client that connects mid-session still gets recent items. */
  recent: AuditEvent[];
}

const globalRef = globalThis as unknown as { __xmarketStream?: StreamState };

function state(): StreamState {
  return (globalRef.__xmarketStream ??= { listeners: new Set(), recent: [] });
}

const RECENT_LIMIT = 25;

/** Broadcast one event to every connected client. Never throws at the caller. */
export function publish(event: AuditEvent) {
  const s = state();
  s.recent.unshift(event);
  if (s.recent.length > RECENT_LIMIT) s.recent.length = RECENT_LIMIT;
  for (const listener of s.listeners) {
    try {
      listener(event);
    } catch {
      // A dead socket must not break the write that triggered the event.
    }
  }
}

/** Subscribe to new events. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  const s = state();
  s.listeners.add(listener);
  return () => {
    s.listeners.delete(listener);
  };
}

/** Events since the client last looked, newest first. */
export function recentEvents(): AuditEvent[] {
  return state().recent;
}

/** How many clients are currently attached, for /api/health. */
export function listenerCount(): number {
  return state().listeners.size;
}
