"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { fromNow, round, shortDate } from "@/lib/format";

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 select-none whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  // White on black — the single accent in the system.
  primary: "bg-white text-black hover:bg-white/85",
  secondary: "border border-white/20 text-white hover:border-white/40 hover:bg-white/5",
  outline: "border border-white/15 text-white/85 hover:border-white/40 hover:text-white",
  ghost: "text-white/60 hover:text-white hover:bg-white/5",
  danger: "border border-white/20 text-white/70 hover:border-white/45 hover:text-white",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.8125rem]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[0.9375rem]",
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

/**
 * Monochrome emphasis scale: `solid` is the strongest, `bad` the weakest.
 * Meaning is carried by fill and border weight, never by hue.
 */
export type Tone = "neutral" | "outline" | "solid" | "muted" | "good" | "warn" | "bad";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    neutral: "border-white/12 text-white/60",
    outline: "border-white/30 text-white",
    solid: "border-white bg-white text-black",
    muted: "border-transparent bg-white/5 text-white/50",
    good: "border-white/45 bg-white/10 text-white",
    warn: "border-white/20 bg-white/5 text-white/75",
    bad: "border-white/10 text-white/40",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: Tone; label: string }> = {
    open: { tone: "outline", label: "Open" },
    reviewing: { tone: "muted", label: "Reviewing" },
    awarded: { tone: "solid", label: "Awarded" },
    closed: { tone: "muted", label: "Closed" },
    pending: { tone: "muted", label: "Pending" },
    shortlisted: { tone: "outline", label: "Shortlisted" },
    accepted: { tone: "solid", label: "Accepted" },
    rejected: { tone: "bad", label: "Declined" },
  };
  const entry = map[status] ?? { tone: "neutral" as Tone, label: status };
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
    <Tag className={cn("surface p-5", hover && "surface-hover", className)}>
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
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="text-2xl font-semibold text-white md:text-[1.875rem] md:leading-[1.2]">
        {title}
      </h2>
      {body && <p className="mt-3 text-[0.9375rem] leading-relaxed muted">{body}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Avatar */

export function Avatar({
  initials,
  size = 40,
  className,
}: {
  initials: string;
  size?: number;
  /** Kept for API compatibility; monochrome avatars do not vary by seed. */
  seed?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: round(size * 0.34) }}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-lg border border-white/12 bg-white/5 font-semibold tracking-wide text-white/85",
        className
      )}
    >
      {initials}
    </span>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[0.8125rem] text-white/75">
      <svg viewBox="0 0 20 20" className="size-3 fill-white/70" aria-hidden>
        <path d="M10 1.5l2.6 5.3 5.9.85-4.25 4.14 1 5.86L10 14.9l-5.25 2.75 1-5.86L1.5 7.65l5.9-.85z" />
      </svg>
      <span className="num">{value.toFixed(1)}</span>
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
  // Rounded to one decimal: identical on the server and the client, so
  // hydration never sees a style mismatch.
  const pct = Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-white/10", trackClassName, className)}
    >
      <div
        className={cn("h-full rounded-full bg-white transition-[width] duration-500 ease-out", barClassName)}
        style={{ width: `${pct}%` }}
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
        "inline-flex items-center gap-0.5 rounded-xl border border-white/12 p-0.5",
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
              "inline-flex items-center gap-1.5 rounded-[0.6rem] font-medium transition-colors",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[0.8125rem]",
              active
                ? "bg-white text-black"
                : "text-white/55 hover:bg-white/5 hover:text-white"
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 px-6 py-14 text-center">
      {icon && (
        <span className="mb-4 grid size-11 place-items-center rounded-xl border border-white/10 text-white/45">
          {icon}
        </span>
      )}
      <p className="font-medium text-white">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-sm muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ TimeAgo */

/**
 * Relative time is never rendered during server rendering or hydration — the
 * first client paint shows a deterministic absolute date and only swaps to the
 * relative label after mount. This is what keeps hydration clean.
 */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = React.useState(() => shortDate(iso));
  const relative = React.useRef<string | null>(null);

  React.useEffect(() => {
    const update = () => {
      relative.current = fromNow(iso);
      setLabel(relative.current);
    };
    update();
    const t = window.setInterval(update, 60_000);
    return () => window.clearInterval(t);
  }, [iso]);

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
        <p className="eyebrow">{label}</p>
        {icon && <span className="text-white/30">{icon}</span>}
      </div>
      <p className="num mt-2.5 text-2xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs muted">{hint}</p>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("hairline my-5", className)} />;
}
