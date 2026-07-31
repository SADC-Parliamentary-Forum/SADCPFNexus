"use client";

import { useState } from "react";
import Link from "next/link";
import { riskApi } from "@/lib/api";

export default function RiskControlsPage() {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function createControl(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      await riskApi.createControl({ title, control_type: "preventive", effectiveness: "partial" });
      setTitle("");
      setOk("Control created. Link it from a risk detail page.");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to create control");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="text-sm text-muted-foreground">
        <Link href="/risk" className="hover:text-primary">Risk Register</Link>
        <span className="mx-2">/</span>
        <span>Controls</span>
      </div>
      <h1 className="page-title">Control Register</h1>
      <p className="page-subtitle">Phase 1 control catalogue. Effectiveness informs residual judgment — it never auto-computes residual scores.</p>
      <form onSubmit={createControl} className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium">New control title</label>
          <input className="form-input w-full mt-1" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <button type="submit" className="btn-primary">Add control</button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-green-700">{ok}</p>}
    </div>
  );
}
