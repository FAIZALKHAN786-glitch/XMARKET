"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  CalendarClock,
  Eye,
  MapPin,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/data";
import { deadlineLabel, usd } from "@/lib/format";
import { daysUntil } from "@/lib/engine";
import { useStore } from "@/lib/store";
import type { Requirement } from "@/lib/types";
import { CategoryMark } from "./icons";
import { Badge, Progress, StatusBadge, TimeAgo } from "./ui/primitives";

export function RequirementCard({
  requirement,
  bidCount,
  className,
}: {
  requirement: Requirement;
  bidCount: number;
  className?: string;
}) {
  const { saved, toggleSaved, meBuyerId } = useStore();
  const isSaved = saved.includes(requirement.id);
  const category = CATEGORIES.find((c) => c.id === requirement.category);
  const mine = requirement.buyerId === meBuyerId;
  const windowLeft = Math.max(0, daysUntil(requirement.closesAt));
  const total = Math.max(1, daysUntil(requirement.closesAt) + 14);

  return (
    <article
      className={cn(
        "surface surface-hover group relative flex flex-col p-5",
        className
      )}
    >
      <div className="flex items-start gap-4">
        <CategoryMark category={requirement.category} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/market/${requirement.id}`}
              className="text-[0.9375rem] leading-snug font-semibold text-white transition group-hover:text-[var(--color-iris-300)]"
            >
              {requirement.title}
            </Link>
            <button
              onClick={() => toggleSaved(requirement.id)}
              aria-label={isSaved ? "Remove bookmark" : "Bookmark requirement"}
              aria-pressed={isSaved}
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-lg border transition",
                isSaved
                  ? "border-[var(--color-iris-400)]/40 bg-[var(--color-iris-500)]/15 text-[var(--color-iris-300)]"
                  : "border-white/10 text-white/40 hover:border-white/25 hover:text-white"
              )}
            >
              <Bookmark
                className={cn("size-3.5", isSaved && "fill-current")}
              />
            </button>
          </div>
          <p className="mt-1.5 line-clamp-2 text-[0.8125rem] leading-relaxed muted">
            {requirement.summary}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{category?.label}</Badge>
        {mine && <Badge tone="iris">Your request</Badge>}
        <StatusBadge status={requirement.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/8 pt-4 text-[0.8125rem]">
        <div>
          <dt className="flex items-center gap-1.5 text-[0.6875rem] tracking-wide faint uppercase">
            <Wallet className="size-3" /> Budget cap
          </dt>
          <dd className="num mt-1 font-semibold text-white">
            {usd(requirement.budgetMax, { compact: true })}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-[0.6875rem] tracking-wide faint uppercase">
            <CalendarClock className="size-3" /> Needed by
          </dt>
          <dd className="mt-1 font-semibold text-white">
            {deadlineLabel(requirement.deadline)}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-[0.6875rem] tracking-wide faint uppercase">
            <Users className="size-3" /> Offers
          </dt>
          <dd className="num mt-1 font-semibold text-white">{bidCount}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-[0.6875rem] tracking-wide faint uppercase">
            <MapPin className="size-3" /> Location
          </dt>
          <dd className="mt-1 truncate font-semibold text-white/85">
            {requirement.location}
          </dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-white/8 pt-4">
        <div className="flex items-center justify-between text-[0.6875rem]">
          <span className="faint">Bidding window</span>
          <span className="num text-white/70">
            {windowLeft} days left · closes{" "}
            <TimeAgo iso={requirement.closesAt} />
          </span>
        </div>
        <Progress
          value={(windowLeft / total) * 100}
          className="mt-2"
          barClassName={cn(
            windowLeft <= 5
              ? "bg-[var(--color-score-low)]"
              : windowLeft <= 12
                ? "bg-[var(--color-score-mid)]"
                : "bg-[var(--color-aqua-400)]"
          )}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs faint">
          <Eye className="size-3" /> {requirement.views} views
        </span>
        <Link
          href={`/market/${requirement.id}`}
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-[var(--color-iris-300)] transition hover:gap-1.5 hover:text-white"
        >
          {mine ? "Review offers" : "View & bid"}
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}
