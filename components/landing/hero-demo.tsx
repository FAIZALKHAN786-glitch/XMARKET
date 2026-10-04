"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  CalendarClock,
  Minus,
  Sparkles,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { compatibility, scoreToken } from "@/lib/engine";
import { usd } from "@/lib/format";
import { CATEGORIES, PROVIDERS, REQUIREMENTS } from "@/lib/data";
import type { Weights } from "@/lib/types";
import { CategoryMark } from "../icons";

const PRESETS: { id: string; label: string; weights: Weights }[] = [
  { id: "balanced", label: "Balanced", weights: { budget: 0.35, timeline: 0.3, relevance: 0.35 } },
  { id: "cheap", label: "Cheapest wins", weights: { budget: 0.6, timeline: 0.2, relevance: 0.2 } },
  { id: "fast", label: "Fastest wins", weights: { budget: 0.25, timeline: 0.55, relevance: 0.2 } },
  { id: "expert", label: "Best qualified", weights: { budget: 0.2, timeline: 0.25, relevance: 0.55 } },
];

const DEMO_BIDS = [
  { id: "bid_mech_atlas", price: 74200, delivery: 34 },
  { id: "bid_mech_voltaic", price: 61800, delivery: 55 },
  { id: "bid_mech_kestrel", price: 88300, delivery: 28 },
];

export function HeroDemo() {
  const [presetId, setPresetId] = React.useState("balanced");
  const [animate, setAnimate] = React.useState(false);
  const requirement = REQUIREMENTS[0];
  const preset = PRESETS.find((p) => p.id === presetId)!;

  const ranked = React.useMemo(() => {
    const full = DEMO_BIDS.map((demo) => {
      const bid = {
        id: demo.id,
        requirementId: requirement.id,
        providerId:
          demo.id === "bid_mech_atlas"
            ? "p_atlas"
            : demo.id === "bid_mech_voltaic"
              ? "p_voltaic"
              : "p_kestrel",
        price: demo.price,
        deliveryDays: demo.delivery,
        pitch: "",
        coversTags:
          demo.id === "bid_mech_kestrel"
            ? ["5-axis CNC", "Aluminium 6061", "Anodising", "PPAP"]
            : requirement.tags,
        milestones: [],
        createdAt: new Date().toISOString(),
        status: "pending" as const,
      };
      const provider = PROVIDERS.find((p) => p.id === bid.providerId);
      return {
        bid,
        provider,
        score: compatibility(bid, requirement, provider, preset.weights),
      };
    });
    return full.sort((a, b) => b.score.total - a.score.total);
  }, [preset, requirement]);

  const order = ranked.map((r) => r.provider?.name).join("|");
  const prevOrder = React.useRef(order);
  React.useEffect(() => {
    if (prevOrder.current !== order) {
      setAnimate(true);
      const t = window.setTimeout(() => setAnimate(false), 700);
      prevOrder.current = order;
      return () => window.clearTimeout(t);
    }
  }, [order]);

  const category = CATEGORIES.find((c) => c.id === requirement.category)!;

  return (
    <div className="surface overflow-hidden p-0 shadow-[0_50px_120px_-60px_rgba(0,0,0,1)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-white/[0.02] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-white/12" />
            <span className="size-2.5 rounded-full bg-white/12" />
            <span className="size-2.5 rounded-full bg-white/12" />
          </span>
          <span className="ml-2 font-mono text-[0.6875rem] text-white/40">
            xmarket / r_mech / offers
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-[var(--color-aqua-300)]">
          <span className="size-1.5 rounded-full bg-[var(--color-aqua-400)] animate-pulse-soft" />
          engine live
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        {/* ---------------- The requirement ---------------- */}
        <div className="border-b border-white/8 p-5 lg:border-r lg:border-b-0">
          <p className="text-[0.6875rem] font-bold tracking-[0.2em] text-white/40 uppercase">
            Buyer posts a need
          </p>

          <div className="mt-4 flex items-start gap-3">
            <CategoryMark category={requirement.category} size={38} />
            <div>
              <p className="text-[0.9375rem] leading-snug font-semibold text-white">
                {requirement.title}
              </p>
              <p className="mt-1 text-xs faint">{category.label}</p>
            </div>
          </div>

          <dl className="mt-5 space-y-3 border-t border-white/8 pt-4">
            <Row icon={<Wallet className="size-3.5" />} label="Budget ceiling">
              <span className="num font-semibold text-white">
                {usd(requirement.budgetMax)}
              </span>
              <span className="faint ml-1.5 text-xs">
                target {usd(requirement.budgetTarget, { compact: true })}
              </span>
            </Row>
            <Row
              icon={<CalendarClock className="size-3.5" />}
              label="Delivery window"
            >
              <span className="font-semibold text-white">
                {requirement.tags.length} spec tags · 46 days
              </span>
            </Row>
            <Row icon={<Sparkles className="size-3.5" />} label="Must-haves">
              <span className="text-white/85">{requirement.mustHaves.length} hard requirements</span>
            </Row>
          </dl>

          <div className="mt-5 border-t border-white/8 pt-4">
            <p className="text-[0.6875rem] font-bold tracking-[0.16em] text-white/45 uppercase">
              Re-rank by priority
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPresetId(p.id)}
                  aria-pressed={presetId === p.id}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition",
                    presetId === p.id
                      ? "border-[var(--color-iris-400)]/55 bg-[var(--color-iris-500)]/20 text-white"
                      : "border-white/10 bg-white/4 text-white/60 hover:border-white/25 hover:text-white"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <p className="num mt-3 font-mono text-[0.6875rem] text-white/40">
              w = [{preset.weights.budget.toFixed(2)},{" "}
              {preset.weights.timeline.toFixed(2)},{" "}
              {preset.weights.relevance.toFixed(2)}]
            </p>
          </div>
        </div>

        {/* ---------------- Ranked offers ---------------- */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-[0.6875rem] font-bold tracking-[0.2em] text-white/40 uppercase">
              Providers submit offers
            </p>
            <span className="num text-[0.6875rem] faint">
              ranked by compatibility
            </span>
          </div>

          <ol className="mt-4 space-y-2.5">
            {ranked.map((row, i) => {
              const token = scoreToken(row.score.total);
              const demo = DEMO_BIDS.find((d) => d.id === row.bid.id)!;
              return (
                <li
                  key={row.bid.id}
                  className={cn(
                    "rounded-xl border border-white/8 bg-white/[0.025] p-3.5 transition-all duration-500",
                    animate && "border-[var(--color-iris-400)]/40"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="num grid size-6 shrink-0 place-items-center rounded-md bg-white/6 text-[0.6875rem] font-bold text-white/70">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[0.8125rem] font-semibold text-white">
                        {row.provider?.name}
                        {row.provider?.verified && (
                          <BadgeCheck className="size-3.5 shrink-0 text-[var(--color-aqua-400)]" />
                        )}
                      </p>
                      <p className="num mt-0.5 text-[0.6875rem] faint">
                        {usd(row.bid.price)} · {row.bid.deliveryDays} days
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "num rounded-lg border px-2 py-1 text-[0.8125rem] font-bold",
                          token.soft,
                          token.ring,
                          token.text
                        )}
                      >
                        {row.score.total}
                      </span>
                      {i === 0 ? (
                        <ArrowUp className="size-3.5 text-[var(--color-score-high)]" />
                      ) : (
                        <Minus className="size-3.5 text-white/20" />
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex gap-1">
                    {row.score.factors.map((f) => (
                      <span
                        key={f.key}
                        title={`${f.label}: ${f.score}`}
                        className="h-1 flex-1 overflow-hidden rounded-full bg-white/8"
                      >
                        <span
                          className="block h-full rounded-full transition-[width] duration-700"
                          style={{
                            width: `${f.score}%`,
                            background: scoreToken(f.score).hex,
                          }}
                        />
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[0.6875rem] leading-relaxed faint">
                    {row.score.factors[0].detail}
                  </p>
                </li>
              );
            })}
          </ol>

          <p className="mt-4 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[0.75rem] muted">
            <ArrowDown className="size-3.5 shrink-0 text-[var(--color-iris-300)]" />
            Change priorities and watch the ranking move — same bids, different
            definition of “best”.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-[0.75rem] text-white/50">
        {icon}
        {label}
      </dt>
      <dd className="text-right text-[0.8125rem]">{children}</dd>
    </div>
  );
}
