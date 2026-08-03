"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
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
    strategic_objective_id: "",
    risk_owner_id: "",
    cause: "",
    event_description: "",
    consequence: "",
    register_scope: "department",
    is_confidential: false,
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
      if (!form.strategic_objective_id) delete payload.strategic_objective_id;
      else payload.strategic_objective_id = Number(form.strategic_objective_id);
      if (!form.risk_owner_id) delete payload.risk_owner_id;
      else payload.risk_owner_id = Number(form.risk_owner_id);
      if (!form.cause) delete payload.cause;
      if (!form.event_description) delete payload.event_description;
      if (!form.consequence) delete payload.consequence;

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

      <ModulePageHeader
        title="Log New Risk"
        subtitle="Document a risk for institutional review and mitigation planning."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Log New Risk" }]} />}
      />

      {apiError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {apiError}
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-5">

        {/* Title */}
        <div>
          <label htmlFor="risk-title" className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Risk Title <span className="text-red-500">*</span>
          </label>
          <input
            id="risk-title"
            className={`form-input w-full ${errors.title ? "border-red-400" : ""}`}
            placeholder="e.g. Inadequate budget controls"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
          {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title[0]}</p>}
        </div>

        {/* Description */}
        <div>
          <label htmlFor="risk-description" className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="risk-description"
            className={`form-input w-full h-28 resize-none ${errors.description ? "border-red-400" : ""}`}
            placeholder="Describe the risk in detail — its nature, potential triggers, and likely consequences…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
          {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description[0]}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="risk-strategic-objective-id" className="block text-xs font-semibold text-neutral-700 mb-1.5">Strategic objective ID</label>
            <input id="risk-strategic-objective-id" className="form-input w-full" value={form.strategic_objective_id} onChange={(e) => set("strategic_objective_id", e.target.value)} placeholder="Required before submit" />
            {errors.strategic_objective_id && <p className="text-xs text-red-600 mt-1">{errors.strategic_objective_id[0]}</p>}
          </div>
          <div>
            <label htmlFor="risk-owner-user-id" className="block text-xs font-semibold text-neutral-700 mb-1.5">Risk owner user ID</label>
            <input id="risk-owner-user-id" className="form-input w-full" value={form.risk_owner_id} onChange={(e) => set("risk_owner_id", e.target.value)} placeholder="Single accountable owner" />
            {errors.risk_owner_id && <p className="text-xs text-red-600 mt-1">{errors.risk_owner_id[0]}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label htmlFor="risk-cause" className="block text-xs font-semibold text-neutral-700 mb-1.5">Cause</label>
            <textarea id="risk-cause" className="form-input w-full h-16 resize-none" value={form.cause} onChange={(e) => set("cause", e.target.value)} />
          </div>
          <div>
            <label htmlFor="risk-event-description" className="block text-xs font-semibold text-neutral-700 mb-1.5">Event</label>
            <textarea id="risk-event-description" className="form-input w-full h-16 resize-none" value={form.event_description} onChange={(e) => set("event_description", e.target.value)} />
          </div>
          <div>
            <label htmlFor="risk-consequence" className="block text-xs font-semibold text-neutral-700 mb-1.5">Consequence</label>
            <textarea id="risk-consequence" className="form-input w-full h-16 resize-none" value={form.consequence} onChange={(e) => set("consequence", e.target.value)} />
          </div>
        </div>

        <label htmlFor="risk-is-confidential" className="flex items-center gap-2 text-sm">
          <input id="risk-is-confidential" type="checkbox" checked={form.is_confidential} onChange={(e) => setForm((p) => ({ ...p, is_confidential: e.target.checked }))} />
          Mark confidential (hidden from unprivileged search/dashboards)
        </label>

        {/* Category */}
        <fieldset className="min-w-0">
          <legend id="risk-category-label" className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Category <span className="text-red-500">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-labelledby="risk-category-label">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.value}
                role="radio"
                aria-checked={form.category === c.value}
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
        </fieldset>

        {/* Likelihood + Impact + Score */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <fieldset className="min-w-0">
            <legend id="risk-likelihood-label" className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Likelihood (1–5) <span className="text-red-500">*</span>
            </legend>
            <div className="space-y-1.5" role="radiogroup" aria-labelledby="risk-likelihood-label">
              {LIKELIHOODS.map((l) => (
                <button
                  type="button"
                  key={l.value}
                  role="radio"
                  aria-checked={form.likelihood === l.value}
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
          </fieldset>

          <fieldset className="min-w-0">
            <legend id="risk-impact-label" className="block text-xs font-semibold text-neutral-700 mb-1.5">
              Impact (1–5) <span className="text-red-500">*</span>
            </legend>
            <div className="space-y-1.5" role="radiogroup" aria-labelledby="risk-impact-label">
              {IMPACTS.map((im) => (
                <button
                  type="button"
                  key={im.value}
                  role="radio"
                  aria-checked={form.impact === im.value}
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
          </fieldset>
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
            <label htmlFor="risk-review-frequency" className="block text-xs font-semibold text-neutral-700 mb-1.5">Review Frequency</label>
            <select
              id="risk-review-frequency"
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
            <label htmlFor="risk-next-review-date" className="block text-xs font-semibold text-neutral-700 mb-1.5">Next Review Date</label>
            <input
              id="risk-next-review-date"
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
