"use client";

import * as React from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { api } from "@/lib/api-client";

type Turn = { role: "user" | "assistant"; content: string };

/**
 * The buyer's assistant. Answers come from the buyer's own requirements and
 * offers — served by the FastAPI service (`/fastapi/v1/ai/copilot`).
 */
export function Copilot() {
  const [open, setOpen] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns, busy]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;

    const history = [...turns, { role: "user" as const, content: message }];
    setTurns(history);
    setDraft("");
    setBusy(true);
    setError(null);

    try {
      const data = await api.ai.copilot(
        message,
        // Send prior turns so the model can follow a thread.
        history.slice(0, -1).map((t) => ({ role: t.role, content: t.content }))
      );
      setTurns((prev) => [...prev, { role: "assistant", content: data.reply }]);
      setMeta(`${data.meta.provider} · ${data.meta.model}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" size="lg" onClick={() => setOpen(true)}>
        <MessageSquare className="size-4" />
        Ask the assistant
      </Button>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.9375rem] font-semibold text-white">Assistant</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-white/60 transition-colors hover:text-white"
        >
          Close
        </button>
      </div>
      <p className="mt-1 text-xs muted">
        Answers from your own requirements and the offers on them.
      </p>

      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
        {turns.length === 0 && (
          <p className="text-sm muted">
            Ask about your requirements — for example, which offer is closest to
            your ceiling, or what is missing before you can award.
          </p>
        )}

        {turns.map((turn, index) => (
          <div
            key={index}
            className={
              turn.role === "user"
                ? "rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white"
                : "rounded-xl border border-white/10 px-3.5 py-2.5 text-sm leading-relaxed text-white/85"
            }
          >
            {turn.content}
          </div>
        ))}

        {busy && (
          <p className="rounded-xl border border-white/10 px-3.5 py-2.5 text-sm muted">
            Thinking…
          </p>
        )}

        {error && (
          <p className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white/85">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="mt-4 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about your requirements"
          className="field h-11 flex-1"
          aria-label="Message"
        />
        <Button type="submit" disabled={busy || !draft.trim()} aria-label="Send">
          <Send className="size-4" />
        </Button>
      </form>

      {meta && <p className="mt-3 text-xs faint">{meta}</p>}
    </Card>
  );
}
