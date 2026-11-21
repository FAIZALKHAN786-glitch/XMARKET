"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { api } from "@/lib/api-client";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { BudgetTracker } from "@/components/budget-tracker";
import { Badge, Button, Card, EmptyState, ScoreBar, SectionTitle, Stat, XMarketIdCard } from "@/components/ui";
import { CATEGORY_LABELS, gradeFor, money, providerXMarketId } from "@/lib/xmarket";

type Requirement = {
  id: string; title: string; category: string; budgetMax: number; budgetTarget: number;
  status: string; location: string; postedAt: string; closesAt: string;
};
type Bid = {
  id: string; requirementId: string; providerId: string; price: number; deliveryDays: number;
  pitch: string; status: string; createdAt: string;
  provider?: { name: string; rating: number; verified: boolean; categories: string[] };
  score?: { total: number; grade: string; factors: { key: string; label: string; score: number }[] };
  requirement?: { id: string; title: string; category: string };
  providerXMarketId?: string;
};

export default function BuyerDashboard() {
  const { account, loading } = useSession();
  const router = useRouter();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [spent, setSpent] = useState(0);

  useEffect(() => {
    if (!loading && !account) router.replace("/login");
  }, [account, loading, router]);

  useEffect(() => {
    if (!account) return;
    api<{ requirements: Requirement[] }>(`/api/requirements?buyerId=${encodeURIComponent(account.id)}&limit=100`)
      .then(({ data }) => setRequirements(data?.requirements ?? []));
    api<{ bids: Bid[] }>(`/api/bids?buyerId=${encodeURIComponent(account.id)}&limit=100`)
      .then(({ data }) => setBids(data?.bids ?? []));
    api<{ totalSpent: number }>("/api/budget/tracking")
      .then(({ data }) => setSpent(data?.totalSpent ?? 0));
  }, [account]);

  const recommendations = useMemo(() => {
    const best = new Map<string, Bid>();
    bids.forEach((bid) => {
      if (bid.status === "rejected") return;
      const current = best.get(bid.requirementId);
      if (!current || (bid.score?.total ?? 0) > (current.score?.total ?? 0)) best.set(bid.requirementId, bid);
    });
    return Array.from(best.entries())
      .map(([id, bid]) => ({ requirement: requirements.find((r) => r.id === id), bid }))
      .filter((row) => row.requirement)
      .sort((a, b) => (b.bid.score?.total ?? 0) - (a.bid.score?.total ?? 0));
  }, [bids, requirements]);

  if (loading || !account) return <div className="loading">Loading your dashboard…</div>;

  const awards = bids.filter((b) => b.status === "accepted");

  return (
    <div>
      <SiteHeader active="dashboard" />
      <main className="page-frame fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
          <div>
            <p className="eyebrow">Buyer workspace</p>
            <h1 className="page-title">Welcome back, {account.username ?? account.displayName}!</h1>
            <p className="lede">Here are the strongest offers for your open requirements.</p>
          </div>
          <Link href="/requirements/post" className="btn btn-primary btn-lg">+ Post a New Requirement</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)] gap-5 items-start">
          <div className="stack">
            <XMarketIdCard
              xMarketId={account.xMarketId}
              role="buyer"
              subtitle="Use it for bids, payments, reputation and your budget."
              footer={
                <span className="num">{money(spent)} total spent · {awards.length} award{awards.length === 1 ? "" : "s"} recorded</span>
              }
            />

            <div className="stat-grid">
              <Stat label="Requirements" value={requirements.length} hint="Posted by you" />
              <Stat label="Bids received" value={bids.length} hint="Across all requirements" />
              <Stat label="Total spent" value={money(spent)} hint="From accepted bids" />
            </div>

            <section>
              <SectionTitle
                eyebrow="ML-style recommendations"
                title="Recommended bids"
                action={<Badge tone="accent">Top match first</Badge>}
              />
              {recommendations.length === 0 ? (
                <EmptyState
                  title="No ranked bids yet"
                  body="Once providers bid on your requirements, the engine ranks each offer here with a score and a reason."
                  action={<Link href="/requirements/post" className="btn btn-primary btn-sm">Post your first requirement</Link>}
                />
              ) : (
                <div className="stack">
                  {recommendations.slice(0, 4).map(({ bid, requirement }) => {
                    const score = bid.score?.total ?? 0;
                    return (
                      <Card key={bid.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge tone={score >= 85 ? "good" : "neutral"}>{gradeFor(score)} · {score >= 85 ? "Top recommended" : score >= 72 ? "Strong match" : "Worth a look"}</Badge>
                              <span className="chip">{requirement!.title}</span>
                            </div>
                            <p className="card-title mt-3">
                              {bid.provider?.name ?? bid.providerId}{" "}
                              <span className="num text-[#8a8a82] text-xs font-normal">
                                {bid.providerXMarketId ?? providerXMarketId(bid.providerId)}
                              </span>
                            </p>
                            <p className="text-[13px] text-[#55554f] leading-relaxed m-0 mt-1 line-clamp-2">{bid.pitch}</p>
                          </div>
                          <div className="text-right flex-none">
                            <p className="num font-semibold text-lg m-0">{money(bid.price)}</p>
                            <p className="card-meta justify-end"><span>{bid.deliveryDays} days</span><span>{bid.provider?.rating?.toFixed(1) ?? "—"}★</span></p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
                          <div>
                            <ScoreBar score={score} label="Compatibility" />
                            <div className="flex gap-4 mt-3 flex-wrap">
                              {(bid.score?.factors ?? []).map((f) => (
                                <span key={f.key} className="num text-[11px] text-[#8a8a82]">
                                  {f.label} <b className="text-[#0b0b0b]">{f.score}</b>
                                </span>
                              ))}
                            </div>
                          </div>
                          <Link href={`/requirements/${bid.requirementId}`} className="btn btn-outline btn-sm">View all bids →</Link>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <SectionTitle eyebrow="Activity" title="Your recent requirements" />
              <Card>
                {requirements.length === 0 ? (
                  <p className="text-sm text-[#8a8a82] m-0">Nothing posted yet. Your requirements will appear here.</p>
                ) : (
                  requirements.slice(0, 6).map((r) => (
                    <Link href={`/requirements/${r.id}`} className="card-link" key={r.id}>
                      <div className="min-w-0">
                        <p className="card-title truncate">{r.title}</p>
                        <p className="card-meta">
                          <span>{CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS] ?? r.category}</span>
                          <span className="num">Target {money(r.budgetTarget)}</span>
                          <span className="capitalize">{r.status}</span>
                        </p>
                      </div>
                      <span className="arrow" aria-hidden="true">→</span>
                    </Link>
                  ))
                )}
              </Card>
            </section>
          </div>

          <aside className="stack">
            <BudgetTracker />
            <Card>
              <p className="eyebrow">Novelties in action</p>
              <p className="card-title">More from your ID</p>
              <div className="mt-4 space-y-3 text-[13px] text-[#55554f]">
                <p className="m-0"><b className="text-[#0b0b0b]">Digital card</b> — share {account.xMarketId} anywhere.</p>
                <p className="m-0"><b className="text-[#0b0b0b]">Escrow-lite</b> — accepted bids show funds held against this ID.</p>
                <p className="m-0"><b className="text-[#0b0b0b]">Reputation trail</b> — every award follows you across projects.</p>
              </div>
            </Card>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
