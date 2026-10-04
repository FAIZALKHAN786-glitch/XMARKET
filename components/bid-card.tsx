"use client";

import * as React from "react";
import {
  BadgeCheck,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  Paperclip,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  Trophy,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { usd, fromNow } from "@/lib/format";
import { scoreToken } from "@/lib/engine";
import type { Bid, Provider, Requirement, Score } from "@/lib/types";
import { Avatar, Badge, Button, Rating, StatusBadge } from "./ui/primitives";
import { ScoreBreakdown, ScorePill } from "./ui/score";

export function MilestoneRail({
  bid,
  className,
}: {
  bid: Bid;
  className?: string;
}) {
  const total = bid.deliveryDays || 1;
  return (
    <ol className={cn("relative space-y-3", className)}>
      {bid.milestones.map((m, i) => {
        const left = (m.days / total) * 100;
        return (
          <li key={m.label} className="relative grid grid-cols-[1.25rem_1fr] gap-3">
            <span className="relative flex justify-center">
              <span className="absolute inset-y-0 w-px bg-white/10" />
              <span
                className={cn(
                  "relative z-10 mt-1 size-2.5 rounded-full ring-4 ring-ink-850",
                  i === bid.milestones.length - 1
                    ? "bg-[var(--color-aqua-400)]"
                    : "bg-[var(--color-iris-400)]"
                )}
              />
            </span>
            <div className="flex items-baseline justify-between gap-3 pb-0.5">
              <span className="text-[0.8125rem] text-white/85">{m.label}</span>
              <span className="num shrink-0 text-xs faint">
                day {m.days} · {left.toFixed(0)}%
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function BidCard({
  bid,
  provider,
  score,
  requirement,
  rank,
  variant = "feed",
  selected,
  onToggleSelect,
  onInspect,
  onStatus,
  actions,
  className,
}: {
  bid: Bid;
  provider?: Provider;
  score: Score;
  requirement?: Requirement;
  rank?: number;
  variant?: "feed" | "compact";
  selected?: boolean;
  onToggleSelect?: () => void;
  onInspect?: () => void;
  onStatus?: (status: Bid["status"]) => void;
  actions?: React.ReactNode;
  className?: string;
}) {
  const token = scoreToken(score.total);
  const top = rank === 1;

  return (
    <article
      className={cn(
        "surface relative overflow-hidden transition",
        selected
          ? "border-[var(--color-iris-400)]/55 shadow-[0_0_0_1px_rgba(109,93,246,0.35),0_24px_60px_-34px_rgba(109,93,246,0.9)]"
          : "hover:border-white/16",
        className
      )}
    >
      {top && (
        <div className="flex items-center gap-2 bg-gradient-to-r from-[var(--color-iris-500)]/25 via-[var(--color-aqua-500)]/12 to-transparent px-5 py-1.5 text-[0.6875rem] font-semibold tracking-wide text-[var(--color-iris-300)]">
          <Trophy className="size-3" />
          Best compatibility match
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start gap-4">
          {onToggleSelect && (
            <button
              onClick={onToggleSelect}
              aria-pressed={selected}
              aria-label={selected ? "Remove from comparison" : "Add to comparison"}
              className={cn(
                "mt-1 grid size-5 shrink-0 place-items-center rounded-md border transition",
                selected
                  ? "border-[var(--color-iris-400)] bg-[var(--color-iris-500)] text-white"
                  : "border-white/20 text-transparent hover:border-white/40"
              )}
            >
              <Check className="size-3.5" strokeWidth={3} />
            </button>
          )}

          <Avatar
            initials={provider?.initials ?? "??"}
            size={46}
            seed={(provider?.name.length ?? 3) + (rank ?? 0)}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[0.9375rem] font-semibold text-white">
                {provider?.name ?? "Unknown provider"}
              </h3>
              {provider?.verified && (
                <BadgeCheck
                  className="size-4 text-[var(--color-aqua-400)]"
                  aria-label="Verified provider"
                />
              )}
              {rank !== undefined && (
                <span className="num text-[0.6875rem] faint">#{rank}</span>
              )}
            </div>
            <p className="mt-1 line-clamp-1 text-[0.8125rem] muted">
              {provider?.tagline}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.75rem] faint">
              {provider && <Rating value={provider.rating} count={provider.reviews} />}
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" />
                {provider?.onTimeRate}% on time · {provider?.completedJobs} jobs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {provider?.location}
              </span>
            </div>
          </div>

          <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
            <ScorePill score={score.total} />
            <span className={cn("text-[0.6875rem] font-semibold", token.text)}>
              {score.grade} fit
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Offer price" value={usd(bid.price)} hero />
          <Metric
            label="Delivery"
            value={`${bid.deliveryDays} days`}
            icon={<CalendarClock className="size-3.5" />}
          />
          <Metric
            label="Budget vs cap"
            value={
              requirement
                ? `${Math.round((bid.price / requirement.budgetMax) * 100)}%`
                : "—"
            }
            tone={
              requirement && bid.price <= requirement.budgetMax ? "good" : "bad"
            }
          />
          <Metric
            label="Submitted"
            value={fromNow(bid.createdAt)}
            icon={<Clock3 className="size-3.5" />}
          />
        </div>

        <p className="mt-4 line-clamp-3 text-[0.8125rem] leading-relaxed text-white/75">
          {bid.pitch}
        </p>

        {variant === "feed" && (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {bid.coversTags.slice(0, 5).map((tag) => {
                const covered = requirement?.tags.includes(tag) ?? true;
                return (
                  <span
                    key={tag}
                    className={cn(
                      "chip",
                      covered
                        ? "border-[var(--color-score-high)]/30 bg-[color-mix(in_oklab,var(--color-score-high)_10%,transparent)] text-[var(--color-score-high)]"
                        : "text-white/55"
                    )}
                  >
                    {covered ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : (
                      <X className="size-3" />
                    )}
                    {tag}
                  </span>
                );
              })}
            </div>

            <div className="mt-5 grid gap-5 border-t border-white/8 pt-5 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <p className="mb-3 text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
                  Delivery plan
                </p>
                <MilestoneRail bid={bid} />
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
                    Why this score
                  </p>
                  {onInspect && (
                    <button
                      onClick={onInspect}
                      className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-[var(--color-iris-300)] hover:text-white"
                    >
                      Full breakdown <ChevronRight className="size-3" />
                    </button>
                  )}
                </div>
                <ScoreBreakdown score={score} compact />
              </div>
            </div>
          </>
        )}

        {bid.attachments && bid.attachments.length > 0 && variant === "feed" && (
          <div className="mt-4 flex flex-wrap gap-2">
            {bid.attachments.map((file) => (
              <span key={file} className="chip text-white/60">
                <Paperclip className="size-3" />
                {file}
              </span>
            ))}
          </div>
        )}

        {(actions || onStatus) && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
            <StatusBadge status={bid.status} />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {actions}
              {onStatus && (
                <>
                  {bid.status !== "accepted" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onStatus("rejected")}
                      disabled={bid.status === "rejected"}
                    >
                      <ThumbsDown className="size-3.5" />
                      Decline
                    </Button>
                  )}
                  {bid.status !== "shortlisted" && bid.status !== "accepted" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onStatus("shortlisted")}
                    >
                      <Sparkles className="size-3.5" />
                      Shortlist
                    </Button>
                  )}
                  {bid.status !== "accepted" && (
                    <Button size="sm" onClick={() => onStatus("accepted")}>
                      <Check className="size-3.5" />
                      Accept offer
                    </Button>
                  )}
                  {bid.status !== "pending" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onStatus("pending")}
                    >
                      Reopen
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  icon,
  hero,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  hero?: boolean;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.1em] faint uppercase">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "num mt-1 font-semibold",
          hero ? "text-lg text-white" : "text-[0.875rem] text-white/85",
          tone === "good" && "text-[var(--color-score-high)]",
          tone === "bad" && "text-[var(--color-score-low)]"
        )}
      >
        {value}
      </p>
    </div>
  );
}
