"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Card, DonutChart, ScoreBar, SectionTitle } from "./ui";
import { CATEGORY_LABELS, money } from "@/lib/xmarket";

type Tracking = {
  xMarketId: string;
  totalSpent: number;
  upcommitted: number;
  targetTotal: number;
  savings: number;
  awards: { requirementId: string; title: string; category: string; amount: number; date: string }[];
  categories: Record<string, number>;
  trend: { label: string; value: number }[];
  smartTip: string;
  lastUpdated: string;
};

export function BudgetTracker() {
  const [data, setData] = useState<Tracking | null>(null);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(() => {
    api<Tracking>("/api/budget/tracking").then(({ data: d }) => {
      if (d) setData(d);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const reset = async () => {
    setResetting(true);
    const r = await api<Tracking>("/api/budget/tracking/reset", { method: "POST" });
    if (r.data) setData(r.data);
    setResetting(false);
  };

  const donut = Object.entries(data?.categories ?? {})
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ label: CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS] ?? key, value }));
  const peak = Math.max(1, ...(data?.trend.map((t) => t.value) ?? [1]));

  return (
    <Card className="fade-up delay-1">
      <SectionTitle
        eyebrow="Novelty 04 · buyer only"
        title="My Budget Overview"
        action={<span className="chip num">{data?.xMarketId ?? "XM-BUYER-…"}</span>}
      />

      <div className="flex items-end justify-between gap-3 mb-5">
        <div>
          <p className="eyebrow">Total spent across awards</p>
          <p className="num font-semibold" style={{ fontSize: 38, letterSpacing: "-.05em", margin: 0 }}>
            {money(data?.totalSpent ?? 0)}
          </p>
        </div>
        <span className={`chip ${data && data.savings >= 0 ? "chip-good" : "chip-warn"}`}>
          {data && data.savings >= 0 ? "Under target" : "Over target"}
        </span>
      </div>

      <DonutChart data={donut} total={data?.totalSpent ?? 0} />

      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="stat-card" style={{ padding: 14 }}>
          <p className="eyebrow">Committed</p>
          <p className="num stat-value" style={{ fontSize: 20 }}>{money(data?.upcommitted ?? 0)}</p>
          <p className="stat-hint">Live + shortlisted bids</p>
        </div>
        <div className="stat-card" style={{ padding: 14 }}>
          <p className="eyebrow">Awards</p>
          <p className="num stat-value" style={{ fontSize: 20 }}>{data?.awards.length ?? 0}</p>
          <p className="stat-hint">Tracked by your ID</p>
        </div>
      </div>

      <div className="mt-6">
        <p className="eyebrow">Spending trend</p>
        <div className="trend">
          {(data?.trend ?? []).map((row) => (
            <div className="trend-col" key={row.label}>
              <div className="trend-bar" style={{ height: `${Math.max(4, (row.value / peak) * 64)}px` }} />
              <span className="trend-label">{row.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 p-4 rounded-xl" style={{ background: "#f5f5ef" }}>
        <p className="eyebrow">Smart recommendation</p>
        <p className="text-[13px] leading-relaxed m-0">{data?.smartTip ?? "Reading your spending pattern…"}</p>
      </div>

      {!!data?.awards.length && (
        <div className="mt-6">
          <p className="eyebrow">Award history</p>
          {data.awards.map((award) => (
            <div className="card-link" key={award.requirementId}>
              <div className="min-w-0">
                <p className="card-title truncate">{award.title}</p>
                <p className="card-meta">
                  <span>{CATEGORY_LABELS[award.category as keyof typeof CATEGORY_LABELS] ?? award.category}</span>
                  <span>{new Date(award.date).toLocaleDateString()}</span>
                </p>
              </div>
              <span className="num font-semibold text-sm">{money(award.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-[#e3e3dc] flex items-center justify-between gap-3">
        <span className="text-[11px] text-[#8a8a82]">Escrow milestones reference this ID</span>
        <Button tone="ghost" onClick={reset} disabled={resetting || !data}>
          {resetting ? "Resetting…" : "Reset budget tracking"}
        </Button>
      </div>
      {data && <div className="mt-3"><ScoreBar score={Math.min(100, Math.round((data.totalSpent / Math.max(1, data.targetTotal)) * 100))} label="Target budget used" /></div>}
    </Card>
  );
}
