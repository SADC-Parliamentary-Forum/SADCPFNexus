"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { riskApi } from "@/lib/api";
import axios from "axios";

const CATEGORIES = [
  { value: "strategic",    label: "Strategic",    icon: "flag"           },
  { value: "operational",  label: "Operational",  icon: "settings"       },
  { value: "financial",    label: "Financial",    icon: "payments"       },
  { value: "compliance",   label: "Compliance",   icon: "gavel"          },
  { value: "reputational", label: "Reputational", icon: "verified_user"  },
  { value: "security",     label: "Security",     icon: "security"       },
  { value: "other",        label: "Other",        icon: "more_horiz"     },
];

const LIKELIHOODS = [
  { value: 1, label: "Rare",      desc: "May occur in exceptional circumstances" },
  { value: 2, label: "Unlikely",  desc: "Could occur at some time"               },
  { value: 3, label: "Possible",  desc: "Might occur at some time"               },
  { value: 4, label: "Likely",    desc: "Will probably occur in most circumstances" },
  { value: 5, label: "Almost Certain", desc: "Is expected to occur in most circumstances" },
];

const IMPACTS = [
  { value: 1, label: "Insignificant", desc: "No significant impact"               },
  { value: 2, label: "Minor",         desc: "Minor short-term impact"             },
  { value: 3, label: "Moderate",      desc: "Moderate impact, manageable"         },
  { value: 4, label: "Major",         desc: "Significant operational impact"      },
  { value: 5, label: "Catastrophic",  desc: "Severe, long-term consequences"      },
];

const FREQUENCIES = [
  { value: "monthly",    label: "Monthly"     },
  { value: "quarterly",  label: "Quarterly"   },
  { value: "bi_annual",  label: "Bi-Annual"   },
  { value: "annual",     label: "Annual"      },
];

function riskLevelFromScore(s: number): { label: string; cls: string } {
  if (s >= 16) return { label: "Critical", cls: "text-red-700 bg-red-100 border-red-300"       };
  if (s >= 11) return { label: "High",     cls: "text-orange-700 bg-orange-100 border-orange-300" };
  if (s >= 6)  return { label: "Medium",   cls: "text-yellow-700 bg-yellow-100 border-yellow-300" };
  return         { label: "Low",      cls: "text-green-700 bg-green-100 border-green-300"   };
}

export default function CreateRiskPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    likelihood: 0,
    impact: 0,
    review_frequency: "",
    next_review_date: "",
  });
  const [saving, setSaving]   = useState(false);
  const [errors, setErrors]   = useState<Record<string, string[]>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const score = form.likelihood * form.impact;
  const level = score > 0 ? riskLevelFromScore(score) : null;

  function set(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }

  async function handleSubmit(e: React.FormEvent, andSubmit = false) {
    e.preventDefault();
    setSaving(true);
    setApiError(null);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!form.review_frequency) delete payload.review_frequency;
      if (!form.next_review_date) delete payload.next_review_date;

      const res = await riskApi.create(payload as any);
      const created = res.data.data;

      if (andSubmit) {
        await riskApi.submit(created.id);
      }
      router.push(`/risk/${created.id}`);
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 422) {
        setErrors(e.response.data.errors ?? {});
      } else {
        setApiError(axios.isAxiosError(e) ? e.response?.data?.message ?? "An error occurred." : "An error occurred.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/risk" className="hover:text-primary">Risk Register</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-800 font-medium">Log New Risk</span>
      </div>

      <div>
        <h1 className="page-title">Log New Risk</h1>
        <p className="page-subtitle">Document a risk for institutional review and mitigation planning.</p>
      </div>

      {apiError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {apiError}
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Risk Title <span className="text-red-500">*</span>
          </label>
          <input
            className={`form-input w-full ${errors.title ? "border-red-400" : ""}`}
            placeholder="e.g. Inadequate budget controls"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
          {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title[0]}</p>}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            className={`form-input w-full h-28 resize-none ${errors.description ? "border-red-400" : ""}`}
            placeholder="Describe the risk in detail — its nature, potential triggers, and likely consequences…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
          {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description[0]}</p>}
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Category <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.value}
                onClick={() => set("category", c.value)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all ${
                  form.category === c.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                <span className={`material-symbols-outlined text-[15px] ${form.category === c.value ? "text-primary" : "text-neutral-400"}`}>{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
          {errors.category && <p className="text-xs text-red-600 mt-1">{errors.category[0]}</p>}
        </div>

        {/* Likelihood + Impact + Score */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Likelihood (1–5) <span className="text-red-500">*</span>
            </label>
            <div className="space-y-1.5">
              {LIKELIHOODS.map((l) => (
                <button
                  type="button"
                  key={l.value}
                  onClick={() => set("likelihood", l.value)}
                  className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-xs transition-all ${
                    form.likelihood === l.value
                      ? "border-primary bg-primary/5"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${form.likelihood === l.value ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>
                    {l.value}
                  </span>
                  <div className="text-left">
                    <p className="font-semibold text-neutral-800">{l.label}</p>
                    <p className="text-neutral-400 text-[10px]">{l.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {errors.likelihood && <p className="text-xs text-red-600 mt-1">{errors.likelihood[0]}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Impact (1–5) <span className="text-red-500">*</span>
            </label>
            <div className="space-y-1.5">
              {IMPACTS.map((im) => (
                <button
                  type="button"
                  key={im.value}
                  onClick={() => set("impact", im.value)}
                  className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-xs transition-all ${
                    form.impact === im.value
                      ? "border-primary bg-primary/5"
                      : "border-neutral-200 hover:border-neutral-300"
                  }`}
                >
                  <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${form.impact === im.value ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600"}`}>
                    {im.value}
                  </span>
                  <div className="text-left">
                    <p className="font-semibold text-neutral-800">{im.label}</p>
                    <p className="text-neutral-400 text-[10px]">{im.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {errors.impact && <p className="text-xs text-red-600 mt-1">{errors.impact[0]}</p>}
          </div>
        </div>

        {/* Score preview */}
        {score > 0 && level && (
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${level.cls}`}>
            <span className="material-symbols-outlined text-[20px]">analytics</span>
            <div>
              <p className="text-sm font-bold">Risk Score: {score} — {level.label}</p>
              <p className="text-xs opacity-80">Likelihood {form.likelihood} × Impact {form.impact}</p>
            </div>
          </div>
        )}

        {/* Review frequency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Review Frequency</label>
            <select
              className="form-input w-full"
              value={form.review_frequency}
              onChange={(e) => set("review_frequency", e.target.value)}
            >
              <option value="">Select…</option>
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Next Review Date</label>
            <input
              type="date"
              className="form-input w-full"
              value={form.next_review_date}
              onChange={(e) => set("next_review_date", e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Link href="/risk" className="btn-secondary flex-shrink-0">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn-secondary flex items-center gap-1.5"
          >
            {saving ? <span className="h-4 w-4 border-2 border-neutral-400 border-t-neutral-600 rounded-full animate-spin" /> : null}
            Save as Draft
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={(e) => handleSubmit(e, true)}
            className="btn-primary flex items-center gap-1.5 flex-1 justify-center"
          >
            {saving ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
              <span className="material-symbols-outlined text-[16px]">send</span>
            )}
            Save &amp; Submit for Review
          </button>
        </div>
      </form>
    </div>
  );
}
