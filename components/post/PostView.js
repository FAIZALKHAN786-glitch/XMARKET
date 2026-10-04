"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Lock, Loader2 } from "lucide-react";
import AppShell from "../AppShell";
import Autocomplete from "./Autocomplete";
import RequirementBuilder from "./RequirementBuilder";
import AIExtractPanel from "./AIExtractPanel";
import { fetchSuggestions, extractRequirement, postRequirement } from "@/lib/api";

const MAX_LEN = 500;

export default function PostView() {
  const router = useRouter();
  const inputRef = useRef(null);
  const acRef = useRef(null);

  const [query, setQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [acOpen, setAcOpen] = useState(false);
  const [acClosing, setAcClosing] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    budget: [0, 500],
    condition: "Any",
    deadline: null,
    qty: 1,
    location: "",
    notes: "",
  });

  const acVisible = query.trim().length >= 2;

  /* ⌘K / Ctrl+K focuses the command input from anywhere */
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Close the dropdown on outside click */
  useEffect(() => {
    const onDown = (e) => {
      if (acRef.current && !acRef.current.contains(e.target)) closeAc();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* TODO: GET /api/products/suggest?q={query} (debounced 250ms) */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setProducts([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetchSuggestions(q);
      setProducts(res);
      setActiveIdx(-1);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  /* TODO: POST /api/ai/extract { rawText } — debounced 800ms after typing stops.
     Response: { category, budget, deadline, preferences, confidence } */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setAiData(null);
      return;
    }
    setAiLoading(true);
    const t = setTimeout(async () => {
      const data = await extractRequirement(q);
      setAiData(data);
      setAiLoading(false);
    }, 800);
    return () => clearTimeout(t);
  }, [query]);

  const closeAc = useCallback(() => {
    setAcClosing(true);
    setTimeout(() => {
      setAcClosing(false);
      setAcOpen(false);
    }, 150);
  }, []);

  const runExtraction = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setBuilderOpen(true);
    setAiLoading(true);
    const data = await extractRequirement(q);
    setAiData(data);
    setAiLoading(false);
  }, [query]);

  const pickProduct = (p) => {
    setQuery(p.name);
    closeAc();
    setTimeout(runExtraction, 0);
  };

  const onTrending = (t) => {
    setQuery(t);
    inputRef.current?.focus();
  };

  const onInputKeyDown = (e) => {
    if (e.key === "Escape") {
      closeAc();
      return;
    }
    if (e.key === "ArrowDown" && acVisible) {
      e.preventDefault();
      setAcOpen(true);
      setActiveIdx((i) => Math.min(i + 1, products.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && acVisible) {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (acOpen && activeIdx >= 0 && products[activeIdx]) {
        pickProduct(products[activeIdx]);
      } else {
        closeAc();
        // TODO: POST /api/ai/extract { rawText } on Enter
        runExtraction();
      }
    }
  };

  const submit = async () => {
    if (!query.trim()) {
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    // TODO: POST /api/requirements { rawText, structured }
    await postRequirement({ rawText: query, structured: { ...form, ai: aiData } });
    router.push("/matches");
  };

  const charClass =
    query.length > 480 ? "hot" : query.length > 400 ? "warn" : "";

  return (
    <AppShell>
      <main className="post-page">
        {/* SECTION 1 — hero */}
        <h1 className="post-hero-title">What do you need?</h1>
        <p className="post-hero-sub">
          Describe it in plain language. Our AI handles the rest.
        </p>

        <div className="post-layout">
          <div className="post-main">
            {/* SECTION 2 — command input */}
            <div className="ac-wrap" ref={acRef}>
              <div className="glass cmd">
                <div className="cmd-row">
                  <span className="cmd-icon">
                    <Sparkles size={18} strokeWidth={1.5} />
                  </span>
                  <input
                    ref={inputRef}
                    className="cmd-input"
                    type="text"
                    maxLength={MAX_LEN}
                    placeholder="e.g. Nokia 3310 under $50, delivered in 3 days…"
                    value={query}
                    aria-label="Describe what you need"
                    aria-autocomplete="list"
                    aria-expanded={acOpen && acVisible}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (e.target.value.trim().length >= 2) setAcOpen(true);
                    }}
                    onFocus={() => {
                      if (query.trim().length >= 2) setAcOpen(true);
                    }}
                    onKeyDown={onInputKeyDown}
                  />
                  <div className="cmd-meta">
                    <span className={`char-count ${charClass}`} aria-live="polite">
                      {query.length} / {MAX_LEN}
                    </span>
                    <span className="kbd" aria-hidden="true">
                      ⌘K
                    </span>
                  </div>
                </div>
              </div>

              {acOpen && acVisible && (
                <Autocomplete
                  query={query}
                  products={products}
                  activeIdx={activeIdx}
                  closing={acClosing}
                  onPick={pickProduct}
                  onTrending={onTrending}
                />
              )}
            </div>

            {/* SECTION 3 — requirement builder (slides down) */}
            <RequirementBuilder open={builderOpen} state={form} setState={setForm} />

            {/* SUBMIT ROW */}
            {builderOpen && (
              <div className="submit-row">
                {/* TODO: Save draft → POST /api/requirements { draft: true } */}
                <button type="button" className="btn-ghost submit-save">
                  Save as Draft
                </button>
                <div className="submit-right">
                  <button
                    type="button"
                    className={`btn-primary submit-post ${submitting ? "is-loading" : ""}`}
                    onClick={submit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 size={16} strokeWidth={1.5} className="spin" style={{ color: "#000000" }} />
                    ) : (
                      "Post Requirement & Find Matches →"
                    )}
                  </button>
                  <span className="submit-note">
                    <Lock size={11} strokeWidth={1.5} />
                    Your requirement is private until you choose to share.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* AI EXTRACTION PANEL */}
          <AIExtractPanel
            data={aiData}
            loading={aiLoading}
            visible={acVisible}
          />
        </div>
      </main>
    </AppShell>
  );
}
