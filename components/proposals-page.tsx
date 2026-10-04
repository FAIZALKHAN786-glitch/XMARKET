"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Compass,
  FileText,
  Gauge,
  Inbox,
  Send,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { rankBids } from "@/lib/engine";
import { usd } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { BidStatus } from "@/lib/types";
import { PageHeader } from "./nav";
import { StatStrip } from "./stat-strip";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Rating,
  Segmented,
  StatusBadge,
  TimeAgo,
} from "./ui/primitives";
import { ScorePill } from "./ui/score";

type Filter = "all" | BidStatus;

export function ProposalsPage() {
  const {
    role,
    requirements,
    bids,
    providers,
    weights,
    meBuyerId,
    meProviderId,
    setBidStatus,
  } = useStore();
  const [filter, setFilter] = React.useState<Filter>("all");

  const isBuyer = role === "buyer";

  type Row = {
    bid: (typeof bids)[number];
    requirement: (typeof requirements)[number];
    provider: (typeof providers)[number] | undefined;
    score?: ReturnType<typeof rankBids>[number]["score"];
    rank?: number;
    of?: number;
  };

  const rows = React.useMemo<Row[]>(() => {
    if (isBuyer) {
      return bids
        .filter((b) =>
          requirements.some(
            (r) => r.id === b.requirementId && r.buyerId === meBuyerId
          )
        )
        .map((bid) => {
          const requirement = requirements.find(
            (r) => r.id === bid.requirementId
          )!;
          const provider = providers.find((p) => p.id === bid.providerId);
          const score = rankBids(
            [bid],
            requirement,
            provider ? [provider] : [],
            weights
          )[0].score;
          return { bid, requirement, provider, score };
        })
        .filter((row) => filter === "all" || row.bid.status === filter);
    }

    return bids
      .filter((b) => b.providerId === meProviderId)
      .flatMap<Row>((bid) => {
        const requirement = requirements.find(
          (r) => r.id === bid.requirementId
        );
        if (!requirement) return [];
        const ranked = rankBids(
          bids.filter((x) => x.requirementId === requirement.id),
          requirement,
          providers,
          weights
        );
        const index = ranked.findIndex((r) => r.bid.id === bid.id);
        return [
          {
            bid,
            requirement,
            provider: providers.find((p) => p.id === bid.providerId),
            score: ranked[index]?.score,
            rank: index + 1,
            of: ranked.length,
          },
        ];
      })
      .filter((row) => filter === "all" || row.bid.status === filter);
  }, [
    bids,
    requirements,
    providers,
    weights,
    filter,
    isBuyer,
    meBuyerId,
    meProviderId,
  ]);

  const scope = isBuyer
    ? bids.filter((b) =>
        requirements.some(
          (r) => r.id === b.requirementId && r.buyerId === meBuyerId
        )
      )
    : bids.filter((b) => b.providerId === meProviderId);

  const stats = isBuyer
    ? [
        {
          label: "Offers received",
          value: scope.length,
          hint: "across your requirements",
          icon: <Inbox className="size-4" />,
        },
        {
          label: "Awaiting review",
          value: scope.filter((b) => b.status === "pending").length,
          hint: "no decision recorded yet",
        },
        {
          label: "Shortlisted",
          value: scope.filter((b) => b.status === "shortlisted").length,
          hint: "in negotiation",
          tone: "aqua" as const,
        },
        {
          label: "Accepted",
          value: scope.filter((b) => b.status === "accepted").length,
          hint: usd(
            scope
              .filter((b) => b.status === "accepted")
              .reduce((s, b) => s + b.price, 0),
            { compact: true }
          ),
          tone: "good" as const,
        },
      ]
    : [
        {
          label: "Bids submitted",
          value: scope.length,
          hint: "all time",
          icon: <Send className="size-4" />,
        },
        {
          label: "Pending",
          value: scope.filter((b) => b.status === "pending").length,
          hint: "waiting on buyers",
        },
        {
          label: "Shortlisted",
          value: scope.filter((b) => b.status === "shortlisted").length,
          hint: "buyer is deciding",
          tone: "aqua" as const,
        },
        {
          label: "Value in play",
          value: usd(
            scope
              .filter((b) => b.status !== "rejected")
              .reduce((s, b) => s + b.price, 0),
            { compact: true }
          ),
          hint: "excludes declined",
          tone: "good" as const,
        },
      ];

  return (
    <div className="frame pt-10 pb-16 md:pt-14">
      <PageHeader
        eyebrow={isBuyer ? "Incoming offers" : "My bids"}
        title={isBuyer ? "Every proposal, one ledger" : "Track your proposals"}
        body={
          isBuyer
            ? "Shortlist, accept or decline from here — the score column shows exactly what the engine liked or disliked about each offer."
            : "See where you rank against competing bids, and how your price and schedule affect your score."
        }
        actions={
          isBuyer ? (
            <ButtonLink href="/compare">
              <Gauge className="size-4" />
              Compare workspace
            </ButtonLink>
          ) : (
            <ButtonLink href="/market">
              <Compass className="size-4" />
              Find work
            </ButtonLink>
          )
        }
      />

      <StatStrip items={stats} />

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "shortlisted", label: "Shortlisted" },
            { value: "accepted", label: "Accepted" },
            { value: "rejected", label: "Declined" },
          ]}
        />
        <p className="num text-xs faint">
          {rows.length} offer{rows.length === 1 ? "" : "s"} shown
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title={
              filter === "all"
                ? isBuyer
                  ? "No offers yet"
                  : "You haven't bid on anything yet"
                : `Nothing ${filter}`
            }
            body={
              isBuyer
                ? "Post a requirement and matched providers will submit priced, scheduled proposals."
                : "Browse the opportunity feed and submit a scored proposal."
            }
            action={
              <ButtonLink href={isBuyer ? "/post" : "/market"}>
                {isBuyer ? "Post a requirement" : "Browse opportunities"}
              </ButtonLink>
            }
          />
        ) : (
          rows.map((row) => (
            <Card key={row.bid.id} className="p-0">
              <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  {isBuyer ? (
                    <Avatar
                      initials={row.provider?.initials ?? "??"}
                      size={42}
                      seed={(row.provider?.name.length ?? 2) + row.bid.price}
                    />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/75">
                      <Send className="size-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.875rem] font-semibold text-white">
                        {isBuyer ? row.provider?.name : row.requirement.title}
                      </p>
                      <StatusBadge status={row.bid.status} />
                      {!isBuyer && row.score && (
                        <Badge tone="neutral">
                          rank {row.rank} of {row.of}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[0.8125rem] muted">
                      {isBuyer ? (
                        <Link
                          href={`/market/${row.requirement.id}`}
                          className="hover:text-white"
                        >
                          {row.requirement.title}
                        </Link>
                      ) : (
                        row.requirement.summary
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.75rem] faint">
                      <span className="num font-semibold text-white/85">
                        {usd(row.bid.price)}
                      </span>
                      <span className="num">{row.bid.deliveryDays} days</span>
                      <span>
                        submitted <TimeAgo iso={row.bid.createdAt} />
                      </span>
                      {isBuyer && row.provider && (
                        <Rating
                          value={row.provider.rating}
                          count={row.provider.reviews}
                        />
                      )}
                      {!isBuyer && (
                        <span>
                          buyer ceiling{" "}
                          {usd(row.requirement.budgetMax, { compact: true })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  {row.score && (
                    <div className="text-right">
                      <ScorePill score={row.score.total} />
                      <p className={cn("mt-1 text-[0.6875rem] faint")}>
                        {row.score.grade} fit
                      </p>
                    </div>
                  )}

                  {isBuyer ? (
                    <div className="flex flex-wrap gap-2">
                      <ButtonLink
                        href={`/market/${row.requirement.id}`}
                        size="sm"
                        variant="outline"
                      >
                        Open
                      </ButtonLink>
                      {(row.bid.status === "pending" ||
                        row.bid.status === "rejected") && (
                        <button
                          onClick={() =>
                            setBidStatus(row.bid.id, "shortlisted")
                          }
                          className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/12 bg-white/5 px-3 text-[0.8125rem] font-medium text-white transition hover:bg-white/10"
                        >
                          <Sparkles className="size-3.5" />
                          Shortlist
                        </button>
                      )}
                      {row.bid.status !== "accepted" ? (
                        <button
                          onClick={() => setBidStatus(row.bid.id, "accepted")}
                          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-[0.8125rem] font-medium text-white transition hover:bg-white"
                        >
                          Accept
                        </button>
                      ) : (
                        <span className="inline-flex h-8 items-center rounded-xl border border-white/40 px-3 text-[0.8125rem] font-medium text-white">
                          Awarded
                        </span>
                      )}
                    </div>
                  ) : (
                    <ButtonLink
                      href={`/compare/${row.requirement.id}`}
                      size="sm"
                      variant="outline"
                    >
                      See competition
                      <ArrowRight className="size-3.5" />
                    </ButtonLink>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {rows.length > 0 && (
        <p className="mt-6 text-center text-xs faint">
          Last update{" "}
          <TimeAgo
            iso={
              rows
                .map((r) => r.bid.createdAt)
                .sort((a, b) => +new Date(b) - +new Date(a))[0]
            }
          />{" "}
          · scores recalculate whenever you change priority weighting
        </p>
      )}
    </div>
  );
}
