"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

/* Monochrome glass calendar dropdown. Past dates are disabled. */
export default function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const prevDisabled =
    year === today.getFullYear() && month === today.getMonth();

  return (
    <div className="date-wrap" ref={ref}>
      <button
        type="button"
        id="deadline-btn"
        className={`input date-btn ${!value ? "is-placeholder" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {value ? fmt(new Date(value)) : "Select date"}
      </button>
      <span className="input-icon-right">
        <Calendar size={16} strokeWidth={1.5} />
      </span>

      {open && (
        <div className="glass calendar-pop" role="dialog" aria-label="Choose deadline date">
          <div className="cal-head">
            <button
              type="button"
              className="cal-navbtn"
              aria-label="Previous month"
              disabled={prevDisabled}
              onClick={() => setView(new Date(year, month - 1, 1))}
            >
              <ChevronLeft size={16} strokeWidth={1.5} />
            </button>
            <span className="cal-title">
              {view.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              className="cal-navbtn"
              aria-label="Next month"
              onClick={() => setView(new Date(year, month + 1, 1))}
            >
              <ChevronRight size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="cal-weekdays">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <span key={i} className="cal-wd" aria-hidden="true">
                {d}
              </span>
            ))}
          </div>

          <div className="cal-days">
            {cells.map((d, i) =>
              d === null ? (
                <span key={`b${i}`} className="cal-day blank" />
              ) : (
                <button
                  key={d.toISOString()}
                  type="button"
                  className={[
                    "cal-day",
                    d < today ? "disabled" : "",
                    value && d.getTime() === new Date(value).getTime() ? "selected" : "",
                    d.getTime() === today.getTime() ? "today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={fmt(d)}
                  onClick={() => {
                    onChange(d.toISOString());
                    setOpen(false);
                  }}
                >
                  {d.getDate()}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
