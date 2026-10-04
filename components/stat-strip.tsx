"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export function StatStrip({
  items,
  className,
}: {
  items: {
    label: string;
    value: React.ReactNode;
    hint?: string;
    icon?: React.ReactNode;
    tone?: "default" | "good" | "aqua";
  }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "mt-6 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-ink-900 p-5">
          <div className="flex items-start justify-between">
            <dt className="text-[0.6875rem] font-semibold tracking-[0.12em] text-white/50 uppercase">
              {item.label}
            </dt>
            {item.icon && (
              <span
                className={cn(
                  "text-white/35",
                  item.tone === "good" && "text-white",
                  item.tone === "aqua" && "text-white/60"
                )}
              >
                {item.icon}
              </span>
            )}
          </div>
          <dd className="num mt-2.5 text-[1.75rem] leading-none font-semibold text-white">
            {item.value}
          </dd>
          {item.hint && <p className="mt-1.5 text-xs faint">{item.hint}</p>}
        </div>
      ))}
    </dl>
  );
}
