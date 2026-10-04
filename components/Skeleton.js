/* Skeleton loaders — shimmer blocks matching real element dimensions. */

export function SkeletonMatchCard() {
  return (
    <div className="glass offer-card" aria-hidden="true">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div className="skeleton" style={{ width: 64, height: 64, borderRadius: "50%" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <div className="skeleton" style={{ width: 110, height: 13 }} />
          <div className="skeleton" style={{ width: 70, height: 11 }} />
        </div>
      </div>
      <div className="skeleton" style={{ width: "60%", height: 26 }} />
      <div className="skeleton" style={{ width: "45%", height: 24, borderRadius: 999 }} />
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
      <div className="skeleton" style={{ width: "90%", height: 12 }} />
      <div className="skeleton" style={{ width: "70%", height: 12 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="skeleton" style={{ height: 38 }} />
        <div className="skeleton" style={{ height: 38 }} />
      </div>
    </div>
  );
}

export function SkeletonRequirementRow() {
  return (
    <div className="glass req-card" aria-hidden="true">
      <div className="skeleton" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="skeleton" style={{ width: "60%", height: 14 }} />
        <div className="skeleton" style={{ width: "85%", height: 12 }} />
      </div>
      <div className="skeleton" style={{ width: 96, height: 34, flexShrink: 0 }} />
    </div>
  );
}

export function SkeletonText({ width = "80%", height = 13, style = {} }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}
