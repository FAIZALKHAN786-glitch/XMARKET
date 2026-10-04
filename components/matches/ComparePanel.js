"use client";

/* Comparison sidebar — appears once ≥ 2 offers are shortlisted.
   Mobile: becomes a full-screen bottom sheet (see globals.css). */

const COND_RANK = { New: 3, "Open-box": 2, Refurbished: 1, Used: 0 };

const ROWS = [
  {
    label: "Score",
    get: (o) => o.score,
    fmt: (o) => `${o.score}%`,
    best: "max",
  },
  {
    label: "Price",
    get: (o) => o.price,
    fmt: (o) => `$${o.price.toFixed(2)}`,
    best: "min",
  },
  {
    label: "Delivery",
    get: (o) => o.deliveryDays,
    fmt: (o) => `${o.deliveryDays} days`,
    best: "min",
  },
  {
    label: "Condition",
    get: (o) => COND_RANK[o.condition] ?? 0,
    fmt: (o) => o.condition,
    best: "max",
  },
  {
    label: "Rating",
    get: (o) => o.rating,
    fmt: (o) => `${o.rating}/5`,
    best: "max",
  },
];

export default function ComparePanel({ offers, onClear }) {
  const cols = { gridTemplateColumns: `repeat(${offers.length}, 1fr)` };

  return (
    <aside className="compare-panel" aria-label="Offer comparison">
      <div className="compare-head">
        <span className="compare-title">Comparing {offers.length} offers</span>
        <button type="button" className="compare-clear" onClick={onClear}>
          Clear
        </button>
      </div>

      <div className="compare-table">
        <div className="compare-providers" style={cols}>
          {offers.map((o) => (
            <span key={o.id} className="cp-name" title={o.provider}>
              {o.provider}
            </span>
          ))}
        </div>

        {ROWS.map((row) => {
          const values = offers.map(row.get);
          const target =
            row.best === "max" ? Math.max(...values) : Math.min(...values);
          return (
            <div className="compare-row" key={row.label}>
              <div className="compare-row-label">{row.label}</div>
              <div className="compare-row-values" style={cols}>
                {offers.map((o) => (
                  <span key={o.id} className="compare-val">
                    {row.fmt(o)}
                    {row.get(o) === target && (
                      <span className="best-badge">Best value</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
