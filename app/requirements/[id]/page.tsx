"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { useSession } from "@/components/session-provider";
import { BidCard } from "@/components/bid-card";
import { BidForm } from "@/components/bid-form";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui";
import { CATEGORY_LABELS, gradeFor, money } from "@/lib/xmarket";

type Detail = {
  requirement: {
    id: string; title: string; summary: string; description: string; category: string;
    buyerId: string; budgetMax: number; budgetTarget: number; deadline: string; closesAt: string;
    location: string; tags: string[]; mustHaves: string[]; status: string; views: number;
  };
  bids: any[];
  ranked: { bid: any; provider: any; score: { total: number; grade: string; factors: any[] } }[];
};

export default function RequirementDetail() {
  const { account } = useSession();
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBid, setShowBid] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    api<Detail>(`/api/requirements/${id}`).then(({ data: d }) => {
      setData(d ?? null);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [id]);

  const isBuyer = !!account && account.id === data?.requirement.buyerId;
  const isSeller = account?.role === "seller";
  const canBid = isSeller && data && !["awarded", "closed"].includes(data.requirement.status);

  const decide = async (bidId: string, status: "accepted" | "rejected") => {
    const r = await api(`/api/bids/${bidId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setMessage(r.ok ? (r.data as any)?.message ?? `Bid ${status}.` : r.error?.message ?? "Could not update bid.");
    load();
  };

  if (loading) return <div className="loading">Loading requirement…</div>;
  if (!data) return <div><SiteHeader /><main className="narrow-frame"><EmptyState title="Requirement not found" body="It may have been closed or removed." action={<Link href="/requirements" className="btn btn-primary">Browse requirements</Link>} /></main></div>;

  const req = data.requirement;
  const top = data.ranked?.[0];

  return (
    <div>
      <SiteHeader active="browse" />
      <main className="page-frame fade-up">
        <Link href="/requirements" className="eyebrow hover:underline inline-block mb-5">← All requirements</Link>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)] gap-5 items-start">
          <div className="stack">
            <Card>
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <Badge tone="accent">{CATEGORY_LABELS[req.category as keyof typeof CATEGORY_LABELS] ?? req.category}</Badge>
                <Badge className="capitalize">{req.status}</Badge>
                <span className="chip num">{req.views} views</span>
              </div>
              <h1 className="page-title">{req.title}</h1>
              <p className="lede">{req.summary}</p>
              <p className="text-[14px] leading-relaxed text-[#55554f] mt-5">{req.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                {[
                  ["Ceiling", money(req.budgetMax)],
                  ["Target", money(req.budgetTarget)],
                  ["Deadline", new Date(req.deadline).toLocaleDateString()],
                  ["Location", req.location],
                ].map(([label, value]) => (
                  <div className="stat-card" key={label} style={{ padding: 14 }}>
                    <p className="eyebrow" style={{ marginBottom: 4 }}>{label}</p>
                    <p className="num text-sm font-semibold m-0">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <p className="eyebrow">Tags</p>
                <div className="flex flex-wrap gap-2">{req.tags?.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
              </div>
              {!!req.mustHaves?.length && (
                <div className="mt-6">
                  <p className="eyebrow">Must-haves</p>
                  <ul className="m-0 pl-5 text-[13px] text-[#55554f] leading-relaxed">
                    {req.mustHaves.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </div>
              )}
            </Card>

            <section>
              <SectionTitle
                eyebrow={`${data.bids?.length ?? 0} offers`}
                title="Ranked bids"
                action={top ? <Badge tone="good">{gradeFor(top.score?.total ?? 0)} · Top recommended</Badge> : undefined}
              />
              {message && <div className="error-box mb-4" style={{ background: "#e8f6ee", color: "#16864b", borderColor: "#c5e8d4" }}>{message}</div>}
              {showBid && (
                <BidForm requirementId={req.id} onSuccess={() => { setShowBid(false); setMessage("Bid submitted — it will be scored on your dashboard."); load(); }} />
              )}
              {!data.bids?.length ? (
                <EmptyState title="No offers yet" body="Providers can bid until the bidding window closes. Check back soon." />
              ) : (
                <div className="stack">
                  {data.ranked.map((row, index) => (
                    <div key={row.bid.id}>
                      {index === 0 && (
                        <div className="flex items-center gap-3 mb-3">
                          <Badge tone="good">A</Badge>
                          <span className="text-[13px] font-semibold">Top recommendation · {row.score?.total ?? 0}/100</span>
                        </div>
                      )}
                      <BidCard
                        bid={row.bid}
                        provider={row.provider}
                        score={row.score}
                        isBuyer={isBuyer}
                        xMarketId={account?.xMarketId}
                        onAccept={() => decide(row.bid.id, "accepted")}
                        onDecline={() => decide(row.bid.id, "rejected")}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="stack">
            {canBid && (
              <Card>
                <p className="eyebrow">Provider action</p>
                <p className="card-title">Bid on this requirement</p>
                <p className="field-hint">Price, delivery and pitch are scored against the buyer&apos;s budget and deadline.</p>
                <Button className="btn-wide mt-4" onClick={() => setShowBid((v) => !v)}>
                  {showBid ? "Close bid form" : "Submit your offer →"}
                </Button>
              </Card>
            )}
            {isBuyer && (
              <Card>
                <p className="eyebrow">Your ID</p>
                <p className="card-title num text-sm">{account?.xMarketId}</p>
                <p className="field-hint">Accepting a bid puts funds on hold against this ID. Milestones release on confirmation.</p>
              </Card>
            )}
            <Card>
              <p className="eyebrow">Score model</p>
              <p className="card-title">How bids are ranked</p>
              <div className="mt-3 space-y-2 text-[13px] text-[#55554f]">
                <p className="m-0"><b className="text-[#0b0b0b]">Budget fit · 35%</b> — price vs target and ceiling.</p>
                <p className="m-0"><b className="text-[#0b0b0b]">Timeline · 30%</b> — delivery vs deadline.</p>
                <p className="m-0"><b className="text-[#0b0b0b]">Relevance · 35%</b> — tags, category and provider record.</p>
              </div>
            </Card>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
