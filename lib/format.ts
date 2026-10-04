export const usd = (n: number, opts: { compact?: boolean } = {}) => {
  if (opts.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
};

export const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export const fromNow = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return "just now";
};

export const deadlineLabel = (iso: string) => {
  const days = Math.round(
    (new Date(iso).getTime() - Date.now()) / 86_400_000
  );
  if (days < 0) return `closed ${Math.abs(days)}d ago`;
  if (days === 0) return "due today";
  if (days === 1) return "1 day left";
  if (days < 14) return `${days} days left`;
  const weeks = Math.round(days / 7);
  return `${weeks} weeks left`;
};

export const urgency = (iso: string): "critical" | "soon" | "comfortable" => {
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  if (days <= 7) return "critical";
  if (days <= 21) return "soon";
  return "comfortable";
};

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

export const pct = (n: number) => `${Math.round(n)}%`;

/**
 * Round to at most `places` decimals. Used for every value that reaches an
 * inline style or SVG attribute so the server and client emit byte-identical
 * markup (and the DOM does not fill up with 30.000000000000004%).
 */
export const round = (n: number, places = 2) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
