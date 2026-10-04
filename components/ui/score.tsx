"use client";

import { cn } from "@/lib/cn";
import { scoreToken } from "@/lib/engine";
import { round } from "@/lib/format";
import type { Score, ScoreFactor } from "@/lib/types";
import { Progress } from "./primitives";

export function ScoreRing({
  score,
  size = 64,
  stroke = 6,
  label,
  className,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
}) {
  const token = scoreToken(score);
  const r = (size - stroke) / 2;
  const c = round(2 * Math.PI * r);
  // Two decimals keeps the rendered SVG tidy; the value is a pure function of
  // an integer score, so it is identical on the server and the client.
  const dash = Math.round(((Math.max(0, Math.min(100, score)) / 100) * c) * 100) / 100;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      title={`Compatibility score ${score}/100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={token.hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray 900ms cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span
          className={cn("num font-bold leading-none", token.text)}
          style={{ fontSize: round(size * 0.3) }}
        >
          {Math.round(score)}
        </span>
        {label && (
          <span
            className="faint mt-0.5 font-semibold tracking-wider uppercase"
            style={{ fontSize: round(size * 0.14) }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export function ScorePill({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md";
}) {
  const token = scoreToken(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        token.soft,
        token.ring,
        token.text,
        size === "sm" ? "px-2 py-0.5 text-[0.6875rem]" : "px-2.5 py-1 text-xs"
      )}
    >
      <span className={cn("size-1.5 rounded-full", token.bg)} />
      <span className="num">{Math.round(score)}</span>
      <span className="opacity-70">match</span>
    </span>
  );
}

export function FactorBar({ factor }: { factor: ScoreFactor }) {
  const token = scoreToken(factor.score);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.8125rem] font-medium text-white/85">
          {factor.label}
          <span className="faint ml-1.5 text-[0.6875rem] font-normal">
            ×{factor.weight.toFixed(2)}
          </span>
        </span>
        <span className={cn("num text-[0.8125rem] font-semibold", token.text)}>
          {factor.score}
        </span>
      </div>
      <Progress
        value={factor.score}
        className="mt-2"
        barClassName={token.bg}
        trackClassName="bg-white/10"
      />
      <p className="mt-1.5 text-xs leading-relaxed faint">{factor.detail}</p>
    </div>
  );
}

export function ScoreBreakdown({
  score,
  compact,
}: {
  score: Score;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-4", compact && "space-y-3.5")}>
      {score.factors.map((factor) => (
        <FactorBar key={factor.key} factor={factor} />
      ))}
      {!compact && (score.strengths.length > 0 || score.risks.length > 0) && (
        <div className="space-y-2 border-t border-white/10 pt-4">
          {score.strengths.map((s, i) => (
            <p key={`s${i}`} className="flex gap-2 text-xs leading-relaxed text-white/75">
              <span className="text-white">+</span>
              {s}
            </p>
          ))}
          {score.risks.map((r, i) => (
            <p key={`r${i}`} className="flex gap-2 text-xs leading-relaxed text-white/75">
              <span className="text-white/40">−</span>
              {r}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tiny inline sparkline used on dashboard tiles. */
export function Sparkline({
  points,
  className,
}: {
  points: number[];
  className?: string;
}) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 100 - ((p - min) / (max - min || 1)) * 100;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("h-8 w-full", className)}>
      <path
        d={path}
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="4"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
      />
    </svg>
  );
}
