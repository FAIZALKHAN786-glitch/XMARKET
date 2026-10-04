"use client";

import { MapPin, Minus, Plus } from "lucide-react";
import DatePicker from "./DatePicker";

const BUDGET_MIN = 0;
const BUDGET_MAX = 10000;
const CONDITIONS = ["New", "Refurbished", "Any"];

/* Dual-thumb budget slider built from two overlaid native ranges. */
function BudgetSlider({ value, onChange }) {
  const [lo, hi] = value;
  const pct = (v) => ((v - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100;

  return (
    <div className="field-block">
      <span className="label label--form" id="budget-label">
        Budget range
      </span>
      <div className="budget-values" aria-hidden="true">
        <span className="budget-min">${lo}</span>
        <span className="budget-max">${hi >= BUDGET_MAX ? "10,000+" : hi}</span>
      </div>
      <div className="range-wrap" role="group" aria-labelledby="budget-label">
        <div className="range-track" />
        <div
          className="range-fill"
          style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
        />
        <input
          type="range"
          min={BUDGET_MIN}
          max={BUDGET_MAX}
          step={10}
          value={lo}
          aria-label="Minimum budget"
          onChange={(e) =>
            onChange([Math.min(Number(e.target.value), hi - 10), hi])
          }
        />
        <input
          type="range"
          min={BUDGET_MIN}
          max={BUDGET_MAX}
          step={10}
          value={hi}
          aria-label="Maximum budget"
          onChange={(e) =>
            onChange([lo, Math.max(Number(e.target.value), lo + 10)])
          }
        />
      </div>
      <span className="range-caption">$0 — $10,000+</span>
    </div>
  );
}

export default function RequirementBuilder({ open, state, setState }) {
  const set = (patch) => setState((s) => ({ ...s, ...patch }));

  return (
    <div className={`builder-outer ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="builder-inner">
        <div className="builder-grid">
          <div className="builder-title">Requirement Details</div>

          {/* ── LEFT COLUMN ── */}
          <div>
            <BudgetSlider
              value={state.budget}
              onChange={(budget) => set({ budget })}
            />

            <div className="field-block">
              <span className="label label--form" id="condition-label">
                Condition
              </span>
              <div
                className="seg"
                role="radiogroup"
                aria-labelledby="condition-label"
              >
                {CONDITIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={state.condition === c}
                    className={`seg-item ${state.condition === c ? "active" : ""}`}
                    onClick={() => set({ condition: c })}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-block">
              <label className="label label--form" htmlFor="deadline-btn">
                Deadline
              </label>
              <DatePicker
                value={state.deadline}
                onChange={(deadline) => set({ deadline })}
              />
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div>
            <div className="field-block">
              <span className="label label--form" id="qty-label">
                Quantity
              </span>
              <div className="stepper" role="group" aria-labelledby="qty-label">
                <button
                  type="button"
                  className="stepper-btn minus"
                  aria-label="Decrease quantity"
                  disabled={state.qty <= 1}
                  onClick={() => set({ qty: Math.max(1, state.qty - 1) })}
                >
                  <Minus size={16} strokeWidth={1.5} />
                </button>
                <span className="stepper-value" aria-live="polite">
                  {state.qty}
                </span>
                <button
                  type="button"
                  className="stepper-btn plus"
                  aria-label="Increase quantity"
                  onClick={() => set({ qty: state.qty + 1 })}
                >
                  <Plus size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <div className="field-block">
              <label className="label label--form" htmlFor="location">
                Delivery location
              </label>
              <div className="input-icon-wrap">
                <span className="input-icon-left">
                  <MapPin size={16} strokeWidth={1.5} />
                </span>
                <input
                  id="location"
                  className="input input--icon-left"
                  placeholder="City, State or ZIP"
                  value={state.location}
                  onChange={(e) => set({ location: e.target.value })}
                />
              </div>
            </div>

            <div className="field-block">
              <label className="label label--form" htmlFor="notes">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                className="input"
                placeholder="Any specific preferences, requirements, or constraints..."
                value={state.notes}
                onChange={(e) => set({ notes: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
