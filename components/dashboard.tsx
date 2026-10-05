"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarClock,
  CircleDollarSign,
  Compass,
  Gauge,
  Layers,
  Plus,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/data";
import { rankBids, scoreToken } from "@/lib/engine";
import { deadlineLabel, usd } from "@/lib/format";
import { useStore } from "@/lib/store";
import { CategoryMark } from "./icons";
import { PageHeader } from "./nav";
import { StatStrip } from "./stat-strip";
import type { Tone } from "./ui/primitives";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Progress,
  StatusBadge,
} from "./ui/primitives";
import { ScorePill, ScoreRing, Sparkline } from "./ui/score";

export function Dashboard() {
  const {
    role,
    requirements,
    bids,
    providers,
    weights,
    meBuyerId,
    meProviderId,
  } = useStore();

  return (
    <div className="frame pt-10 pb-16 md:pt-14">
      <PageHeader
        eyebrow={role === "buyer" ? "Buyer command centre" : "Provider workspace"}
        title={
          role === "buyer"
            ? "Your procurement pipeline"
            : "Your bidding activity"
        }
        body={
          role === "buyer"
            ? "Requirements you’ve posted, offers received, and the awards you’ve made — scored end to end so you can defend every decision."
            : "Every open need you’ve bid on, how the engine ranks you, and where your win rate is leaking."
        }
        actions={
          role === "buyer" ? (
            <ButtonLink href="/post">
              <Plus className="size-4" />
              Post a requirement
            </ButtonLink>
          ) : (
            <ButtonLink href="/market">
              <Compass className="size-4" />
              Find opportunities
            </ButtonLink>
          )
        }
      />

      {role === "buyer" ? (
        <BuyerView
          requirements={requirements}
          bids={bids}
          providers={providers}
          weights={weights}
          meBuyerId={meBuyerId}
        />
      ) : (
        <ProviderView
          requirements={requirements}
          bids={bids}
          providers={providers}
          weights={weights}
          meProviderId={meProviderId}
        />
      )}
    </div>
  );
}

/* ================================================================ BUYER */

function BuyerView({
  requirements,
  bids,
  providers,
  weights,
  meBuyerId,
}: Pick<
  ReturnType<typeof useStore>,
  "requirements" | "bids" | "providers" | "weights" | "meBuyerId"
>) {
  const mine = requirements.filter((r) => r.buyerId === meBuyerId);
  const mineBids = bids.filter((b) =>
    mine.some((r) => r.id === b.requirementId)
  );

  const rankedFor = (id: string) => {
    const req = requirements.find((r) => r.id === id)!;
    return rankBids(
      bids.filter((b) => b.requirementId === id),
      req,
      providers,
      weights
    );
  };

  const awardedValue = mineBids
    .filter((b) => b.status === "accepted")
    .reduce((sum, b) => sum + b.price, 0);
  const scoredBids = mineBids.flatMap((bid) => {
    const req = requirements.find((r) => r.id === bid.requirementId);
    if (!req) return [];
    const provider = providers.find((p) => p.id === bid.providerId);
    const ranked = rankBids(
      [bid],
      req,
      provider ? [provider] : [],
      weights
    );
    return ranked.length ? [ranked[0].score.total] : [];
  });
  const avgScore = scoredBids.length
    ? Math.round(
        scoredBids.reduce((a, b) => a + b, 0) / scoredBids.length
      )
    : 0;

  const totalCeiling = mine.reduce((s, r) => s + r.budgetMax, 0);
  const lowestOffers = mine.reduce((sum, r) => {
    const r2 = rankedFor(r.id);
    return sum + (r2.length ? Math.min(...r2.map((x) => x.bid.price)) : 0);
  }, 0);

  const attention = mine
    .map((r) => {
      const ranked = rankedFor(r.id);
      return {
        requirement: r,
        ranked,
        newCount: ranked.filter((x) => x.bid.status === "pending").length,
      };
    })
    .sort((a, b) => b.newCount - a.newCount);

  const pipeline = mineBids
    .map((bid) => {
      const requirement = requirements.find((r) => r.id === bid.requirementId)!;
      const provider = providers.find((p) => p.id === bid.providerId);
      const score = rankBids([bid], requirement, provider ? [provider] : [], weights)[0]
        .score;
      return { bid, requirement, provider, score };
    })
    .sort((a, b) => b.score.total - a.score.total);

  const spendSeries = mine.length
    ? mine.map((r) => r.budgetMax / 1000)
    : [12, 18, 14, 26, 22, 31, 28];

  return (
    <>
      <StatStrip
        items={[
          {
            label: "Open requirements",
            value: mine.filter((r) => r.status !== "awarded").length,
            hint: `${mine.length} posted all time`,
            icon: <Layers className="size-4" />,
          },
          {
            label: "Offers received",
            value: mineBids.length,
            hint: `${mineBids.filter((b) => b.status === "pending").length} awaiting review`,
            icon: <Users className="size-4" />,
          },
          {
            label: "Avg. compatibility",
            value: avgScore,
            hint: "across all incoming offers",
            icon: <Gauge className="size-4" />,
          },
          {
            label: "Awarded value",
            value: usd(awardedValue, { compact: true }),
            hint: `${mineBids.filter((b) => b.status === "accepted").length} accepted`,
            icon: <Trophy className="size-4" />,
          },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* ------------------------------------------------ needs attention */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[1.0625rem] font-semibold text-white">
              Needs your decision
            </h2>
            <Link
              href="/compare"
              className="text-[0.8125rem] text-white/75 hover:text-white"
            >
              All comparisons
            </Link>
          </div>

          {attention.length === 0 ? (
            <EmptyState
              icon={<Plus className="size-5" />}
              title="You have no live requirements"
              body="Post a need and matched providers start bidding within the hour."
              action={<ButtonLink href="/post">Post a requirement</ButtonLink>}
            />
          ) : (
            attention.map(({ requirement, ranked, newCount }) => {
              const best = ranked[0];
              const category = CATEGORIES.find(
                (c) => c.id === requirement.category
              )!;
              const spread =
                ranked.length > 1
                  ? Math.max(...ranked.map((r) => r.bid.price)) -
                    Math.min(...ranked.map((r) => r.bid.price))
                  : 0;

              return (
                <Card key={requirement.id} hover className="p-5">
                  <div className="flex items-start gap-4">
                    <CategoryMark category={requirement.category} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/market/${requirement.id}`}
                          className="text-[0.9375rem] font-semibold text-white hover:text-white/75"
                        >
                          {requirement.title}
                        </Link>
                        <StatusBadge status={requirement.status} />
                        {newCount > 0 && (
                          <Badge tone="outline">
                            <BellRing className="size-3" />
                            {newCount} to review
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs faint">
                        {category.label} · closes{" "}
                        {deadlineLabel(requirement.closesAt)} · ceiling{" "}
                        {usd(requirement.budgetMax, { compact: true })}
                      </p>
                    </div>
                    {best && <ScoreRing score={best.score.total} size={56} stroke={5} />}
                  </div>

                  {ranked.length > 0 && (
                    <>
                      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
                        <Mini label="Offers" value={String(ranked.length)} />
                        <Mini
                          label="Best price"
                          value={usd(
                            Math.min(...ranked.map((r) => r.bid.price)),
                            { compact: true }
                          )}
                        />
                        <Mini
                          label="Spread"
                          value={spread ? usd(spread, { compact: true }) : "—"}
                        />
                      </div>

                      <ul className="mt-4 space-y-2">
                        {ranked.slice(0, 3).map((row, i) => (
                          <li
                            key={row.bid.id}
                            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5"
                          >
                            <span className="num text-[0.6875rem] faint">
                              #{i + 1}
                            </span>
                            <Avatar
                              initials={row.provider?.initials ?? "??"}
                              size={26}
                              seed={(row.provider?.name.length ?? 2) + i}
                            />
                            <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-white/85">
                              {row.provider?.name}
                            </span>
                            <span className="num hidden text-[0.75rem] faint sm:inline">
                              {row.bid.deliveryDays}d
                            </span>
                            <span className="num text-[0.8125rem] font-semibold text-white">
                              {usd(row.bid.price, { compact: true })}
                            </span>
                            <ScorePill score={row.score.total} size="sm" />
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <ButtonLink
                      href={`/compare/${requirement.id}`}
                      size="sm"
                    >
                      <Gauge className="size-3.5" />
                      Compare offers
                    </ButtonLink>
                    <ButtonLink
                      href={`/market/${requirement.id}`}
                      size="sm"
                      variant="outline"
                    >
                      Open requirement
                    </ButtonLink>
                  </div>
                </Card>
              );
            })
          )}
        </section>

        {/* -------------------------------------------------------- sidebar */}
        <aside className="space-y-5">
          <Card>
            <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
              Budget exposure
            </p>
            <p className="num mt-2 text-2xl font-semibold text-white">
              {usd(totalCeiling, { compact: true })}
            </p>
            <p className="mt-1 text-xs muted">
              Ceilings across your live requirements
            </p>
            <Sparkline points={spendSeries} className="mt-3" />
            <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
              <Row
                label="Lowest offers on the table"
                value={usd(lowestOffers, { compact: true })}
                tone="good"
              />
              <Row
                label="Potential saving"
                value={usd(Math.max(0, totalCeiling - lowestOffers), {
                  compact: true,
                })}
                tone="muted"
              />
              <Row
                label="Avg. discount vs ceiling"
                value={
                  totalCeiling > 0
                    ? `${Math.round(
                        ((totalCeiling - lowestOffers) / totalCeiling) * 100
                      )}%`
                    : "—"
                }
              />
            </div>
          </Card>

          <Card>
            <p className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
              <CalendarClock className="size-3.5" /> Closing soon
            </p>
            <ul className="mt-4 space-y-3">
              {mine
                .filter((r) => r.status !== "awarded")
                .sort(
                  (a, b) => +new Date(a.closesAt) - +new Date(b.closesAt)
                )
                .slice(0, 4)
                .map((r) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className="size-1.5 shrink-0 rounded-full bg-white/55" />
                    <Link
                      href={`/market/${r.id}`}
                      className="min-w-0 flex-1 truncate text-[0.8125rem] text-white/85 hover:text-white"
                    >
                      {r.title}
                    </Link>
                    <span className="shrink-0 text-[0.6875rem] faint">
                      {deadlineLabel(r.closesAt)}
                    </span>
                  </li>
                ))}
            </ul>
          </Card>

          <Card>
            <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
              Offer pipeline
            </p>
            <div className="mt-4 space-y-3">
              {(["pending", "shortlisted", "accepted", "rejected"] as const).map(
                (status) => {
                  const count = mineBids.filter((b) => b.status === status).length;
                  const share = mineBids.length
                    ? (count / mineBids.length) * 100
                    : 0;
                  return (
                    <div key={status}>
                      <div className="flex items-baseline justify-between text-[0.8125rem]">
                        <span className="capitalize text-white/70">{status}</span>
                        <span className="num text-white/85">{count}</span>
                      </div>
                      <Progress
                        value={share}
                        className="mt-1.5"
                        barClassName={cn(
                          status === "accepted"
                            ? "bg-white"
                            : status === "shortlisted"
                              ? "bg-white"
                              : status === "rejected"
                                ? "bg-white/30"
                                : "bg-white/30"
                        )}
                      />
                    </div>
                  );
                }
              )}
            </div>
          </Card>

          <Card>
            <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
              Highest scoring offers
            </p>
            <ul className="mt-4 space-y-3">
              {pipeline.slice(0, 5).map((row) => (
                <li key={row.bid.id} className="flex items-center gap-3">
                  <Avatar
                    initials={row.provider?.initials ?? "??"}
                    size={28}
                    seed={(row.provider?.name.length ?? 2) + row.score.total}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] text-white/90">
                      {row.provider?.name}
                    </p>
                    <p className="num truncate text-[0.6875rem] faint">
                      {usd(row.bid.price, { compact: true })} ·{" "}
                      {row.requirement.title}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "num text-[0.8125rem] font-bold",
                      scoreToken(row.score.total).text
                    )}
                  >
                    {row.score.total}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}

/* ============================================================= PROVIDER */

function ProviderView({
  requirements,
  bids,
  providers,
  weights,
  meProviderId,
}: Pick<
  ReturnType<typeof useStore>,
  "requirements" | "bids" | "providers" | "weights" | "meProviderId"
>) {
  // Not asserted: on a fresh store no providers exist yet, so this resolves to
  // `undefined`. Without the guard below, the opportunities map throws on
  // `me.categories`.
  const me = providers.find((p) => p.id === meProviderId);

  if (!me) {
    return (
      <div className="frame py-16">
        <EmptyState
          icon={<BadgeCheck className="size-5" />}
          title="No provider profile on this deployment"
          body="The provider dashboard needs at least one registered provider to show opportunities and your offers. Add providers to the store, or switch to the buyer view."
        />
      </div>
    );
  }

  const myBids = bids.filter((b) => b.providerId === meProviderId);

  const open = requirements.filter(
    (r) => r.status === "open" || r.status === "reviewing"
  );

  const opportunities = open
    .map((r) => {
      const categoryFit = me.categories.includes(r.category);
      const overlap = r.tags.filter((t) => me.skills.includes(t)).length;
      const budgetFit = Math.min(1, (r.budgetMax * 0.85) / r.budgetTarget / 1.4);
      const fit = Math.round(
        (categoryFit ? 0.45 : 0.08) * 100 + overlap * 8 + budgetFit * 18
      );
      return { requirement: r, overlap, fit: Math.min(99, fit) };
    })
    .sort((a, b) => b.fit - a.fit);

  const myRanked = myBids
    .map((bid) => {
      const requirement = requirements.find((r) => r.id === bid.requirementId)!;
      const ranked = rankBids(
        bids.filter((b) => b.requirementId === bid.requirementId),
        requirement,
        providers,
        weights
      );
      const index = ranked.findIndex((r) => r.bid.id === bid.id);
      return { bid, requirement, rank: index + 1, of: ranked.length, score: ranked[index]?.score };
    })
    .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0));

  const won = myBids.filter((b) => b.status === "accepted");
  const winRate = myBids.length
    ? Math.round((won.length / myBids.length) * 100)
    : 0;
  const pipelineValue = myBids
    .filter((b) => b.status === "pending" || b.status === "shortlisted")
    .reduce((s, b) => s + b.price, 0);

  return (
    <>
      <StatStrip
        items={[
          {
            label: "Live bids",
            value: myBids.filter((b) => b.status === "pending").length,
            hint: `${myBids.length} submitted all time`,
            icon: <Target className="size-4" />,
          },
          {
            label: "Shortlisted",
            value: myBids.filter((b) => b.status === "shortlisted").length,
            hint: "buyer is deciding",
            icon: <Sparkles className="size-4" />,
          },
          {
            label: "Win rate",
            value: `${winRate}%`,
            hint: `${won.length} awarded`,
            icon: <Trophy className="size-4" />,
          },
          {
            label: "Pipeline value",
            value: usd(pipelineValue, { compact: true }),
            hint: "pending + shortlisted",
            icon: <CircleDollarSign className="size-4" />,
          },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[1.0625rem] font-semibold text-white">
              Recommended opportunities
            </h2>
            <Link
              href="/market"
              className="text-[0.8125rem] text-white/75 hover:text-white"
            >
              Browse all
            </Link>
          </div>

          {opportunities.slice(0, 4).map(({ requirement, overlap, fit }) => (
            <Card key={requirement.id} hover>
              <div className="flex items-start gap-4">
                <CategoryMark category={requirement.category} size={40} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/market/${requirement.id}`}
                    className="text-[0.9375rem] font-semibold text-white hover:text-white/75"
                  >
                    {requirement.title}
                  </Link>
                  <p className="mt-1 line-clamp-1 text-[0.8125rem] muted">
                    {requirement.summary}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.75rem] faint">
                    <span className="inline-flex items-center gap-1.5">
                      <CircleDollarSign className="size-3.5" />
                      {usd(requirement.budgetMax, { compact: true })} ceiling
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="size-3.5" />
                      deliver in {deadlineLabel(requirement.deadline)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Timer className="size-3.5" />
                      closes {deadlineLabel(requirement.closesAt)}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="num text-lg font-bold text-white/75">
                    {fit}%
                  </p>
                  <p className="text-[0.625rem] faint">capability fit</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-xs faint">
                  {overlap > 0
                    ? `${overlap} of your skills match its tags`
                    : "No direct skill overlap — bid only with a partner"}
                </span>
                <ButtonLink
                  href={`/market/${requirement.id}`}
                  size="sm"
                  variant="outline"
                >
                  Review &amp; bid
                  <ArrowRight className="size-3.5" />
                </ButtonLink>
              </div>
            </Card>
          ))}
        </section>

        <aside className="space-y-5">
          <Card>
            <p className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
              <BadgeCheck className="size-3.5" /> Your standing
            </p>
            <div className="mt-4 flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-xl border border-white/12 bg-white/5 text-[0.8125rem] font-semibold text-white/85">
                {me.initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.9375rem] font-semibold text-white">
                  {me.name}
                </p>
                <p className="truncate text-xs faint">{me.tagline}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-3 border-t border-white/10 pt-4">
              <Row label="Rating" value={`${me.rating.toFixed(1)}★ (${me.reviews})`} />
              <Row label="On-time delivery" value={`${me.onTimeRate}%`} tone="good" />
              <Row label="Completed jobs" value={String(me.completedJobs)} />
              <Row label="Avg. response" value={`${me.responseHours}h`} tone="muted" />
            </dl>
          </Card>

          <Card>
            <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
              Your bids
            </p>
            <ul className="mt-4 space-y-3">
              {myRanked.map((row) => (
                <li key={row.bid.id} className="border-b border-white/6 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/market/${row.requirement.id}`}
                      className="min-w-0 flex-1 truncate text-[0.8125rem] text-white/90 hover:text-white"
                    >
                      {row.requirement.title}
                    </Link>
                    {row.score && <ScorePill score={row.score.total} size="sm" />}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[0.6875rem] faint">
                    <span className="num">{usd(row.bid.price, { compact: true })}</span>
                    <span className="num">{row.bid.deliveryDays} days</span>
                    <span className="num">
                      rank {row.rank} of {row.of}
                    </span>
                    <span className="capitalize">{row.bid.status}</span>
                  </div>
                </li>
              ))}
              {myRanked.length === 0 && (
                <li className="text-xs faint">
                  You haven&rsquo;t submitted any offers yet.
                </li>
              )}
            </ul>
          </Card>

          <Card>
            <p className="flex items-center gap-2 text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
              <TrendingUp className="size-3.5" /> Where you lose points
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "Bids above the buyer's target price lose ~22 budget points even when under the ceiling.",
                "Schedules with under 5 days of buffer read as optimistic to buyers.",
                "Tag coverage below 80% drags relevance more than a 5% price cut helps.",
              ].map((t) => (
                <li key={t} className="flex gap-2.5 text-[0.8125rem] muted">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-white/55" />
                  {t}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.625rem] font-semibold tracking-[0.1em] faint uppercase">
        {label}
      </p>
      <p className="num mt-0.5 text-[0.875rem] font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
      <span className="text-white/55">{label}</span>
      <span
        className={cn(
          "num font-semibold",
          tone === "muted" || tone === "bad" ? "text-white/60" : "text-white"
        )}
      >
        {value}
      </span>
    </div>
  );
}
