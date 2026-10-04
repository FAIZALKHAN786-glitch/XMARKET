"use client";

import * as React from "react";
import { RotateCcw, Sliders, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { DEFAULT_WEIGHTS } from "@/lib/engine";
import { round } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Weights } from "@/lib/types";
import { Button } from "./ui/primitives";

const ROWS: {
  key: keyof Weights;
  label: string;
  hint: string;
  accent: string;
}[] = [
  {
    key: "budget",
    label: "Budget priority",
    hint: "Rewards offers that come in under your target price",
    accent: "#ffffff",
  },
  {
    key: "timeline",
    label: "Timeline priority",
    hint: "Rewards faster delivery against your deadline",
    accent: "#9a9a9a",
  },
  {
    key: "relevance",
    label: "Requirement relevance",
    hint: "Weights experience, tag coverage and reliability",
    accent: "#5c5c5c",
  },
];

export function WeightTuner({ className }: { className?: string }) {
  const { weights, setWeights, reset } = useStore();
  const total = weights.budget + weights.timeline + weights.relevance || 1;

  const update = (key: keyof Weights, next: number) => {
    const raw = { ...weights, [key]: next };
    const sum = raw.budget + raw.timeline + raw.relevance || 1;
    setWeights({
      budget: raw.budget / sum,
      timeline: raw.timeline / sum,
      relevance: raw.relevance / sum,
    });
  };

  const preset = (w: Weights) => setWeights(w);

  return (
    <div className={cn("surface p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-white">
            <Sliders className="size-4 text-white/75" />
            Priority weighting
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed muted">
            Tune what “compatible” means. Every score on this page recalculates
            live.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => preset(DEFAULT_WEIGHTS)}
          title="Reset to balanced weights"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <PresetChip
          active={Math.abs(weights.budget - 0.6) < 0.02}
          onClick={() => preset({ budget: 0.6, timeline: 0.2, relevance: 0.2 })}
        >
          Cheapest wins
        </PresetChip>
        <PresetChip
          active={Math.abs(weights.timeline - 0.55) < 0.02}
          onClick={() => preset({ budget: 0.25, timeline: 0.55, relevance: 0.2 })}
        >
          Fastest wins
        </PresetChip>
        <PresetChip
          active={Math.abs(weights.relevance - 0.55) < 0.02}
          onClick={() => preset({ budget: 0.2, timeline: 0.25, relevance: 0.55 })}
        >
          Best qualified
        </PresetChip>
        <PresetChip
          active={
            Math.abs(weights.budget - DEFAULT_WEIGHTS.budget) < 0.02 &&
            Math.abs(weights.timeline - DEFAULT_WEIGHTS.timeline) < 0.02
          }
          onClick={() => preset(DEFAULT_WEIGHTS)}
        >
          Balanced
        </PresetChip>
      </div>

      <div className="mt-5 space-y-5">
        {ROWS.map((row) => {
          const value = weights[row.key];
          const share = (value / total) * 100;
          return (
            <div key={row.key}>
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-[0.8125rem] font-medium text-white/90">
                    {row.label}
                  </p>
                  <p className="mt-0.5 text-xs faint">{row.hint}</p>
                </div>
                <span className="num text-[0.8125rem] font-semibold text-white">
                  {share.toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(share)}
                onChange={(e) =>
                  update(row.key, Number(e.target.value) / 100 + 0.0001)
                }
                aria-label={row.label}
                className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-white [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink-950 [&::-webkit-slider-thumb]:bg-white"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-wide text-white/50 uppercase">
          <Sparkles className="size-3" /> Live formula
        </p>
        <p className="num mt-2 text-[0.8125rem] text-white/80">
          score ={" "}
          <span className="text-white">
            {weights.budget.toFixed(2)}
          </span>
          ·budget +{" "}
          <span className="text-white/60">
            {weights.timeline.toFixed(2)}
          </span>
          ·timeline +{" "}
          <span className="text-white/75">
            {weights.relevance.toFixed(2)}
          </span>
          ·relevance
        </p>
      </div>
    </div>
  );
}

function PresetChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[0.75rem] font-medium transition",
        active
          ? "border-white/45/50 bg-white/18 text-white"
          : "border-white/10 bg-white/5 text-white/60 hover:border-white/25 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
