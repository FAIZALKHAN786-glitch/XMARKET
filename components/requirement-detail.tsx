"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bookmark,
  CalendarClock,
  Check,
  Eye,
  Gauge,
  Layers,
  Lock,
  MapPin,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/data";
import { rankBids } from "@/lib/engine";
import { dateLabel, deadlineLabel, usd } from "@/lib/format";
import { useStore } from "@/lib/store";
import { BidCard } from "./bid-card";
import { BidComposer } from "./bid-composer";
import { CategoryMark } from "./icons";
import { PageHeader } from "./nav";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  Segmented,
  StatusBadge,
  TimeAgo,
} from "./ui/primitives";
import { ScoreBreakdown } from "./ui/score";
import { Modal } from "./ui/overlay";
import type { Tone } from "./ui/primitives";

type SortKey = "compatibility" | "price" | "speed";

export function RequirementDetail({ requirementId }: { requirementId: string }) {
  const {
    requirements,
    bids,
    providers,
    buyers,
    weights,
    saved,
    toggleSaved,
    role,
    meProviderId,
    meBuyerId,
    setBidStatus,
  } = useStore();

  const requirement = requirements.find((r) => r.id === requirementId);
  const [sort, setSort] = React.useState<SortKey>("compatibility");
  const [inspect, setInspect] = React.useState<string | null>(null);
  const [bidOpen, setBidOpen] = React.useState(false);

  if (!requirement) {
    return (
      <div className="frame pt-16 pb-24">
        <EmptyState
          icon={<Layers className="size-5" />}
          title="That requirement no longer exists"
          body="It may have been closed or withdrawn by the buyer."
          action={
            <ButtonLink href="/market" variant="outline">
              Back to marketplace
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const category = CATEGORIES.find((c) => c.id === requirement.category)!;
  const buyer = buyers.find((b) => b.id === requirement.buyerId);
  const isOwner = requirement.buyerId === meBuyerId;
  const isSaved = saved.includes(requirement.id);
  const requirementBids = bids.filter((b) => b.requirementId === requirement.id);
  const ranked = rankBids(requirementBids, requirement, providers, weights);

  const sorted = React.useMemo(() => {
    const copy = [...ranked];
    if (sort === "price") copy.sort((a, b) => a.bid.price - b.bid.price);
    if (sort === "speed")
      copy.sort((a, b) => a.bid.deliveryDays - b.bid.deliveryDays);
    return copy;
  }, [ranked, sort]);

  const lowest = ranked.length
    ? Math.min(...ranked.map((r) => r.bid.price))
    : 0;
  const fastest = ranked.length
    ? Math.min(...ranked.map((r) => r.bid.deliveryDays))
    : 0;
  const inspected = ranked.find((r) => r.bid.id === inspect);
  const myBid = requirementBids.find((b) => b.providerId === meProviderId);

  return (
    <div className="frame pt-8 pb-16 md:pt-10">
      <Link
        href="/market"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] text-white/55 transition hover:text-white"
      >
        <ArrowLeft className="size-3.5" />
        Marketplace
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------------ main col */}
        <div>
          <PageHeader
            eyebrow={category.label}
            title={requirement.title}
            body={requirement.summary}
            actions={
              <>
                <StatusBadge status={requirement.status} />
                <Button
                  size="sm"
                  variant={isSaved ? "secondary" : "outline"}
                  onClick={() => toggleSaved(requirement.id)}
                >
                  <Bookmark
                    className={cn("size-3.5", isSaved && "fill-current")}
                  />
                  {isSaved ? "Saved" : "Save"}
                </Button>
              </>
            }
          />

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] faint">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5" /> {requirement.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" /> {requirementBids.length} offers
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-3.5" /> {requirement.views} views
            </span>
            <span className="inline-flex items-center gap-1.5">
              Posted <TimeAgo iso={requirement.postedAt} />
            </span>
          </div>

          <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-3">
            <Stat
              icon={<Wallet className="size-3.5" />}
              label="Budget ceiling"
              value={usd(requirement.budgetMax)}
              hint={`target ${usd(requirement.budgetTarget)}`}
            />
            <Stat
              icon={<CalendarClock className="size-3.5" />}
              label="Delivery needed"
              value={dateLabel(requirement.deadline)}
              hint={deadlineLabel(requirement.deadline)}
            />
            <Stat
              icon={<Lock className="size-3.5" />}
              label="Bidding closes"
              value={deadlineLabel(requirement.closesAt)}
              hint={dateLabel(requirement.closesAt)}
            />
          </div>

          <section className="mt-8">
            <h2 className="text-[0.9375rem] font-semibold text-white">
              The requirement
            </h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-white/80">
              {requirement.description}
            </p>
          </section>

          <section className="mt-8 grid gap-5 sm:grid-cols-2">
            <Card>
              <p className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
                <Target className="size-3.5" /> Must-haves
              </p>
              <ul className="mt-4 space-y-3">
                {requirement.mustHaves.map((m) => (
                  <li
                    key={m}
                    className="flex gap-2.5 text-[0.8125rem] leading-relaxed text-white/80"
                  >
                    <Check
                      className="mt-0.5 size-3.5 shrink-0 text-white"
                      strokeWidth={3}
                    />
                    {m}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <p className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
                <Sparkles className="size-3.5" /> Spec tags used for scoring
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {requirement.tags.map((t) => (
                  <span key={t} className="chip text-white/70">
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed faint">
                Providers tick the tags they satisfy when bidding — coverage
                drives the relevance factor in their compatibility score.
              </p>
            </Card>
          </section>

          {/* ------------------------------------------------ offers list */}
          <section className="mt-10" id="offers">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[1.0625rem] font-semibold text-white">
                  {ranked.length} offer{ranked.length === 1 ? "" : "s"} received
                </h2>
                <p className="mt-1 text-[0.8125rem] muted">
                  Ranked by compatibility with your current priority weighting.
                </p>
              </div>
              <Segmented
                value={sort}
                onChange={setSort}
                options={[
                  { value: "compatibility", label: "Compatibility" },
                  { value: "price", label: "Lowest price" },
                  { value: "speed", label: "Fastest" },
                ]}
              />
            </div>

            {ranked.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  icon={<Send className="size-5" />}
                  title="No offers yet"
                  body="Providers matched to this category have been notified. Most requirements receive their first offer within an hour."
                />
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {sorted.map((row, i) => (
                  <BidCard
                    key={row.bid.id}
                    bid={row.bid}
                    provider={row.provider}
                    score={row.score}
                    requirement={requirement}
                    rank={sort === "compatibility" ? i + 1 : undefined}
                    onInspect={() => setInspect(row.bid.id)}
                    onStatus={
                      isOwner ? (status) => setBidStatus(row.bid.id, status) : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ----------------------------------------------------- side col */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
          <Card>
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-lg border border-white/12 bg-white/5 text-[0.8125rem] font-semibold text-white/85">
                {buyer?.initials}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-[0.875rem] font-semibold text-white">
                  {buyer?.company}
                  <BadgeCheck className="size-3.5 shrink-0 text-white/60" />
                </p>
                <p className="truncate text-xs faint">
                  {buyer?.name} · {buyer?.location}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
              <MiniStat label="Rating" value={buyer?.rating.toFixed(1) ?? "—"} />
              <MiniStat label="Posted" value={String(buyer?.posted ?? 0)} />
              <MiniStat label="Awarded" value={String(buyer?.awarded ?? 0)} />
            </div>
          </Card>

          {!isOwner && (
            <Card>
              <p className="text-[0.9375rem] font-semibold text-white">
                {myBid ? "You already bid on this" : "Submit a proposal"}
              </p>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed muted">
                {myBid
                  ? `Your offer of ${usd(myBid.price)} is ${
                      myBid.status === "pending"
                        ? "under review"
                        : myBid.status
                    }. You can revise it until the window closes.`
                  : "Price it, schedule it, and see your compatibility score before you commit. Free to bid."}
              </p>
              <Button className="mt-4 w-full" size="lg" onClick={() => setBidOpen(true)}>
                <Send className="size-4" />
                {myBid ? "Revise my offer" : "Write an offer"}
              </Button>
              <ButtonLink
                href={`/compare/${requirement.id}`}
                variant="outline"
                className="mt-2 w-full"
              >
                <Gauge className="size-4" />
                Open comparison view
              </ButtonLink>
              <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
                {[
                  "Scores are visible to buyers, not to competitors",
                  "Track pending → shortlisted → accepted",
                  "No placement fees in this prototype",
                ].map((t) => (
                  <li key={t} className="flex gap-2 text-xs muted">
                    <Check className="mt-0.5 size-3 shrink-0 text-white/60" />
                    {t}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {isOwner && (
            <Card>
              <p className="text-[0.9375rem] font-semibold text-white">
                Buyer controls
              </p>
              <p className="mt-1.5 text-[0.8125rem] leading-relaxed muted">
                Shortlist strong offers, decline outliers, and accept the winner.
                Every action is reversible in this prototype.
              </p>
              <ButtonLink
                href={`/compare/${requirement.id}`}
                className="mt-4 w-full"
              >
                <Gauge className="size-4" />
                Compare all offers
              </ButtonLink>
              <Button
                variant="outline"
                className="mt-2 w-full"
                onClick={() => setBidOpen(true)}
              >
                Preview the provider form
              </Button>
            </Card>
          )}

          <Card>
            <p className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
              <ShieldCheck className="size-3.5" /> Offer snapshot
            </p>
            <dl className="mt-4 space-y-3 text-[0.8125rem]">
              <Line label="Offers received" value={`${ranked.length}`} />
              <Line
                label="Lowest offer"
                value={lowest ? usd(lowest) : "—"}
                tone="good"
              />
              <Line
                label="Fastest delivery"
                value={fastest ? `${fastest} days` : "—"}
                tone="muted"
              />
              <Line
                label="Spread vs ceiling"
                value={
                  lowest
                    ? `${Math.round((1 - lowest / requirement.budgetMax) * 100)}% under`
                    : "—"
                }
              />
            </dl>
            {lowest > 0 && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs leading-relaxed faint">
                  <Badge tone="muted">Tip</Badge> Offers near the target price with
                  a realistic schedule outscore the cheapest quote most of the
                  time.
                </p>
              </div>
            )}
          </Card>
        </aside>
      </div>

      {/* ------------------------------------------------------- modals */}
      <Modal
        open={bidOpen}
        onClose={() => setBidOpen(false)}
        title={isOwner ? "Provider offer form (preview)" : "Submit your proposal"}
        description="Everything here is scored live — price, schedule, tag coverage."
        size="lg"
      >
        <BidComposer
          requirement={requirement}
          onDone={() => window.setTimeout(() => setBidOpen(false), 1400)}
        />
      </Modal>

      <Modal
        open={Boolean(inspected)}
        onClose={() => setInspect(null)}
        title="Compatibility breakdown"
        description={
          inspected
            ? `${inspected.provider?.name} — ${usd(inspected.bid.price)} · ${inspected.bid.deliveryDays} days`
            : undefined
        }
      >
        {inspected && (
          <div className="space-y-6">
            <ScoreBreakdown score={inspected.score} />
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
                Milestones
              </p>
              <ol className="mt-3 space-y-2">
                {inspected.bid.milestones.map((m) => (
                  <li
                    key={m.label}
                    className="flex items-baseline justify-between gap-3 text-[0.8125rem]"
                  >
                    <span className="text-white/85">{m.label}</span>
                    <span className="num shrink-0 faint">day {m.days}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
                Full pitch
              </p>
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-white/80">
                {inspected.bid.pitch}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`/compare/${requirement.id}`}>
                Compare side by side
                <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-ink-900 p-4">
      <p className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.12em] faint uppercase">
        {icon}
        {label}
      </p>
      <p className="num mt-2 text-[1.0625rem] font-semibold text-white">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs faint">{hint}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="num text-[0.9375rem] font-semibold text-white">{value}</p>
      <p className="text-[0.6875rem] faint">{label}</p>
    </div>
  );
}

function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-white/55">{label}</dt>
      <dd
        className={cn(
          "num font-semibold",
          tone === "muted" || tone === "bad" ? "text-white/60" : "text-white"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
