"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";
import { usd } from "@/lib/format";
import type { Bid, Requirement } from "@/lib/types";

type Ranked = {
  bid: Bid;
  provider?: { id: string; name: string } | null;
  score?: { total?: number } | null;
  semantic?: number | null;
};

/**
 * The award decision for one requirement.
 *
 * The engine's ranking is shown as a recommendation, never as a verdict — the
 * buyer can accept the top-ranked offer or any other one. That choice is
 * deliberate: the score summarises budget, timeline and relevance, but only the
 * buyer knows the context the score cannot see.
 */
export function OfferDecision({ requirement }: { requirement: Requirement }) {
  const { bids, providers, weights, setBidStatus, pushToast } = useStore();
  const [ranked, setRanked] = React.useState<Ranked[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const offers = bids.filter((b) => b.requirementId === requirement.id);
  const awarded = offers.find((b) => b.status === "accepted");

  // Blend the model's read of each pitch in, the same way the compare workspace
  // does, so the recommendation here and there cannot disagree.
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        wBudget: String(weights.budget),
        wTimeline: String(weights.timeline),
        wRelevance: String(weights.relevance),
        wSemantic: "0.25",
      });
      const response = await fetch(
        `/api/requirements/${requirement.id}/compare?${qs}`
      );
      const json = await response.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Could not rank offers.");
      setRanked(json.data.ranked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rank offers.");
    } finally {
      setLoading(false);
    }
  }, [requirement.id, weights]);

  const accept = async (bid: Bid) => {
    setBusyId(bid.id);
    try {
      await setBidStatus(bid.id, "accepted");
      pushToast({
        title: "Offer accepted",
        body: "The seller has been notified in their dashboard.",
        tone: "success",
      });
    } catch (err) {
      pushToast({
        title: "Could not accept that offer",
        body: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  };

  if (awarded) {
    const provider =
      providers.find((p) => p.id === awarded.providerId)?.name ??
      awarded.providerId;
    return (
      <div className="mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white">
        Awarded to {provider} at {usd(awarded.price)}.
      </div>
    );
  }

  if (offers.length === 0) {
    return <p className="mt-4 text-sm muted">No offers yet.</p>;
  }

  return (
    <div className="mt-4">
      {ranked === null && !loading && (
        <Button variant="outline" size="sm" onClick={load}>
          <Sparkles className="size-4" />
          Rank these offers
        </Button>
      )}

      {loading && <p className="text-sm muted">Ranking offers…</p>}
      {error && <p className="text-sm text-white/85">{error}</p>}

      {ranked && (
        <div className="space-y-2">
          {ranked.map((row, index) => {
            const name =
              row.provider?.name ??
              providers.find((p) => p.id === row.bid.providerId)?.name ??
              row.bid.providerId;
            const isTop = index === 0;
            return (
              <div
                key={row.bid.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-white">
                    {name}
                    {isTop && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-white/15 px-1.5 py-0.5 text-[0.6875rem] uppercase tracking-wide text-white/70">
                        <Sparkles className="size-3" />
                        Engine pick
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs muted">
                    {usd(row.bid.price)} over {row.bid.deliveryDays} days
                    {typeof row.score?.total === "number" &&
                      ` · score ${row.score.total}`}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant={isTop ? "primary" : "secondary"}
                  disabled={busyId !== null}
                  onClick={() => accept(row.bid)}
                >
                  {busyId === row.bid.id ? (
                    "Accepting…"
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      {isTop ? "Accept recommendation" : "Choose this one"}
                    </>
                  )}
                </Button>
              </div>
            );
          })}

          <p className="pt-1 text-xs faint">
            The engine pick is a recommendation. You can accept any offer above,
            or{" "}
            <Link
              href={`/compare/${requirement.id}`}
              className="underline underline-offset-2 hover:text-white"
            >
              open the full comparison
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
