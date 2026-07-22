"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { programmeApi } from "@/lib/api";
import { PIF_STRATEGIC_PILLARS, DEPARTMENTS } from "@/lib/constants";

const STRATEGIC_PILLARS = [...PIF_STRATEGIC_PILLARS] as string[];
const IMPLEMENTING_DEPARTMENTS = [...DEPARTMENTS] as string[];

// This page only collects the minimum needed to start a draft Programme
// Implementation Form (title, optionally pillar/department). Once the draft
// exists, the user is redirected to /pif/[id]/edit where the full set of
// sections (details, activities, budget, travel, procurement, media,
// documents) can be filled in and saved incrementally.
export default function PifCreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [strategicPillar, setStrategicPillar] = useState("");
  const [implementingDepartment, setImplementingDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Programme title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await programmeApi.create({
        title: title.trim(),
        strategic_pillar: strategicPillar || undefined,
        implementing_department: implementingDepartment || undefined,
      });
      const newId = (res.data as { data?: { id?: number }; id?: number }).data?.id
        ?? (res.data as { id?: number }).id;
      if (!newId) {
        throw new Error("Programme created but no id was returned.");
      }
      router.push(`/pif/${newId}/edit`);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg = ax.response?.data?.message
        ?? (ax.response?.data?.errors && Object.values(ax.response.data.errors).flat()[0])
        ?? "Failed to create programme. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/pif" className="hover:text-primary transition-colors">Programmes</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">New Programme Implementation Form</span>
      </div>

      <div>
        <h1 className="page-title">Start a Programme Implementation Form (PIF)</h1>
        <p className="page-subtitle">
          Give the programme a title to create a draft. You&apos;ll fill in the full details —
          objectives, activities, budget, travel, procurement and documents — on the next screen,
          and can save your progress at any time.
        </p>
      </div>

      <form onSubmit={handleCreate} className="card p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Programme Title<span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            className="form-input"
            placeholder="Short, descriptive title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Strategic Pillar</label>
            <select className="form-input" value={strategicPillar} onChange={(e) => setStrategicPillar(e.target.value)}>
              <option value="">— Select later —</option>
              {STRATEGIC_PILLARS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Implementing Department</label>
            <select className="form-input" value={implementingDepartment} onChange={(e) => setImplementingDepartment(e.target.value)}>
              <option value="">— Select later —</option>
              {IMPLEMENTING_DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <button type="submit" disabled={!canSubmit} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-50">
            {submitting ? (
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            )}
            {submitting ? "Creating…" : "Create Draft & Continue"}
          </button>
          <Link href="/pif" className="btn-secondary px-4 py-2.5 text-sm">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
