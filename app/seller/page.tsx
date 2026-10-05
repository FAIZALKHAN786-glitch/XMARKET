"use client";

import * as React from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/primitives";
import { useStore } from "@/lib/store";
import { deadlineLabel, usd } from "@/lib/format";

/**
 * The seller workspace. A merchant only ever sees requirements in the domain
 * they registered for — routing is by domain, not by browsing.
 */
export default function SellerPage() {
  const { requirements, bids, account } = useStore();

  const domain = account?.domain;
  const merchantId = account?.merchantId;

  const open = React.useMemo(
    () =>
      requirements
        .filter((r) => r.status === "open" && (!domain || r.category === domain))
        .sort((a, b) => +new Date(b.postedAt) - +new Date(a.postedAt)),
    [requirements, domain]
  );

  const myBids = React.useMemo(
    () => bids.filter((b) => b.providerId === merchantId),
    [bids, merchantId]
  );

  return (
    <div className="frame py-14 md:py-20">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">
        Merchant workspace
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
        {account?.shopName ?? "Your shop"}
      </h1>
      {merchantId && (
        <p className="mt-2 font-mono text-sm tracking-widest text-white/60">
          {merchantId}
        </p>
      )}

      {/* ------------------------------------------------- requirements in domain */}
      <h2 className="mt-12 text-lg font-semibold text-white">
        Requirements in your domain
      </h2>

      {open.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="No open requirements in your domain yet"
            body="When a buyer posts in your domain it appears here."
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {open.map((r) => (
            <Link key={r.id} href={`/market/${r.id}`} className="block">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-colors duration-150 hover:border-white/25">
                <p className="text-[0.9375rem] font-semibold text-white">
                  {r.title}
                </p>
                <p className="mt-1 text-sm muted">
                  {usd(r.budgetMax)} ceiling · closes {deadlineLabel(r.closesAt)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------ my offers */}
      <h2 className="mt-14 text-lg font-semibold text-white">Your offers</h2>

      {myBids.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="You have not placed an offer yet"
            body="Open a requirement above to submit your proposal."
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {myBids.map((b) => {
            const requirement = requirements.find((r) => r.id === b.requirementId);
            return (
              <div
                key={b.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[0.9375rem] font-semibold text-white">
                    {requirement?.title ?? b.requirementId}
                  </p>
                  <span className="text-xs uppercase tracking-wide text-white/50">
                    {b.status}
                  </span>
                </div>
                <p className="mt-1 text-sm muted">
                  {usd(b.price)} over {b.deliveryDays} days
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
