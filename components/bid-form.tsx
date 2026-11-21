"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button, Card, Input, TextArea } from "./ui";

export function BidForm({ requirementId, onSuccess }: { requirementId: string; onSuccess: () => void }) {
  const [price, setPrice] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [pitch, setPitch] = useState("");
  const [coversTags, setCoversTags] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const r = await api(`/api/requirements/${requirementId}/bids`, {
        method: "POST",
        body: JSON.stringify({
          price: Number(price),
          deliveryDays: Number(deliveryDays),
          pitch,
          coversTags: coversTags.split(",").map((t) => t.trim()).filter(Boolean),
          milestones: [],
        }),
      });
      if (r.ok) onSuccess();
      else setError(r.error?.message || "Failed to submit bid");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mb-4">
      <p className="eyebrow">Your offer</p>
      <p className="card-title">Submit a bid</p>
      {error && <div className="error-box mt-4" role="alert">{error}</div>}
      <form onSubmit={submit} className="form-stack mt-5">
        <div className="form-grid">
          <div>
            <label className="field-label" htmlFor="bidPrice">Price ($)</label>
            <Input id="bidPrice" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div>
            <label className="field-label" htmlFor="bidDays">Delivery (days)</label>
            <Input id="bidDays" type="number" min={1} value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="bidPitch">Pitch</label>
          <TextArea id="bidPitch" rows={4} minLength={40} value={pitch} onChange={(e) => setPitch(e.target.value)} required placeholder="What makes your shop the right fit? Include process, capacity and proof." />
        </div>
        <div>
          <label className="field-label" htmlFor="bidTags">Tags you cover (comma-separated)</label>
          <Input id="bidTags" value={coversTags} onChange={(e) => setCoversTags(e.target.value)} placeholder="CNC, Anodising, ISO 9001" />
        </div>
        <Button type="submit" disabled={submitting} className="btn-wide">{submitting ? "Submitting…" : "Submit offer →"}</Button>
      </form>
    </Card>
  );
}
