"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { ButtonLink, Card, EmptyState } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";
import { Copilot } from "@/components/copilot";
import { OfferDecision } from "@/components/offer-decision";
import { deadlineLabel, usd } from "@/lib/format";

/**
 * The buyer workspace, deliberately narrow: post a requirement, then watch for
 * responses. Nothing else lives here — browsing other people's listings is the
 * seller's side of the product.
 */
export default function BuyerPage() {
  const { requirements, bids, meBuyerId } = useStore();

  const mine = React.useMemo(
    () =>
      requirements
        .filter((r) => r.buyerId === meBuyerId)
        .sort((a, b) => +new Date(b.postedAt) - +new Date(a.postedAt)),
    [requirements, meBuyerId]
  );

  const offerCount = (id: string) =>
    bids.filter((b) => b.requirementId === id).length;

  const totalOffers = mine.reduce((sum, r) => sum + offerCount(r.id), 0);

  return (
    <div className="frame py-14 md:py-20">
      {/* ------------------------------------------------------------ hero */}
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
        Reverse marketplace · needs-first procurement
      </p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight text-white md:text-6xl">
        Stop browsing listings.
        <br />
        Post what you need.
      </h1>
      <p className="mt-6 max-w-2xl text-base leading-relaxed muted">
        Describe the job once — specifications, budget ceiling, deadline.
        Qualified providers come to you with tailored offers, and the
        compatibility engine ranks every one on budget fit, timeline and
        relevance. No more guessing which quote is actually best.
      </p>

      <div className="mt-9">
        <ButtonLink href="/post" size="lg">
          <Plus className="size-4" />
          Post a requirement
        </ButtonLink>
      </div>

      <div className="mt-6 max-w-2xl">
        <Copilot />
      </div>

      {/* ------------------------------------------------------- responses */}
      <div className="mt-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Your requirements</h2>
          <span className="text-xs faint">
            {mine.length} posted · {totalOffers} {totalOffers === 1 ? "response" : "responses"}
          </span>
        </div>

        {mine.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              icon={<Plus className="size-5" />}
              title="You have not posted a requirement yet"
              body="Post what you need and providers in that domain will send you offers."
              action={<ButtonLink href="/post">Post a requirement</ButtonLink>}
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {mine.map((r) => {
              const offers = offerCount(r.id);
              return (
                <Card key={r.id} hover>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.9375rem] font-semibold text-white">
                        {r.title}
                      </p>
                      <p className="mt-1 text-sm muted">
                        {usd(r.budgetMax)} ceiling · closes{" "}
                        {deadlineLabel(r.closesAt)}
                      </p>
                    </div>
                  </div>

                  <OfferDecision requirement={r} />
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
