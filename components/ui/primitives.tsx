"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { dateLabel, fromNow } from "@/lib/format";

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45 select-none whitespace-nowrap active:scale-[0.985]";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-iris-500)] text-white shadow-[0_14px_34px_-16px_rgba(109,93,246,0.95)] hover:bg-[var(--color-iris-400)] hover:shadow-[0_18px_40px_-16px_rgba(109,93,246,1)]",
  secondary:
    "bg-white/8 text-white border border-white/12 hover:bg-white/12 hover:border-white/20",
  outline:
    "border border-white/14 text-white/90 hover:border-[var(--color-iris-400)] hover:text-white hover:bg-[var(--color-iris-500)]/10",
  ghost: "text-white/70 hover:text-white hover:bg-white/8",
  danger:
    "border border-[color-mix(in_oklab,var(--color-score-low)_45%,transparent)] text-[var(--color-score-low)] hover:bg-[color-mix(in_oklab,var(--color-score-low)_14%,transparent)]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-[0.9375rem]",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonBase, variants[variant], sizes[size], className)}
      {...props}
    />
  )
);
Button.displayName = "Button";

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link
      href={href}
      className={cn(buttonBase, variants[variant], sizes[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------- Badge */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "iris" | "aqua" | "good" | "warn" | "bad";
  className?: string;
}) {
  const tones = {
    neutral: "border-white/12 bg-white/5 text-white/70",
    iris: "border-[var(--color-iris-400)]/35 bg-[var(--color-iris-500)]/14 text-[var(--color-iris-300)]",
    aqua: "border-[var(--color-aqua-400)]/35 bg-[var(--color-aqua-400)]/12 text-[var(--color-aqua-300)]",
    good: "border-[var(--color-score-high)]/35 bg-[var(--color-score-high)]/12 text-[var(--color-score-high)]",
    warn: "border-[var(--color-score-mid)]/35 bg-[var(--color-score-mid)]/12 text-[var(--color-score-mid)]",
    bad: "border-[var(--color-score-low)]/35 bg-[var(--color-score-low)]/12 text-[var(--color-score-low)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: Parameters<typeof Badge>[0]["tone"]; label: string }> = {
    open: { tone: "aqua", label: "Open" },
    reviewing: { tone: "iris", label: "Reviewing" },
    awarded: { tone: "good", label: "Awarded" },
    closed: { tone: "neutral", label: "Closed" },
    pending: { tone: "neutral", label: "Pending" },
    shortlisted: { tone: "iris", label: "Shortlisted" },
    accepted: { tone: "good", label: "Accepted" },
    rejected: { tone: "bad", label: "Declined" },
  };
  const entry = map[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

/* -------------------------------------------------------------------- Card */

export function Card({
  children,
  className,
  hover,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  as?: "div" | "section" | "article" | "li";
}) {
  const Tag = as as React.ElementType;
  return (
    <Tag
      className={cn("surface p-5", hover && "surface-hover", className)}
    >
      {children}
    </Tag>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      {eyebrow && (
        <p className="mb-3 text-[0.6875rem] font-bold tracking-[0.22em] text-[var(--color-iris-300)] uppercase">
          {eyebrow}
        </p>
      )}
      <h2 className="text-2xl font-semibold text-white md:text-[2rem] md:leading-[1.15]">
        {title}
      </h2>
      {body && <p className="mt-3 text-[0.9375rem] leading-relaxed muted">{body}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Avatar */

const AVATAR_TONES = [
  "from-[#6d5df6] to-[#38e0cd]",
  "from-[#ff7a59] to-[#ffc247]",
  "from-[#38bdf8] to-[#6d5df6]",
  "from-[#2fe08a] to-[#16c9b8]",
  "from-[#f472b6] to-[#a78bfa]",
  "from-[#facc15] to-[#fb7185]",
];

export function Avatar({
  initials,
  size = 40,
  seed = 0,
  className,
}: {
  initials: string;
  size?: number;
  seed?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-xl bg-gradient-to-br font-bold text-ink-950",
        AVATAR_TONES[Math.abs(seed) % AVATAR_TONES.length],
        className
      )}
    >
      {initials}
    </span>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[0.8125rem] text-white/80">
      <svg viewBox="0 0 20 20" className="size-3.5 fill-[var(--color-score-mid)]">
        <path d="M10 1.5l2.6 5.3 5.9.85-4.25 4.14 1 5.86L10 14.9l-5.25 2.75 1-5.86L1.5 7.65l5.9-.85z" />
      </svg>
      <span className="num font-semibold">{value.toFixed(1)}</span>
      {count !== undefined && <span className="faint">({count})</span>}
    </span>
  );
}

/* ----------------------------------------------------------------- Progress */

export function Progress({
  value,
  className,
  barClassName,
  trackClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  trackClassName?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-white/8",
        trackClassName,
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-[var(--color-iris-400)] transition-[width] duration-700 ease-out",
          barClassName
        )}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* --------------------------------------------------------------- Segmented */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/4 p-1",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg font-medium transition-all",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[0.8125rem]",
              active
                ? "bg-[var(--color-iris-500)] text-white shadow-[0_8px_22px_-12px_rgba(109,93,246,1)]"
                : "text-white/60 hover:bg-white/8 hover:text-white"
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- Empty state */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center">
      {icon && (
        <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-white/6 text-white/60">
          {icon}
        </span>
      )}
      <p className="font-semibold text-white">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-sm muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ TimeAgo */

/** Renders an absolute date on the server, relative time after mount. */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = React.useState(() => dateLabel(iso));
  React.useEffect(() => setLabel(fromNow(iso)), [iso]);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {label}
    </time>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("surface-flat p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[0.6875rem] font-semibold tracking-[0.12em] uppercase faint">
          {label}
        </p>
        {icon && <span className="text-white/35">{icon}</span>}
      </div>
      <p className="num mt-2.5 text-2xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs muted">{hint}</p>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("hairline my-5", className)} />;
}
