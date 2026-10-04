"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";

/* ------------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg";
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh] sm:pt-[10vh]">
      <div
        className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "surface animate-rise relative w-full shadow-[0_40px_120px_-40px_rgba(0,0,0,1)]",
          size === "lg" ? "max-w-3xl" : "max-w-xl"
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/8 p-5">
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {description && (
              <p className="mt-1 text-[0.8125rem] muted">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-white/50 transition hover:bg-white/8 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="max-h-[62vh] overflow-y-auto p-5">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-white/8 p-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Toaster */

export function Toaster() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "animate-rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3.5 backdrop-blur-md",
            toast.tone === "success"
              ? "border-[var(--color-score-high)]/35 bg-[color-mix(in_oklab,var(--color-score-high)_12%,rgba(8,10,18,0.92))]"
              : toast.tone === "warn"
                ? "border-[var(--color-score-mid)]/35 bg-[color-mix(in_oklab,var(--color-score-mid)_12%,rgba(8,10,18,0.92))]"
                : "border-white/12 bg-ink-850/95"
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[0.8125rem] font-semibold text-white">
              {toast.title}
            </p>
            {toast.body && (
              <p className="mt-0.5 text-xs leading-relaxed muted">{toast.body}</p>
            )}
          </div>
          <button
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss"
            className="text-white/40 transition hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
