"use client";

import * as React from "react";
import { AlertTriangle, Database, Eraser, PlugZap, RefreshCw, Sparkles, WifiOff } from "lucide-react";
import { api, isApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import { Button } from "./ui/primitives";

/**
 * Honest status.
 *
 * Two things can silently degrade this app: the API can be unreachable (the UI
 * keeps working on seeded data) and no model can be configured (the AI panels
 * answer with heuristics). Both are stated in the interface rather than hidden,
 * because a demo that pretends to be a model is worse than one that says it is
 * not.
 */
export function SystemStatus({ className }: { className?: string }) {
  const { connected, syncError, aiStatus, refresh, busy, pushToast } = useStore();
  const [open, setOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [probing, setProbing] = React.useState(false);
  const [probe, setProbe] = React.useState<import("@/lib/api-client").AiProbe | null>(null);
  const syncing = Boolean(busy["requirement:create"] || busy["bid:create"]);

  const clearCache = async () => {
    setClearing(true);
    try {
      const result = await api.resetDemoData("ai-cache");
      pushToast({
        title: "Cached model replies cleared",
        body: `${result.droppedCacheEntries ?? 0} entries dropped — the next AI action calls the provider again.`,
        tone: "default",
      });
    } catch (err) {
      pushToast({
        title: "Could not clear the cache",
        body: isApiError(err) ? err.message : "The API is unreachable",
        tone: "error",
      });
    } finally {
      setClearing(false);
    }
  };

  /**
   * Ask the provider for a real reply. "A key is configured" and "the key
   * works" are different facts, and only the second one matters to someone who
   * has just pasted theirs in.
   */
  const testKey = async () => {
    setProbing(true);
    try {
      const result = await api.ai.status({ probe: true });
      setProbe(result.probe ?? null);
      if (result.probe?.ok) {
        pushToast({
          title: "Model responded",
          body: `${result.probe.provider} · ${result.probe.model} answered in ${result.probe.latencyMs}ms.`,
          tone: "success",
        });
      } else {
        pushToast({
          title: "Model did not answer",
          body: result.probe?.detail ?? "The provider rejected the request.",
          tone: "error",
        });
      }
    } catch (err) {
      const message = isApiError(err) ? err.message : "Could not reach the API";
      setProbe({
        ok: false,
        provider: aiStatus?.provider ?? "unknown",
        model: aiStatus?.model ?? "unknown",
        detail: message,
      });
      pushToast({ title: "Probe failed", body: message, tone: "error" });
    } finally {
      setProbing(false);
    }
  };

  const aiLive = aiStatus?.live ?? false;

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="System status"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition",
          connected
            ? "border-white/15 text-white/60 hover:border-white/30 hover:text-white"
            : "border-white/25 text-white/80 hover:border-white/40"
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            connected ? "bg-white" : "bg-white/40 animate-pulse-soft"
          )}
        />
        {connected ? "API live" : "API offline"}
        <span className="text-white/20">·</span>
        {aiLive ? "AI live" : "AI offline"}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="surface absolute right-0 z-50 mt-2 w-[19rem] p-4 shadow-2xl shadow-black">
            <p className="eyebrow">System status</p>

            <div className="mt-3 space-y-3">
              <StatusRow
                icon={<Database className="size-3.5" />}
                title="Data API"
                tone={connected ? "good" : "warn"}
                value={connected ? "Connected" : "Falling back to seed data"}
                detail={
                  connected
                    ? "Requirements, offers and awards persist to the server."
                    : syncError ?? "The API did not respond."
                }
              />

              <StatusRow
                icon={<Sparkles className="size-3.5" />}
                title="Language model"
                tone={aiLive ? "good" : "warn"}
                value={
                  aiLive
                    ? `${aiStatus?.provider} · ${aiStatus?.model}`
                    : "Heuristic engine"
                }
                detail={
                  aiLive
                    ? "Brief parsing, bid scoring, drafting and summaries use the model."
                    : "No API key set, so AI endpoints return deterministic analysis labelled as offline."
                }
              />
            </div>

            {!aiLive && (
              <div className="mt-3 rounded-lg border border-white/12 bg-white/5 p-3">
                <p className="text-[0.6875rem] leading-relaxed faint">
                  Add one of{" "}
                  <code className="font-mono text-white/70">OPENAI_API_KEY</code>,{" "}
                  <code className="font-mono text-white/70">ANTHROPIC_API_KEY</code>,{" "}
                  <code className="font-mono text-white/70">GEMINI_API_KEY</code>,{" "}
                  <code className="font-mono text-white/70">GROQ_API_KEY</code> or{" "}
                  <code className="font-mono text-white/70">OLLAMA_BASE_URL</code> to{" "}
                  <code className="font-mono text-white/70">.env.local</code> and restart.
                </p>
              </div>
            )}

            {probe && (
              <div
                className={cn(
                  "mt-3 rounded-lg border p-3",
                  probe.ok ? "border-white/20 bg-white/[0.04]" : "border-white/12 bg-white/[0.02]"
                )}
              >
                <p className="text-[0.6875rem] leading-relaxed text-white/75">
                  {probe.ok ? (
                    <>
                      Provider answered — <span className="num">{probe.provider}</span> ·{" "}
                      <span className="num">{probe.model}</span>, {probe.latencyMs}ms.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-white">Provider rejected the call.</span>{" "}
                      {probe.detail}
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={testKey} disabled={probing || !connected}>
                  <PlugZap className={cn("size-3.5", probing && "animate-pulse")} />
                  {probing ? "Testing…" : "Test the key"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => refresh()} disabled={syncing}>
                  <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
                  Resync
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearCache}
                  disabled={clearing || !connected}
                  title="Drop cached model replies — useful after switching provider or model"
                >
                  <Eraser className={cn("size-3.5", clearing && "animate-pulse")} />
                  Clear AI cache
                </Button>
              </div>
              <span className="text-[0.625rem] faint">
                {aiStatus?.capabilities.length ?? 0} AI capabilities
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusRow({
  icon,
  title,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
  tone: "good" | "warn";
}) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border",
          tone === "good"
            ? "border-white/30 text-white"
            : "border-white/15 text-white/50"
        )}
      >
        {tone === "good" ? icon : <AlertTriangle className="size-3.5" />}
      </span>
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-medium text-white">{title}</p>
        <p className="text-[0.6875rem] text-white/70">{value}</p>
        <p className="mt-0.5 text-[0.6875rem] leading-relaxed faint">{detail}</p>
      </div>
    </div>
  );
}

/** Slim banner shown only when the API is unreachable. */
export function OfflineBanner() {
  const { connected, syncError, refresh } = useStore();
  if (connected) return null;
  return (
    <div className="border-b border-white/15 bg-white/5">
      <div className="frame flex flex-wrap items-center gap-3 py-2.5">
        <WifiOff className="size-3.5 shrink-0 text-white/70" />
        <p className="flex-1 text-[0.75rem] text-white/75">
          {syncError ?? "The API is unreachable"} — showing seeded demo data. Changes
          will not persist.
        </p>
        <button
          onClick={() => refresh()}
          className="text-[0.75rem] font-medium text-white underline underline-offset-2 hover:no-underline"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
