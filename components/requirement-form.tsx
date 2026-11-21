"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Card, CategorySelect, Input, TextArea } from "./ui";
import type { CategoryId } from "@/lib/types";

export type Enhanced = {
  title: string; summary: string; description: string; tags: string[]; mustHaves: string[];
};

/** Mock "ML model": heuristic text → structured requirement fields. */
export function mockEnhanceRequirement(raw: string): Enhanced {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  const title = (lines[0] || "Requirement").slice(0, 137);
  const summaryLine = lines.find((l) => /^summary:/i.test(l));
  const summary = summaryLine?.replace(/^summary:/i, "").trim().slice(0, 240) || "";
  const tags: string[] = [];
  const mustHaves: string[] = [];
  const description: string[] = [];

  lines.forEach((line, index) => {
    if (index === 0 || line === summaryLine) return;
    const lower = line.toLowerCase();
    if (/^tags?:|^#/.test(lower)) {
      line.replace(/^tags?:\s*/i, "").split(/[,#]/).forEach((t) => {
        const tag = t.trim();
        if (tag && tag.length <= 48 && tags.length < 12 && !tags.includes(tag)) tags.push(tag);
      });
      return;
    }
    if (/^must[- ]?haves?:|^need|^must/.test(lower)) {
      mustHaves.push(line.replace(/^must[- ]?haves?:\s*/i, "").trim().slice(0, 160));
      return;
    }
    description.push(line);
  });

  return {
    title,
    summary: summary || `${title.slice(0, 80)} — scope and deliverables to be agreed with the provider.`,
    description: description.join(" ") || raw.trim() || "Describe the project scope here.",
    tags: tags.length ? tags : ["general"],
    mustHaves,
  };
}

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

export function RequirementForm({ onSuccess }: { onSuccess: () => void }) {
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CategoryId>("software");
  const [budgetMax, setBudgetMax] = useState("");
  const [budgetTarget, setBudgetTarget] = useState("");
  const [deadline, setDeadline] = useState(plusDays(45));
  const [closesAt, setClosesAt] = useState(plusDays(10));
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState("");
  const [mustHaves, setMustHaves] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [enhanced, setEnhanced] = useState(false);

  const enhance = () => {
    const result = mockEnhanceRequirement(notes);
    setTitle(result.title);
    setSummary(result.summary);
    setDescription(result.description);
    setTags(result.tags.join(", "));
    setMustHaves(result.mustHaves.join("\n"));
    setEnhanced(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (Number(budgetTarget) > Number(budgetMax)) {
      setError("Target budget cannot be higher than the maximum budget.");
      return;
    }
    setSubmitting(true);
    try {
      const r = await api("/api/requirements", {
        method: "POST",
        body: JSON.stringify({
          title, summary, description, category,
          budgetMax: Number(budgetMax), budgetTarget: Number(budgetTarget),
          deadline: new Date(deadline).toISOString(), closesAt: new Date(closesAt).toISOString(),
          location,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          mustHaves: mustHaves.split("\n").map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (r.ok) onSuccess();
      else setError(r.error?.message || "Failed to post requirement");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mt-8 fade-up">
      <form onSubmit={submit} className="form-stack">
        <div className="p-4 rounded-xl" style={{ background: "#f4f4ee", border: "1px dashed #d0d0c7" }}>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>Mock ML formatter</p>
              <p className="field-hint mt-1 mb-0">Drop rough notes here — first line is the title, use “Summary:”, “#tag” and “Must-have:”.</p>
            </div>
            <Button tone="outline" onClick={enhance} type="button" disabled={!notes.trim()}>
              ✨ Enhance with AI format
            </Button>
          </div>
          <TextArea
            className="bg-white"
            rows={3}
            placeholder={"Precision aluminium housings\nSummary: 500-unit pilot with tight motor mounts\n#CNC #Anodising #ISO9001\nMust-have: CMM report per batch"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-label="Rough requirement notes"
          />
          {enhanced && <p className="field-hint">Fields below were filled from your notes. Edit anything before posting.</p>}
        </div>

        {error && <div className="error-box" role="alert">{error}</div>}

        <div>
          <label className="field-label" htmlFor="title">Title</label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={8} maxLength={140} placeholder="e.g. Precision aluminium housings — 500 unit pilot" />
        </div>
        <div>
          <label className="field-label" htmlFor="summary">Summary</label>
          <Input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} required minLength={10} maxLength={240} placeholder="Brief overview of what you need" />
        </div>
        <div>
          <label className="field-label" htmlFor="description">Description</label>
          <TextArea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required minLength={10} maxLength={6000} rows={4} placeholder="Describe the project scope, deliverables and constraints…" />
        </div>

        <div className="form-grid">
          <div>
            <label className="field-label" htmlFor="category">Category</label>
            <CategorySelect value={category} onChange={setCategory} />
          </div>
          <div>
            <label className="field-label" htmlFor="location">Location</label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} required maxLength={120} placeholder="e.g. New York, NY or Remote" />
          </div>
        </div>

        <div className="form-grid">
          <div>
            <label className="field-label" htmlFor="budgetMax">Max budget ($)</label>
            <Input id="budgetMax" type="number" min={1} max={100000000} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} required placeholder="96000" />
          </div>
          <div>
            <label className="field-label" htmlFor="budgetTarget">Target budget ($)</label>
            <Input id="budgetTarget" type="number" min={1} max={100000000} value={budgetTarget} onChange={(e) => setBudgetTarget(e.target.value)} required placeholder="78000" />
          </div>
        </div>

        <div className="form-grid">
          <div>
            <label className="field-label" htmlFor="deadline">Delivery deadline</label>
            <Input id="deadline" type="date" min={today()} value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
          </div>
          <div>
            <label className="field-label" htmlFor="closesAt">Bidding closes</label>
            <Input id="closesAt" type="date" min={today()} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="tags">Tags (comma-separated)</label>
          <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. React, API, Accessibility" />
        </div>
        <div>
          <label className="field-label" htmlFor="mustHaves">Must-haves (one per line)</label>
          <TextArea id="mustHaves" rows={3} value={mustHaves} onChange={(e) => setMustHaves(e.target.value)} placeholder={"ISO 9001 certified\nDeliver within 30 days"} />
        </div>

        <Button type="submit" disabled={submitting} className="btn-wide btn-lg">
          {submitting ? "Posting…" : "Post requirement →"}
        </Button>
      </form>
    </Card>
  );
}
