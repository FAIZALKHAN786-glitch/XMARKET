"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Truck,
  ChevronDown,
  Heart,
  Check,
} from "lucide-react";

export default function OfferCard({
  offer,
  shortlisted,
  selected,
  onShortlist,
  onSelect,
}) {
  const [whyOpen, setWhyOpen] = useState(false);

  return (
    <article className="glass offer-card" aria-label={`Offer from ${offer.provider}`}>
      {/* TOP ROW — score + provider */}
      <div className="offer-top">
        <div className="score-circle" aria-label={`${offer.score} percent match`}>
          <span className="score-num">
            {offer.score}
            <span className="pct">%</span>
          </span>
          <span className="score-label">MATCH</span>
        </div>
        <div className="provider-info">
          <div className="provider-name">{offer.provider}</div>
          <div className="provider-trust">
            <ShieldCheck size={12} strokeWidth={1.5} />
            Verified
          </div>
        </div>
      </div>

      {/* PRICE */}
      <div className="price-row">
        <span className="price-main">${offer.price.toFixed(2)}</span>
        <span className="price-cur">USD</span>
      </div>

      {/* DELIVERY */}
      <span className="delivery-pill">
        <Truck size={12} strokeWidth={1.5} />
        Delivers in {offer.deliveryDays} days
      </span>

      <div className="card-sep" />

      {/* WHY THIS MATCH — expandable */}
      {/* TODO: POST /api/ai/explain { offerId, requirementId } */}
      <div>
        <button
          type="button"
          className={`why-toggle ${whyOpen ? "open" : ""}`}
          aria-expanded={whyOpen}
          aria-controls={`why-${offer.id}`}
          onClick={() => setWhyOpen((v) => !v)}
        >
          Why this match?
          <ChevronDown size={14} strokeWidth={1.5} />
        </button>
        <div id={`why-${offer.id}`} className={`why-body-outer ${whyOpen ? "open" : ""}`}>
          <div className="why-body-inner">
            <p className="why-text">{offer.why}</p>
          </div>
        </div>
      </div>

      {/* TRADE-OFF TAGS */}
      <div className="tradeoff-tags">
        {offer.tags.map((t) => (
          <span key={t.text} className={`tag ${t.type === "pos" ? "tag--pos" : "tag--warn"}`}>
            {t.type === "pos" ? "✓" : "⚠"} {t.text}
          </span>
        ))}
      </div>

      {/* ACTIONS */}
      <div className="card-actions">
        {/* TODO: PATCH /api/offers/{id}/shortlist */}
        <button
          type="button"
          className={`btn-shortlist ${shortlisted ? "active" : ""}`}
          aria-pressed={shortlisted}
          onClick={() => onShortlist(offer)}
        >
          <Heart
            size={14}
            strokeWidth={1.5}
            fill={shortlisted ? "currentColor" : "none"}
          />
          Shortlist
        </button>
        {/* TODO: PATCH /api/offers/{id}/select */}
        <button
          type="button"
          className="btn-select"
          disabled={selected}
          onClick={() => onSelect(offer)}
        >
          <Check size={14} strokeWidth={1.5} />
          {selected ? "Selected" : "Select Offer"}
        </button>
      </div>
    </article>
  );
}
