"use client";

import { Smartphone, Box, Sparkles } from "lucide-react";
import { TRENDING_SEARCHES } from "@/lib/mockData";

/* Highlight the matched substring of a product name. */
function Highlight({ text, query }) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="hl">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function Autocomplete({
  query,
  products,
  activeIdx,
  closing,
  onPick,
  onTrending,
}) {
  return (
    <div className={`ac-dropdown ${closing ? "closing" : ""}`} role="listbox" aria-label="Suggestions">
      {/* SECTION A — matching products */}
      {products.length > 0 && (
        <>
          <div className="ac-section-header">
            Products matching &lsquo;{query.trim()}&rsquo;
          </div>
          {products.map((p, i) => (
            <div key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                className={`ac-row ${i === activeIdx ? "kb-active" : ""}`}
                onClick={() => onPick(p)}
              >
                <span className="ac-thumb">
                  {p.icon === "phone" ? (
                    <Smartphone size={16} strokeWidth={1.5} />
                  ) : (
                    <Box size={16} strokeWidth={1.5} />
                  )}
                </span>
                <span className="ac-name-wrap">
                  <span className="ac-name">
                    <Highlight text={p.name} query={query} />
                  </span>
                  <span className="cat-pill">{p.category}</span>
                </span>
                <span className="ac-price">{p.price}</span>
              </button>
              {i < products.length - 1 && <div className="ac-sep" />}
            </div>
          ))}
        </>
      )}

      {/* SECTION B — trending */}
      <div className="ac-trending">
        <div className="ac-section-header" style={{ padding: "0 0 0" }}>
          Trending
        </div>
        <div className="ac-pills">
          {TRENDING_SEARCHES.map((t) => (
            <button key={t} type="button" className="pill" onClick={() => onTrending(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION C — AI prompt */}
      <div className="ac-footer">
        <span className="ac-footer-left">
          <Sparkles size={14} strokeWidth={1.5} />
          Press Enter to extract full requirements with AI
        </span>
        <span className="ac-enter">↵</span>
      </div>
    </div>
  );
}
