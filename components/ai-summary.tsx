"use client";

import * as React from "react";
import { AlertTriangle, Info, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { api, isApiError, type AiMeta, type ComparisonSummary } from "@/lib/api-client";
import { useStore } from "@/lib/store";
import type { Weights } from "@/lib/types";
import { Badge, Button, Card } from "./ui/primitives";

/**
 * The buyer-facing read on their shortlist.
 *
 * Two deliberate constraints: the summary is generated on demand rather than
 * automatically (so a page view never spends tokens), and it is presented as an
 * explanation of the engine's numbers rather than a second opinion that could
 * contradict them.
 */
export function AiSummaryPanel({
  requirementId,
  weights,
  offerCount,
  providerNames,
  className,
}: {
  requirementId: string;
  weights: Weights;
  offerCount: number;
  providerNames: Record<string, string>;
  className?: string;
}) {
  const { aiStatus, pushToast } = useStore();
  const [summary, setSummary] = React.useState<ComparisonSummary | null>(null);
  const [meta, setMeta] = React.useState<AiMeta | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [focus, setFocus] = React.useState("");

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.ai.summarize(requirementId, weights, focus || undefined);
      setSummary(result.summary);
      setMeta(result.meta);
    } catch (err) {
      const message = isApiError(err) ? err.message : "Summary unavailable";
      setError(message);
      pushToast({ title: "Could not summarise", body: message, tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  const live = aiStatus?.live ?? false;

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-white">
            <Sparkles className="size-4 text-white/70" />
            Read the shortlist
          </p>
          <p className="mt-1 max-w-xl text-[0.8125rem] leading-relaxed muted">
            Explains the {offerCount} offers in plain language, grounded in the
            engine&rsquo;s factor scores. It cannot award anything — that stays
            yours.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {meta && (
            <Badge tone={meta.mode === "llm" ? "outline" : "muted"}>
              {meta.mode === "llm"
                ? `${meta.provider} · ${meta.cached ? "cached" : `${meta.latencyMs}ms`}`
                : "offline analysis"}
            </Badge>
          )}
          <Button
            size="sm"
            variant={summary ? "ghost" : "secondary"}
            onClick={generate}
            disabled={loading || offerCount === 0}
          >
            {summary ? <RefreshCw className="size-3.5" /> : <Sparkles className="size-3.5" />}
            {loading ? "Analysing…" : summary ? "Regenerate" : "Analyse offers"}
          </Button>
        </div>
      </div>

      {!summary && !loading && !error && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
          <input
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Optional: tell it what you care about — “we cannot slip the deadline”"
            className="field h-10 flex-1 text-[0.8125rem]"
            aria-label="Focus for the summary"
          />
        </div>
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-white/15 bg-white/5 p-3 text-[0.8125rem] text-white/80">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {loading && !summary && (
        <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-3 animate-pulse-soft rounded-full bg-white/10"
              style={{ width: `${90 - i * 14}%` }}
            />
          ))}
        </div>
      )}

      {summary && (
        <div className="mt-5 space-y-5 border-t border-white/10 pt-5">
          <div>
            <p className="text-[0.9375rem] leading-snug font-medium text-white">
              {summary.headline}
            </p>
            <p className="mt-2.5 text-[0.8125rem] leading-relaxed muted">
              {summary.recommendation}
            </p>
          </div>

          {summary.tradeoffs.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {summary.tradeoffs.map((t) => (
                <div
                  key={t.providerId}
                  className="rounded-xl border border-white/10 p-3.5"
                >
                  <p className="text-[0.8125rem] font-medium text-white">
                    {providerNames[t.providerId] ?? t.providerId}
                  </p>
                  <p className="mt-2 flex gap-2 text-xs leading-relaxed muted">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-white" />
                    {t.strength}
                  </p>
                  <p className="mt-1.5 flex gap-2 text-xs leading-relaxed text-white/50">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-white/40" />
                    {t.risk}
                  </p>
                </div>
              ))}
            </div>
          )}

          {summary.watchFor.length > 0 && (
            <div className="rounded-xl border border-white/12 bg-white/5 p-3.5">
              <p className="text-[0.75rem] font-medium text-white/80">
                Watch for
              </p>
              <ul className="mt-2 space-y-1.5">
                {summary.watchFor.map((w) => (
                  <li key={w} className="flex gap-2 text-xs leading-relaxed muted">
                    <Info className="mt-0.5 size-3 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[0.6875rem] leading-relaxed faint">
            {meta?.mode === "llm"
              ? `Generated by ${meta.provider} (${meta.model}) from the offer data shown above. Verify anything you intend to act on.`
              : "Computed from the engine's factor scores — no model was called. Configure an API key for a written analysis."}
            {!live && (
              <>
                {" "}
                Set <code className="font-mono text-white/70">OPENAI_API_KEY</code> or{" "}
                <code className="font-mono text-white/70">ANTHROPIC_API_KEY</code> in{" "}
                <code className="font-mono text-white/70">.env.local</code> to switch this on.
              </>
            )}
          </p>
        </div>
      )}
    </Card>
  );
}
