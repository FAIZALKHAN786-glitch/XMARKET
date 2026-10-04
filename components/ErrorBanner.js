"use client";

import { useState } from "react";
import { AlertCircle, X } from "lucide-react";

/* Inline, non-modal error banner. */
export default function ErrorBanner({ title, message }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="error-banner" role="alert">
      <AlertCircle size={16} strokeWidth={1.5} />
      <div className="error-banner-body">
        <div className="error-banner-title">{title}</div>
        {message && <div className="error-banner-msg">{message}</div>}
      </div>
      <button
        type="button"
        className="error-banner-dismiss"
        aria-label="Dismiss error"
        onClick={() => setDismissed(true)}
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
