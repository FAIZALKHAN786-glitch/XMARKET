"use client";

import { useEffect, useState } from "react";
import { Sparkles, Pencil, ChevronDown } from "lucide-react";

/* Right-side AI extraction panel.
   Desktop: sticky float beside the form.
   Mobile / tablet: collapses into an accordion below the form. */
export default function AIExtractPanel({ data, loading, visible }) {
  const [collapsed, setCollapsed] = useState(false);
  const [barWidth, setBarWidth] = useState(0);

  // Animate the confidence fill from 0 on each new extraction.
  useEffect(() => {
    setBarWidth(0);
    if (!data) return;
    const t = setTimeout(() => setBarWidth(data.confidence), 60);
    return () => clearTimeout(t);
  }, [data]);

  if (!visible) return null;

  const rows = [
    { field: "Category", value: data?.category },
    { field: "Budget", value: data?.budget },
    { field: "Deadline", value: data?.deadline },
    { field: "Preferences", value: data?.preferences },
  ];

  return (
    <aside className="glass ai-panel" aria-label="AI extracted requirements">
      <button
        type="button"
        className="ai-panel-head"
        aria-expanded={!collapsed}
        aria-controls="ai-panel-body"
        onClick={() => setCollapsed((v) => !v)}
      >
        <span className="ai-panel-head-left">
          <Sparkles size={14} strokeWidth={1.5} />
          <span className="ai-panel-title">AI Extracted</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="pulse-dot" aria-hidden="true" />
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className={`ai-chev ${collapsed ? "" : "open"}`}
            aria-hidden="true"
          />
        </span>
      </button>

      <div id="ai-panel-body" className={`ai-body ${collapsed ? "collapsed" : ""}`}>
        <div className="ai-sep" />

        <div>
          {rows.map((row) => (
            <div className="ai-row" key={row.field}>
              <span className="ai-field">{row.field}</span>
              <span className="ai-val-wrap">
                {loading && !data ? (
                  <span className="skeleton ai-loading-bar" />
                ) : row.value && row.value !== "—" ? (
                  <span className="ai-val">{row.value}</span>
                ) : (
                  <span className="ai-val empty">—</span>
                )}
                <button
                  type="button"
                  className="ai-edit"
                  aria-label={`Edit ${row.field.toLowerCase()}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Pencil size={12} strokeWidth={1.5} />
                </button>
              </span>
            </div>
          ))}
        </div>

        <div className="ai-sep" />

        <div>
          <div className="conf-label-row">
            <span className="conf-label">Confidence</span>
            <span className="conf-num">{data ? `${data.confidence}%` : "— —"}</span>
          </div>
          <div
            className="conf-bar"
            role="progressbar"
            aria-valuenow={data?.confidence ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Extraction confidence"
          >
            <div className="conf-fill" style={{ width: `${barWidth}%` }} />
          </div>
        </div>
      </div>
    </aside>
  );
}
