"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import ErrorBanner from "../ErrorBanner";
import { submitOffer } from "@/lib/api";

const DELIVERY_OPTIONS = ["1–3 days", "4–7 days", "8–14 days", "Custom"];

export default function OfferModal({ requirement, onClose, onSubmitted }) {
  const [price, setPrice] = useState("");
  const [delivery, setDelivery] = useState(DELIVERY_OPTIONS[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  // Escape closes the modal
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    const value = parseFloat(price);
    if (!price || Number.isNaN(value) || value <= 0) {
      setError({
        title: "Price required",
        message: "Enter the amount you'll fulfill this requirement for.",
      });
      return;
    }
    setError(null);
    setSending(true);
    // TODO: POST /api/offers { requirementId, price, deliveryDays, notes }
    await submitOffer({
      requirementId: requirement.id,
      price: value,
      delivery,
      notes,
    });
    onSubmitted({
      requirement: requirement.title,
      price: value,
      delivery,
      submitted: "Just now",
      status: "Pending",
    });
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-modal-title"
      >
        <div className="modal-head">
          <h2 className="modal-title" id="offer-modal-title">
            Submit an Offer
          </h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="glass modal-summary">
          {requirement.title} · Budget {requirement.budgetMax > 0 ? `$${requirement.budgetMax}` : requirement.budget} · {requirement.deadline} delivery
        </div>

        {error && (
          <div style={{ marginBottom: 16 }}>
            <ErrorBanner title={error.title} message={error.message} />
          </div>
        )}

        <div className="field-block">
          <label className="label label--form" htmlFor="offer-price">
            Your price
          </label>
          <div className="price-wrap">
            <span className="price-prefix" aria-hidden="true">$</span>
            <input
              id="offer-price"
              className="input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-describedby={error ? "offer-price-error" : undefined}
            />
          </div>
        </div>

        <div className="field-block">
          <span className="label label--form" id="delivery-label">
            Delivery time
          </span>
          <div className="seg seg--4" role="radiogroup" aria-labelledby="delivery-label">
            {DELIVERY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={delivery === d}
                className={`seg-item ${delivery === d ? "active" : ""}`}
                onClick={() => setDelivery(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="field-block">
          <label className="label label--form" htmlFor="offer-notes">
            Offer notes
          </label>
          <textarea
            id="offer-notes"
            className="input"
            rows={3}
            placeholder="Warranty, condition details, shipping method…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-ghost modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn-primary modal-submit ${sending ? "is-loading" : ""}`}
            disabled={sending}
            onClick={submit}
          >
            {sending ? (
              <Loader2 size={14} strokeWidth={1.5} className="spin" style={{ color: "#000000" }} />
            ) : (
              "Submit Offer →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
