"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { api } from "@/lib/api-client";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Badge, Button, Card, EmptyState, SectionTitle, Stat, XMarketIdCard } from "@/components/ui";
import { CATEGORY_LABELS, money } from "@/lib/xmarket";

type Bid = {
  id: string; requirementId: string; price: number; deliveryDays: number; status: string;
  pitch: string; createdAt: string;
  requirement?: { id: string; title: string; category: string; budgetMax: number; status: string };
  milestones?: { label: string; days: number }[];
};
type Requirement = { id: string; title: string; category: string; budgetMax: number; location: string; closesAt: string };

export default function SellerDashboard() {
  const { account, loading } = useSession();
  const router = useRouter();
  const [bids, setBids] = useState<Bid[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);

  useEffect(() => {
    if (!loading && !account) router.replace("/login");
  }, [account, loading, router]);

  useEffect(() => {
    if (!account) return;
    api<{ bids: Bid[] }>(`/api/bids?providerId=${encodeURIComponent(account.xMarketId)}&limit=100`)
      .then(({ data }) => setBids(data?.bids ?? []));
    api<{ requirements: Requirement[] }>("/api/requirements?limit=12")
      .then(({ data }) => setRequirements(data?.requirements ?? []));
  }, [account]);

  if (loading || !account) return <div className="loading">Loading your workspace…</div>;

  const wins = bids.filter((b) => b.status === "accepted");
  const live = bids.filter((b) => b.status === "pending" || b.status === "shortlisted");
  const category = account.shopCategory;
  const feedback = 90 + Math.min(9, wins.length * 3);

  return (
    <div>
      <SiteHeader active="dashboard" />
      <main className="page-frame fade-up">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
          <div>
            <p className="eyebrow">Provider workspace</p>
            <h1 className="page-title">Welcome, {account.shopName ?? account.displayName}!</h1>
            <p className="lede">Your ranked offers, escrow milestones and reputation — all tied to one ID.</p>
          </div>
          <Link href="/requirements" className="btn btn-primary btn-lg">Browse Requirements →</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)] gap-5 items-start">
          <div className="stack">
            <XMarketIdCard
              xMarketId={account.xMarketId}
              role="seller"
              subtitle={`${category ? CATEGORY_LABELS[category] : "Provider"} · ${account.shopLocation ?? "Location on file"}`}
              footer={
                <span>
                  {account.shopName ?? "Your shop"} · Seller ID includes category code for filtering
                </span>
              }
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone="good">✓ Verified status: active</Badge>
              <Badge tone="accent">{category ? CATEGORY_LABELS[category] : "Provider"}</Badge>
              <Badge>Response SLA · 4h</Badge>
            </div>

            <div className="stat-grid">
              <Stat label="Active bids" value={live.length} hint="Pending + shortlisted" />
              <Stat label="Wins" value={wins.length} hint="Accepted offers" />
              <Stat label="Reputation" value={`${feedback}%`} hint="Positive feedback (demo)" />
            </div>

            <section>
              <SectionTitle
                eyebrow="Your work"
                title="Active bids"
                action={<Link href="/requirements" className="btn btn-outline btn-sm">Submit your first bid</Link>}
              />
              {bids.length === 0 ? (
                <EmptyState
                  title="No bids yet"
                  body="Find a requirement that fits your shop and submit a priced offer with milestones."
                  action={<Link href="/requirements" className="btn btn-primary btn-sm">Browse requirements</Link>}
                />
              ) : (
                bids.slice(0, 6).map((bid) => (
                  <Card key={bid.id} className="mb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/requirements/${bid.requirementId}`} className="card-title hover:underline">
                          {bid.requirement?.title ?? "Requirement"}
                        </Link>
                        <p className="card-meta">
                          <span className="num">{money(bid.price)}</span>
                          <span>{bid.deliveryDays} days</span>
                          <span className="capitalize">{bid.status}</span>
                        </p>
                      </div>
                      <Badge tone={bid.status === "accepted" ? "good" : bid.status === "rejected" ? "bad" : "neutral"}>
                        {bid.status}
                      </Badge>
                    </div>
                    {bid.status === "accepted" && (
                      <div className="mt-4 p-3 rounded-xl" style={{ background: "#f2f8f3", border: "1px solid #cfe6d6" }}>
                        <p className="text-[12px] font-semibold m-0" style={{ color: "#16864b" }}>
                          Payment held via {account.xMarketId} · escrow-lite
                        </p>
                        <div className="mt-3 flex flex-col gap-2">
                          {(bid.milestones?.length ? bid.milestones : [{ label: "Kick-off", days: 1 }, { label: "Delivery confirmation · release funds", days: bid.deliveryDays }]).map((m) => (
                            <div key={m.label} className="flex justify-between text-[12px] text-[#55554f]">
                              <span>{m.label}</span>
                              <span className="num">Day {m.days} · {account.xMarketId.slice(-6)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </section>
          </div>

          <aside className="stack">
            <Card>
              <p className="eyebrow">Novelty 03</p>
              <p className="card-title">Reputation trail</p>
              <div className="mt-4 space-y-2 text-[13px] text-[#55554f]">
                <div className="flex justify-between"><span>Bids accepted</span><b className="num text-[#0b0b0b]">{wins.length}</b></div>
                <div className="flex justify-between"><span>Deals completed</span><b className="num text-[#0b0b0b]">{wins.length}</b></div>
                <div className="flex justify-between"><span>Positive feedback</span><b className="num text-[#0b0b0b]">{feedback}%</b></div>
              </div>
              <p className="field-hint mt-4">Your record follows this ID across every project.</p>
            </Card>

            <Card>
              <p className="eyebrow">Profile</p>
              <p className="card-title">Shop details</p>
              <dl className="mt-4 text-[13px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-[#8a8a82]">Shop</dt><dd className="m-0 font-medium">{account.shopName ?? "—"}</dd>
                <dt className="text-[#8a8a82]">Location</dt><dd className="m-0 font-medium">{account.shopLocation ?? "—"}</dd>
                <dt className="text-[#8a8a82]">Category</dt><dd className="m-0 font-medium">{category ? CATEGORY_LABELS[category] : "—"}</dd>
              </dl>
              <p className="field-hint mt-4">Profile details were set at signup and are tied to your ID.</p>
            </Card>

            <Card>
              <p className="eyebrow">Suggested for your category</p>
              <div className="mt-3">
                {requirements.filter((r) => r.category === category).slice(0, 3).map((r) => (
                  <Link href={`/requirements/${r.id}`} className="card-link" key={r.id}>
                    <div className="min-w-0">
                      <p className="card-title truncate text-[13px]">{r.title}</p>
                      <p className="card-meta"><span className="num">{money(r.budgetMax)} ceiling</span></p>
                    </div>
                    <span className="arrow">→</span>
                  </Link>
                ))}
                {!requirements.some((r) => r.category === category) && (
                  <p className="text-[13px] text-[#8a8a82] m-0">No open work in your category right now.</p>
                )}
              </div>
            </Card>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
