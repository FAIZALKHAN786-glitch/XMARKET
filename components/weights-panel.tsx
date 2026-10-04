"use client";

import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { DEFAULT_WEIGHTS } from "@/lib/engine";
import { round } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Weights } from "@/lib/types";
import { Button } from "./ui/primitives";

const ROWS: { key: keyof Weights; label: string; color: string }[] = [
  { key: "budget", label: "Budget", color: "#ffffff" },
  { key: "timeline", label: "Timeline", color: "#9a9a9a" },
  { key: "relevance", label: "Relevance", color: "#5c5c5c" },
];

const PRESETS: { label: string; weights: Weights }[] = [
  { label: "Balanced", weights: DEFAULT_WEIGHTS },
  { label: "Cheapest", weights: { budget: 0.6, timeline: 0.2, relevance: 0.2 } },
  { label: "Fastest", weights: { budget: 0.25, timeline: 0.55, relevance: 0.2 } },
  { label: "Best fit", weights: { budget: 0.2, timeline: 0.25, relevance: 0.55 } },
];

export function WeightsPanel({ className }: { className?: string }) {
  const { weights, setWeights } = useStore();
  const total = weights.budget + weights.timeline + weights.relevance || 1;

  const update = (key: keyof Weights, value: number) => {
    const raw = { ...weights, [key]: value + 0.0001 };
    const sum = raw.budget + raw.timeline + raw.relevance || 1;
    setWeights({
      budget: raw.budget / sum,
      timeline: raw.timeline / sum,
      relevance: raw.relevance / sum,
    });
  };

  const activePreset = PRESETS.find(
    (p) => Math.abs(p.weights.timeline - weights.timeline) < 0.02 &&
      Math.abs(p.weights.budget - weights.budget) < 0.02
  );

  return (
    <div className={cn("surface p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.9375rem] font-semibold text-white">
            Priority weighting
          </p>
          <p className="mt-1 text-[0.8125rem] leading-relaxed muted">
            Define what “best” means for this requirement.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setWeights(DEFAULT_WEIGHTS)}
          aria-label="Reset weights"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setWeights(p.weights)}
            aria-pressed={activePreset?.label === p.label}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition",
              activePreset?.label === p.label
                ? "border-white/45/55 bg-white/20 text-white"
                : "border-white/10 bg-white/5 text-white/60 hover:border-white/25 hover:text-white"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* stacked weight bar */}
      <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-white/5">
        {ROWS.map((row) => (
          <span
            key={row.key}
            title={`${row.label} ${((weights[row.key] / total) * 100).toFixed(0)}%`}
            className="h-full transition-[width] duration-300"
            style={{
              width: `${round((weights[row.key] / total) * 100, 1)}%`,
              background: row.color,
            }}
          />
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {ROWS.map((row) => {
          const share = (weights[row.key] / total) * 100;
          return (
            <div key={row.key}>
              <div className="flex items-baseline justify-between">
                <span className="flex items-center gap-2 text-[0.8125rem] text-white/85">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: row.color }}
                  />
                  {row.label}
                </span>
                <span className="num text-[0.8125rem] font-semibold text-white">
                  {share.toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(share)}
                aria-label={`${row.label} weight`}
                onChange={(e) => update(row.key, Number(e.target.value) / 100)}
                className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-ink-950 [&::-webkit-slider-thumb]:bg-white"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
