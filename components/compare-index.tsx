"use client";

import Link from "next/link";
import { ArrowRight, Gauge, Sparkles, Trophy, Users } from "lucide-react";
import { CATEGORIES } from "@/lib/data";
import { rankBids } from "@/lib/engine";
import { usd } from "@/lib/format";
import { useStore } from "@/lib/store";
import { CategoryMark } from "./icons";
import { PageHeader } from "./nav";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  StatusBadge,
} from "./ui/primitives";
import { ScorePill } from "./ui/score";

export function CompareIndex() {
  const { requirements, bids, providers, weights, meBuyerId } = useStore();

  const withOffers = requirements
    .map((r) => ({
      requirement: r,
      ranked: rankBids(
        bids.filter((b) => b.requirementId === r.id),
        r,
        providers,
        weights
      ),
    }))
    .filter((x) => x.ranked.length > 0)
    .sort((a, b) => b.ranked.length - a.ranked.length);

  const mine = withOffers.filter((x) => x.requirement.buyerId === meBuyerId);
  const others = withOffers.filter((x) => x.requirement.buyerId !== meBuyerId);

  return (
    <div className="frame pt-10 pb-16 md:pt-14">
      <PageHeader
        eyebrow="Comparison dashboard"
        title="Every offer, normalised and ranked"
        body="Pick a requirement to open the side-by-side workspace: price against your ceiling, delivery against your deadline, tag coverage, provider evidence — and a score that explains itself."
        actions={
          <ButtonLink href="/post">
            <Sparkles className="size-4" />
            Post a requirement
          </ButtonLink>
        }
      />

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[1.0625rem] font-semibold text-white">
            Your requirements
          </h2>
          <Badge tone="outline">{mine.length} with offers</Badge>
        </div>

        {mine.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              icon={<Gauge className="size-5" />}
              title="Nothing to compare yet"
              body="Once providers respond to one of your requirements, it appears here with a full comparison workspace."
              action={
                <ButtonLink href="/post" variant="outline">
                  Post your first requirement
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {mine.map(({ requirement, ranked }) => (
              <CompareTile
                key={requirement.id}
                requirement={requirement}
                ranked={ranked}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[1.0625rem] font-semibold text-white">
            Public comparison examples
          </h2>
          <span className="text-xs faint">Other buyers’ requirements</span>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {others.map(({ requirement, ranked }) => (
            <CompareTile
              key={requirement.id}
              requirement={requirement}
              ranked={ranked}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function CompareTile({
  requirement,
  ranked,
}: {
  requirement: ReturnType<typeof useStore>["requirements"][number];
  ranked: ReturnType<typeof rankBids>;
}) {
  const category = CATEGORIES.find((c) => c.id === requirement.category)!;
  const best = ranked[0];
  const spread =
    ranked.length > 1
      ? Math.max(...ranked.map((r) => r.bid.price)) -
        Math.min(...ranked.map((r) => r.bid.price))
      : 0;

  return (
    <Card hover className="flex flex-col">
      <div className="flex items-start gap-3.5">
        <CategoryMark category={requirement.category} size={38} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/compare/${requirement.id}`}
            className="text-[0.9375rem] leading-snug font-semibold text-white hover:text-white/75"
          >
            {requirement.title}
          </Link>
          <p className="mt-1 text-xs faint">
            {category.label} · ceiling {usd(requirement.budgetMax, { compact: true })}
          </p>
        </div>
        <StatusBadge status={requirement.status} />
      </div>

      <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <Trophy className="size-4 shrink-0 text-white/75" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-medium text-white">
            {best.provider?.name}
          </p>
          <p className="num text-xs faint">
            {usd(best.bid.price)} · {best.bid.deliveryDays} days
          </p>
        </div>
        <ScorePill score={best.score.total} size="sm" />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs faint">
          <Users className="size-3.5" />
          {ranked.length} offers{spread > 0 && <> · {usd(spread, { compact: true })} spread</>}
        </span>
        <Link
          href={`/compare/${requirement.id}`}
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium text-white/75 transition hover:gap-1.5 hover:text-white"
        >
          Open workspace
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}
