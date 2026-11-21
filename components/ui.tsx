"use client";

import { useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { CATEGORY_LABELS } from "@/lib/xmarket";
import type { CategoryId } from "@/lib/types";

type Tone = "primary" | "outline" | "ghost" | "danger";

export function Button({
  children,
  className = "",
  tone = "primary",
  disabled,
  onClick,
  type = "button",
  ...rest
}: {
  children?: ReactNode;
  className?: string;
  tone?: Tone;
  disabled?: boolean;
  onClick?: () => void;
  type?: "submit" | "reset" | "button";
} & Omit<ComponentPropsWithoutRef<"button">, "children" | "className" | "onClick" | "type" | "disabled">) {
  return (
    <button
      type={type}
      className={`btn btn-${tone} ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={`field ${className}`} {...props} />;
}

export function TextArea({ className = "", ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={`field ${className}`} {...props} />;
}

export function Select({
  className = "",
  children,
  ...props
}: ComponentPropsWithoutRef<"select">) {
  return (
    <select className={`field ${className}`} {...props}>
      {children}
    </select>
  );
}

export function CategorySelect({
  value,
  onChange,
  includeAll = false,
}: {
  value: string;
  onChange: (id: CategoryId) => void;
  includeAll?: boolean;
}) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value as CategoryId)}>
      {includeAll && <option value="">All categories</option>}
      {(Object.keys(CATEGORY_LABELS) as CategoryId[]).map((id) => (
        <option key={id} value={id}>
          {CATEGORY_LABELS[id]}
        </option>
      ))}
    </Select>
  );
}

export function Card({
  children,
  className = "",
  dark = false,
}: {
  children?: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return <div className={`${dark ? "surface-dark" : "surface"} ${className}`}>{children}</div>;
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children?: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
  className?: string;
}) {
  return <span className={`chip chip-${tone} ${className}`}>{children}</span>;
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="stat-card">
      <p className="eyebrow">{label}</p>
      <p className="num stat-value">{value}</p>
      {hint && <p className="stat-hint">{hint}</p>}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="section-heading">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function ScoreBar({ score, label }: { score: number; label?: string }) {
  const value = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className="score-wrap">
      {label && (
        <div className="score-label">
          <span>{label}</span>
          <span className="num">{value}</span>
        </div>
      )}
      <div className="score-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="score-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`copy-btn ${className}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          const el = document.createElement("textarea");
          el.value = value;
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          el.remove();
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
      aria-label={`Copy ${value}`}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

export function XMarketIdCard({
  xMarketId,
  role,
  subtitle,
  footer,
}: {
  xMarketId: string;
  role: "buyer" | "seller";
  subtitle?: string;
  footer?: ReactNode;
}) {
  return (
    <Card dark className="id-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow id-eyebrow">Your XMarket ID · {role}</p>
          <p className="id-value num">{xMarketId}</p>
          <p className="id-sub">{subtitle ?? "One ID. Every deal, bid and reward."}</p>
        </div>
        <span className="id-orb" aria-hidden="true" />
      </div>
      <div className="id-actions">
        <CopyButton value={xMarketId} label="Copy ID" />
        <a className="copy-btn" href={`/id/${xMarketId}`}>
          View card ↗
        </a>
      </div>
      {footer && <div className="id-footer">{footer}</div>}
    </Card>
  );
}

const PIE_COLORS = ["#111111", "#4f4f4f", "#8a8a8a", "#bdbdbd", "#d8d8d8", "#c9f24a"];

export function DonutChart({
  data,
  total,
}: {
  data: { label: string; value: number }[];
  total: number;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="donut-layout">
      <svg viewBox="0 0 120 120" className="donut" role="img" aria-label="Spending by category">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#ecece8" strokeWidth="16" />
        {data.map((row, i) => {
          const fraction = total > 0 ? row.value / total : 0;
          const dash = fraction * circumference;
          const circle = (
            <circle
              key={row.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={PIE_COLORS[i % PIE_COLORS.length]}
              strokeWidth="16"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += dash;
          return circle;
        })}
        <text x="60" y="57" textAnchor="middle" className="donut-total num">
          {data.length ? `${Math.round(total / 1000)}k` : "$0"}
        </text>
        <text x="60" y="72" textAnchor="middle" className="donut-caption">
          total spent
        </text>
      </svg>
      <ul className="donut-legend">
        {data.map((row, i) => (
          <li key={row.label}>
            <span className="legend-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="legend-label">{row.label}</span>
            <span className="num legend-value">
              {total > 0 ? Math.round((row.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      <p className="empty-body">{body}</p>
      {action}
    </div>
  );
}
