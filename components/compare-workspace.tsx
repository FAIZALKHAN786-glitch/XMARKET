"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Check,
  Crown,
  Download,
  Minus,
  Printer,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingDown,
  Trophy,
  Wallet,
  Layers,
  X,
} from "lucide-react";
import { api, isApiError, type SemanticBlendMeta } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/data";
import { rankBids, scoreToken } from "@/lib/engine";
import { dateLabel, usd } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Bid, Provider, Requirement, Score, Weights } from "@/lib/types";
import { AiSummaryPanel } from "./ai-summary";
import { MilestoneRail } from "./bid-card";
import type { Tone } from "./ui/primitives";
import { CategoryMark } from "./icons";
import { WeightsPanel } from "./weights-panel";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Progress,
  Rating,
  StatusBadge,
} from "./ui/primitives";
import { ScoreBreakdown, ScorePill, ScoreRing } from "./ui/score";
import { Modal } from "./ui/overlay";

type Row = {
  bid: Bid;
  provider?: Provider;
  score: Score;
  /** Model-judged fit, present only on a blended ranking. */
  semantic?: number | null;
};

const SEMANTIC_WEIGHT = 0.25;

const weightKey = (w: Weights) =>
  `${w.budget.toFixed(3)}/${w.timeline.toFixed(3)}/${w.relevance.toFixed(3)}`;

export function CompareWorkspace({ requirementId }: { requirementId: string }) {
  const {
    requirements,
    bids,
    providers,
    weights,
    setBidStatus,
    meBuyerId,
    pushToast,
  } = useStore();

  const requirement = requirements.find((r) => r.id === requirementId);
  const [excluded, setExcluded] = React.useState<string[]>([]);
  const [detail, setDetail] = React.useState<Row | null>(null);
  const [awardOpen, setAwardOpen] = React.useState(false);
  const [awarded, setAwarded] = React.useState<string | null>(null);

  // AI-fit blend: off until asked for. Turning it on asks the server for a
  // ranking that mixes the model's read of each pitch into the total; the
  // deterministic engine still owns the default view.
  const [aiRows, setAiRows] = React.useState<Row[] | null>(null);
  const [aiMeta, setAiMeta] = React.useState<SemanticBlendMeta | null>(null);
  const [aiBusy, setAiBusy] = React.useState(false);
  // The blend belongs to one requirement at one set of weights: change either
  // and the deterministic ranking takes over again rather than showing a
  // stale, server-ranked view.
  const [aiFor, setAiFor] = React.useState<string | null>(null);

  const blendKey = `${requirementId}:${weightKey(weights)}`;
  React.useEffect(() => {
    if (aiRows && aiFor && aiFor !== blendKey) {
      setAiRows(null);
      setAiMeta(null);
      setAiFor(null);
    }
  }, [aiRows, aiFor, blendKey]);

  if (!requirement) {
    return (
      <div className="frame pt-16 pb-24">
        <EmptyState
          icon={<Layers className="size-5" />}
          title="Requirement not found"
          body="This requirement may have been withdrawn."
          action={
            <ButtonLink href="/compare" variant="outline">
              Back to comparison
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const ranked: Row[] = (
    aiRows ??
    rankBids(
      bids.filter((b) => b.requirementId === requirement.id),
      requirement,
      providers,
      weights
    )
  ).filter((r) => !excluded.includes(r.bid.id));

  const blend = async () => {
    setAiBusy(true);
    try {
      const result = await api.compare(requirement.id, {
        ...weights,
        semantic: SEMANTIC_WEIGHT,
      });
      const rows: Row[] = result.ranked.map((row) => ({
        bid: row.bid,
        provider: row.provider,
        semantic: row.semantic,
        score: row.semantic == null
          ? row.score
          : {
              ...row.score,
              factors: [
                ...row.score.factors,
                {
                  key: "semantic",
                  label: "AI fit",
                  score: row.semantic,
                  weight: SEMANTIC_WEIGHT,
                  detail:
                    "The model's read of how directly this pitch answers the brief. Blended at 25%.",
                },
              ],
            },
      }));
      setAiRows(rows);
      setAiMeta(result.semanticMeta);
      setAiFor(blendKey);
      const meta = result.semanticMeta;
      pushToast({
        title: "AI fit blended into the ranking",
        body: meta
          ? meta.mode === "llm"
            ? `${meta.scoredBids} of ${meta.requestedBids} offers scored by ${meta.provider} · ${meta.model}.`
            : "No model answered, so the offline heuristic judged the pitches instead."
          : "Ranking recomputed with semantic weighting.",
        tone: meta?.mode === "llm" ? "success" : "warn",
      });
    } catch (err) {
      const message = isApiError(err)
        ? err.message
        : "Could not reach the ranking service";
      pushToast({ title: "AI blend unavailable", body: message, tone: "error" });
    } finally {
      setAiBusy(false);
    }
  };

  const isOwner = requirement.buyerId === meBuyerId;
  const category = CATEGORIES.find((c) => c.id === requirement.category)!;

  if (ranked.length === 0) {
    return (
      <div className="frame pt-10 pb-16">
        <BackLink />
        <div className="mt-8">
          <EmptyState
            icon={<Target className="size-5" />}
            title="No offers to compare"
            body="Providers matched to this requirement have been notified. Offers appear here the moment they land."
            action={
              <ButtonLink href={`/market/${requirement.id}`} variant="outline">
                View requirement
              </ButtonLink>
            }
          />
        </div>
      </div>
    );
  }

  const best = ranked[0];
  const cheapest = [...ranked].sort((a, b) => a.bid.price - b.bid.price)[0];
  const fastest = [...ranked].sort(
    (a, b) => a.bid.deliveryDays - b.bid.deliveryDays
  )[0];
  const columns = ranked;

  return (
    <div className="frame pt-8 pb-16 md:pt-10">
      <BackLink />

      {/* ------------------------------------------------------ header */}
      <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <CategoryMark category={requirement.category} size={46} />
          <div>
            <p className="text-[0.6875rem] font-bold tracking-[0.2em] text-white/75 uppercase">
              Comparison workspace
            </p>
            <h1 className="mt-1.5 text-[1.5rem] leading-tight font-semibold text-white md:text-[1.875rem]">
              {requirement.title}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem] faint">
              <span>{category.label}</span>
              <span className="num">
                ceiling {usd(requirement.budgetMax)}
              </span>
              <span className="num">
                needed by {dateLabel(requirement.deadline)}
              </span>
              <StatusBadge status={requirement.status} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            Print / PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const csv = [
                [
                  "provider",
                  "price",
                  "delivery_days",
                  "score",
                  ...weightsCells(weights),
                ].join(","),
                ...ranked.map((r) =>
                  [
                    `"${r.provider?.name ?? ""}"`,
                    r.bid.price,
                    r.bid.deliveryDays,
                    r.score.total,
                    ...r.score.factors.map((f) => f.score),
                  ].join(",")
                ),
              ].join("\n");
              const url = URL.createObjectURL(
                new Blob([csv], { type: "text/csv" })
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = `${requirement.id}-offers.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
          <Button onClick={() => setAwardOpen(true)}>
            <Trophy className="size-4" />
            Award {best.provider?.name?.split(" ")[0]}
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------- award banner */}
      {awarded && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/40 bg-white/10 p-4">
          <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-white">
            <Check className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.875rem] font-semibold text-white">
              Offer accepted — {awarded}
            </p>
            <p className="text-xs text-white/70">
              Remaining proposals have been moved to declined. Work starts on
              the agreed milestones.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAwarded(null)}>
            Undo
          </Button>
        </div>
      )}

      {/* ------------------------------------------------------ AI read */}
      <AiSummaryPanel
        className="mt-6"
        requirementId={requirement.id}
        weights={weights}
        offerCount={ranked.length}
        providerNames={Object.fromEntries(
          ranked.map((r) => [r.bid.providerId, r.provider?.name ?? r.bid.providerId])
        )}
      />

      {/* ------------------------------------------------- top summary */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-3">
          <Highlight
            icon={<Crown className="size-4" />}
            label="Best compatibility"
            value={`${best.score.total} · ${best.score.grade}`}
            body={best.provider?.name ?? ""}
            tone="outline"
          />
          <Highlight
            icon={<TrendingDown className="size-4" />}
            label="Lowest price"
            value={usd(cheapest.bid.price)}
            body={`${Math.round(
              (1 - cheapest.bid.price / requirement.budgetMax) * 100
            )}% under ceiling · ${cheapest.provider?.name}`}
            tone="good"
          />
          <Highlight
            icon={<Timer className="size-4" />}
            label="Fastest delivery"
            value={`${fastest.bid.deliveryDays} days`}
            body={`${fastest.provider?.name} — score ${fastest.score.total}`}
            tone="muted"
          />
        </div>

        <WeightsPanel />
      </div>

      {/* ------------------------------------------------ AI fit weighting */}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.015] px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-white/70">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.8125rem] font-semibold text-white">
            AI fit weighting
          </p>
          <p className="mt-0.5 text-xs leading-relaxed muted">
            {aiMeta
              ? aiMeta.note
              : `Mixes the model's read of each pitch into the compatibility score at ${Math.round(
                  SEMANTIC_WEIGHT * 100
                )}%. Off by default — running it sends this brief and its live offers to the model.`}
          </p>
        </div>
        {aiMeta && (
          <Badge tone={aiMeta.mode === "llm" ? "outline" : "muted"}>
            {aiMeta.mode === "llm"
              ? `${aiMeta.provider} · ${aiMeta.model}${aiMeta.cached ? " · cached" : ` · ${aiMeta.latencyMs}ms`}`
              : "offline analysis"}
          </Badge>
        )}
        <div className="flex items-center gap-2">
          {aiRows && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAiRows(null);
                setAiMeta(null);
                setAiFor(null);
              }}
            >
              Reset
            </Button>
          )}
          <Button
            size="sm"
            variant={aiRows ? "secondary" : "outline"}
            disabled={aiBusy}
            onClick={blend}
          >
            {aiBusy
              ? "Scoring offers…"
              : aiRows
                ? "Re-run AI fit"
                : "Blend AI fit"}
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------- matrix */}
      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[1.0625rem] font-semibold text-white">
              Offer matrix
            </h2>
            <p className="mt-1 text-[0.8125rem] muted">
              {columns.length} offers compared across{" "}
              {aiRows ? "10 decision factors, AI fit included" : "9 decision factors"}.
              {aiRows ? " Server-ranked. " : " "}
              Scroll horizontally on small screens.
            </p>
          </div>
          {excluded.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExcluded([])}
            >
              Restore {excluded.length} hidden offer
              {excluded.length === 1 ? "" : "s"}
            </Button>
          )}
        </div>

        <div className="surface mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 w-44 border-b border-white/10 bg-ink-900 p-4 align-bottom"
                  >
                    <span className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
                      Factor
                    </span>
                  </th>
                  {columns.map((row, i) => (
                    <th
                      key={row.bid.id}
                      scope="col"
                      className={cn(
                        "min-w-[13rem] border-b border-l border-white/10 p-4 align-top",
                        i === 0 && "bg-white/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            initials={row.provider?.initials ?? "??"}
                            size={34}
                            seed={(row.provider?.name.length ?? 2) + i}
                          />
                          <div>
                            <p className="flex items-center gap-1 text-[0.8125rem] font-semibold text-white">
                              {row.provider?.name}
                              {row.provider?.verified && (
                                <BadgeCheck className="size-3.5 text-white/60" />
                              )}
                            </p>
                            <p className="text-[0.6875rem] faint">
                              {row.provider?.location}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setExcluded((prev) => [...prev, row.bid.id])
                          }
                          aria-label={`Hide ${row.provider?.name}`}
                          className="grid size-6 place-items-center rounded-md text-white/30 transition hover:bg-white/5 hover:text-white"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                      {i === 0 && (
                        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[0.625rem] font-semibold text-white/75">
                          <Trophy className="size-3" /> Leading offer
                        </span>
                      )}
                      <div className="mt-3 flex items-center gap-3">
                        <ScoreRing score={row.score.total} size={54} stroke={5} />
                        <div>
                          <StatusBadge status={row.bid.status} />
                          <p className="mt-1.5 text-[0.6875rem] faint">
                            rank #{i + 1}
                          </p>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                <MatrixRow
                  label="Offer price"
                  icon={<Wallet className="size-3.5" />}
                  columns={columns}
                  highlightIndex={columns.indexOf(cheapest)}
                  render={(row) => (
                    <span className="num text-base font-bold text-white">
                      {usd(row.bid.price)}
                    </span>
                  )}
                />
                <MatrixRow
                  label="vs. ceiling"
                  columns={columns}
                  highlightIndex={columns.indexOf(cheapest)}
                  render={(row) => {
                    const delta = requirement.budgetMax - row.bid.price;
                    const over = delta < 0;
                    const pct = Math.round((delta / requirement.budgetMax) * 100);
                    return (
                      <span className="flex flex-col gap-1.5">
                        <span
                          className={cn(
                            "num inline-flex items-center gap-1 text-[0.8125rem] font-semibold",
                            over
                              ? "text-white/45"
                              : "text-white"
                          )}
                        >
                          {over ? "+" : "−"}
                          {usd(Math.abs(delta))} ({over ? "+" : ""}
                          {pct}%)
                        </span>
                        <Progress
                          value={Math.min(
                            100,
                            (row.bid.price / requirement.budgetMax) * 100
                          )}
                          barClassName={cn(
                            over
                              ? "bg-white/30"
                              : "bg-white"
                          )}
                        />
                      </span>
                    );
                  }}
                />
                <MatrixRow
                  label="Delivery time"
                  icon={<CalendarClock className="size-3.5" />}
                  columns={columns}
                  highlightIndex={columns.indexOf(fastest)}
                  render={(row) => {
                    const available = Math.max(
                      1,
                      Math.round(
                        (+new Date(requirement.deadline) - Date.now()) /
                          86_400_000
                      )
                    );
                    const slack = available - row.bid.deliveryDays;
                    return (
                      <span className="flex flex-col gap-1">
                        <span className="num text-[0.9375rem] font-semibold text-white">
                          {row.bid.deliveryDays} days
                        </span>
                        <span
                          className={cn(
                            "num text-xs",
                            slack < 0
                              ? "text-white/45"
                              : "text-white"
                          )}
                        >
                          {slack < 0
                            ? `${Math.abs(slack)} days late`
                            : `${slack} days buffer`}
                        </span>
                      </span>
                    );
                  }}
                />
                <MatrixRow
                  label="Budget fit"
                  icon={<Target className="size-3.5" />}
                  columns={columns}
                  render={(row) => (
                    <FactorCell
                      factor={row.score.factors.find((f) => f.key === "budget")!}
                    />
                  )}
                />
                <MatrixRow
                  label="Timeline match"
                  columns={columns}
                  render={(row) => (
                    <FactorCell
                      factor={row.score.factors.find((f) => f.key === "timeline")!}
                    />
                  )}
                />
                <MatrixRow
                  label="Relevance"
                  columns={columns}
                  render={(row) => (
                    <FactorCell
                      factor={row.score.factors.find((f) => f.key === "relevance")!}
                    />
                  )}
                />
                {aiRows && (
                  <MatrixRow
                    label="AI fit"
                    icon={<Sparkles className="size-3.5" />}
                    columns={columns}
                    render={(row) => {
                      if (row.semantic == null) {
                        return (
                          <span className="text-xs faint">
                            not scored — deterministic total kept
                          </span>
                        );
                      }
                      const token = scoreToken(row.semantic);
                      return (
                        <span className="flex flex-col gap-1.5">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={cn("num font-semibold", token.text)}>
                              {row.semantic}
                            </span>
                            <span className="num text-[0.625rem] faint">
                              ×{SEMANTIC_WEIGHT.toFixed(2)}
                            </span>
                          </span>
                          <Progress
                            value={row.semantic}
                            barClassName={token.bg}
                          />
                          <span className="text-[0.6875rem] leading-relaxed faint">
                            model&rsquo;s read of the pitch
                          </span>
                        </span>
                      );
                    }}
                  />
                )}
                <MatrixRow
                  label="Tag coverage"
                  columns={columns}
                  render={(row) => {
                    const covered = requirement.tags.filter((t) =>
                      row.bid.coversTags.includes(t)
                    ).length;
                    const total = requirement.tags.length;
                    const all = covered === total;
                    return (
                      <span className="flex flex-col gap-1.5">
                        <span
                          className={cn(
                            "num text-[0.8125rem] font-semibold",
                            all
                              ? "text-white"
                              : "text-white/75"
                          )}
                        >
                          {covered}/{total} tags
                        </span>
                        <div className="flex gap-1">
                          {requirement.tags.map((t) => (
                            <span
                              key={t}
                              title={t}
                              className={cn(
                                "h-1.5 flex-1 rounded-full",
                                row.bid.coversTags.includes(t)
                                  ? "bg-white"
                                  : "bg-white/10"
                              )}
                            />
                          ))}
                        </div>
                      </span>
                    );
                  }}
                />
                <MatrixRow
                  label="Provider evidence"
                  columns={columns}
                  render={(row) => (
                    <span className="flex flex-col gap-1 text-xs">
                      <Rating
                        value={row.provider?.rating ?? 0}
                        count={row.provider?.reviews}
                      />
                      <span className="inline-flex items-center gap-1.5 faint">
                        <ShieldCheck className="size-3" />
                        {row.provider?.onTimeRate}% on time
                      </span>
                      <span className="inline-flex items-center gap-1.5 faint">
                        <Timer className="size-3" />
                        replies in {row.provider?.responseHours}h
                      </span>
                      <span className="inline-flex items-center gap-1.5 faint">
                        <Star className="size-3" />
                        {row.provider?.completedJobs} jobs since{" "}
                        {row.provider?.memberSince}
                      </span>
                    </span>
                  )}
                />
                <MatrixRow
                  label="Milestone plan"
                  columns={columns}
                  render={(row) => (
                    <MilestoneRail
                      bid={row.bid}
                      className="text-[0.6875rem] [&_span]:text-[0.75rem]"
                    />
                  )}
                />
                <MatrixRow
                  label="Total compatibility"
                  columns={columns}
                  emphasis
                  render={(row) => (
                    <span className="flex items-center gap-3">
                      <ScorePill score={row.score.total} />
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          scoreToken(row.score.total).text
                        )}
                      >
                        {row.score.grade}
                      </span>
                    </span>
                  )}
                />
                <tr>
                  <td className="sticky left-0 z-10 border-t border-white/10 bg-ink-900 p-4">
                    <span className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
                      Decision
                    </span>
                  </td>
                  {columns.map((row) => (
                    <td
                      key={`d-${row.bid.id}`}
                      className={cn(
                        "border-t border-l border-white/10 p-4",
                        row === best &&
                          "bg-white/5"
                      )}
                    >
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDetail(row)}
                        >
                          Inspect
                        </Button>
                        {row.bid.status !== "shortlisted" &&
                          row.bid.status !== "accepted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setBidStatus(row.bid.id, "shortlisted")
                              }
                            >
                              <Sparkles className="size-3" />
                              Shortlist
                            </Button>
                          )}
                        <Button
                          size="sm"
                          onClick={() => {
                            setBidStatus(row.bid.id, "accepted");
                            ranked
                              .filter((r) => r.bid.id !== row.bid.id)
                              .forEach((r) =>
                                setBidStatus(r.bid.id, "rejected")
                              );
                            setAwarded(row.provider?.name ?? "Provider");
                          }}
                        >
                          <Check className="size-3" />
                          Award
                        </Button>
                        {isOwner && row.bid.status !== "rejected" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setBidStatus(row.bid.id, "rejected")}
                          >
                            Decline
                          </Button>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-2 text-xs faint">
          <Minus className="size-3" />
          Highlighted cells mark the best value in that row under your current
          weighting. Change the sliders above to re-rank instantly.
        </p>
      </section>

      {/* ---------------------------------------------- per-offer insights */}
      <section className="mt-10">
        <h2 className="text-[1.0625rem] font-semibold text-white">
          Why each offer scored what it did
        </h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {columns.map((row) => (
            <Card key={row.bid.id}>
              <div className="flex items-center gap-3">
                <Avatar
                  initials={row.provider?.initials ?? "??"}
                  size={38}
                  seed={(row.provider?.name.length ?? 3) + row.score.total}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.875rem] font-semibold text-white">
                    {row.provider?.name}
                  </p>
                  <p className="num text-xs faint">
                    {usd(row.bid.price)} · {row.bid.deliveryDays} days
                  </p>
                </div>
                <ScoreRing score={row.score.total} size={46} stroke={4} />
              </div>
              <div className="mt-4">
                <ScoreBreakdown score={row.score} compact />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- modals */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Offer detail"
        description={detail?.provider?.name}
        size="lg"
      >
        {detail && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <Fact label="Price" value={usd(detail.bid.price)} />
              <Fact
                label="Delivery"
                value={`${detail.bid.deliveryDays} days`}
              />
              <Fact label="Score" value={String(detail.score.total)} />
            </div>
            <ScoreBreakdown score={detail.score} />
            <div>
              <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
                Pitch
              </p>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-white/80">
                {detail.bid.pitch}
              </p>
            </div>
            <div>
              <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
                Milestones
              </p>
              <MilestoneRail bid={detail.bid} className="mt-3" />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={awardOpen}
        onClose={() => setAwardOpen(false)}
        title="Accept this offer"
        description={`${best.provider?.name} — ${usd(best.bid.price)} in ${best.bid.deliveryDays} days`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAwardOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setBidStatus(best.bid.id, "accepted");
                ranked
                  .filter((r) => r.bid.id !== best.bid.id)
                  .forEach((r) => setBidStatus(r.bid.id, "rejected"));
                setAwarded(best.provider?.name ?? "Provider");
                setAwardOpen(false);
              }}
            >
              <Trophy className="size-4" />
              Accept & notify provider
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <ScoreRing score={best.score.total} size={64} stroke={6} />
            <div>
              <p className="text-[0.875rem] font-semibold text-white">
                {best.score.grade} compatibility
              </p>
              <p className="mt-1 text-[0.8125rem] muted">
                {best.score.strengths[0] ?? "Strong across all factors."}
              </p>
            </div>
          </div>
          <ul className="space-y-2.5">
            {[
              "The provider is notified and the deal enters the milestones timeline",
              "All other proposals on this requirement are declined",
              "Scope, price and schedule are frozen at the values shown",
            ].map((t) => (
              <li key={t} className="flex gap-2.5 text-[0.8125rem] text-white/80">
                <Check className="mt-0.5 size-3.5 shrink-0 text-white" />
                {t}
              </li>
            ))}
          </ul>
          {best.score.risks.length > 0 && (
            <div className="rounded-xl border border-white/20 bg-white/5 p-3.5">
              <p className="text-xs font-semibold text-white/75">
                Watch before you sign
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/75">
                {best.score.risks[0]}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function BackLink() {
  return (
    <Link
      href="/compare"
      className="inline-flex items-center gap-1.5 text-[0.8125rem] text-white/55 transition hover:text-white"
    >
      <ArrowLeft className="size-3.5" />
      All comparisons
    </Link>
  );
}

function weightsCells(weights: Weights) {
  return [
    weights.budget.toFixed(3),
    weights.timeline.toFixed(3),
    weights.relevance.toFixed(3),
  ];
}

function MatrixRow({
  label,
  icon,
  columns,
  render,
  highlightIndex,
  emphasis,
}: {
  label: string;
  icon?: React.ReactNode;
  columns: Row[];
  render: (row: Row) => React.ReactNode;
  highlightIndex?: number;
  emphasis?: boolean;
}) {
  return (
    <tr className={cn(emphasis && "bg-white/[0.02]")}>
      <th
        scope="row"
        className="sticky left-0 z-10 border-t border-white/10 bg-ink-900 p-4 text-left align-top"
      >
        <span className="flex items-center gap-1.5 text-[0.75rem] font-medium text-white/70">
          {icon}
          {label}
        </span>
      </th>
      {columns.map((row, i) => (
        <td
          key={`${label}-${row.bid.id}`}
          className={cn(
            "border-t border-l border-white/10 p-4 align-top",
            highlightIndex === i &&
              "bg-white/5"
          )}
        >
          {render(row)}
        </td>
      ))}
    </tr>
  );
}

function FactorCell({
  factor,
}: {
  factor: Score["factors"][number];
}) {
  const token = scoreToken(factor.score);
  return (
    <span className="flex flex-col gap-1.5">
      <span className="flex items-baseline gap-2">
        <span className={cn("num text-[0.9375rem] font-bold", token.text)}>
          {factor.score}
        </span>
        <span className="num text-[0.6875rem] faint">
          ×{factor.weight.toFixed(2)}
        </span>
      </span>
      <Progress value={factor.score} barClassName={token.bg} />
      <span className="text-[0.6875rem] leading-relaxed faint">
        {factor.detail}
      </span>
    </span>
  );
}

function Highlight({
  icon,
  label,
  value,
  body,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  body: string;
  tone: Tone;
}) {
  const tones: Record<Tone, string> = {
    neutral: "text-white/70",
    outline: "text-white",
    solid: "text-white",
    muted: "text-white/60",
    good: "text-white",
    warn: "text-white/75",
    bad: "text-white/40",
  };
  return (
    <div className="bg-ink-900 p-4">
      <p className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.12em] faint uppercase">
        <span className={tones[tone]}>{icon}</span>
        {label}
      </p>
      <p className="num mt-2 text-lg font-bold text-white">{value}</p>
      <p className="mt-0.5 truncate text-xs faint">{body}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[0.625rem] font-semibold tracking-[0.12em] faint uppercase">
        {label}
      </p>
      <p className="num mt-1 text-[0.9375rem] font-semibold text-white">
        {value}
      </p>
    </div>
  );
}
