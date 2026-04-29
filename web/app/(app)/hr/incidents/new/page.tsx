"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hrIncidentsApi } from "@/lib/api";

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = ["Mode & Severity", "Core Details", "Review & Submit"];

const MODES = [
  {
    id: "formal",
    label: "Formal Report",
    icon: "gavel",
    color: "text-red-600 bg-red-50 border-red-200",
    activeColor: "bg-red-600 text-white border-red-600",
    desc: "Official disciplinary or safety incident requiring HR review and formal documentation.",
  },
  {
    id: "informal",
    label: "Informal Notice",
    icon: "info",
    color: "text-amber-600 bg-amber-50 border-amber-200",
    activeColor: "bg-amber-500 text-white border-amber-500",
    desc: "Low-level concern or advisory note that does not require immediate disciplinary action.",
  },
  {
    id: "safety",
    label: "Safety / Health",
    icon: "health_and_safety",
    color: "text-blue-600 bg-blue-50 border-blue-200",
    activeColor: "bg-blue-600 text-white border-blue-600",
    desc: "Workplace safety incident, near-miss, or occupational health concern.",
  },
  {
    id: "it_security",
    label: "IT / Security",
    icon: "security",
    color: "text-purple-600 bg-purple-50 border-purple-200",
    activeColor: "bg-purple-600 text-white border-purple-600",
    desc: "Data breach, system access violation, or physical security incident.",
  },
];

const SEVERITIES = [
  { id: "low",    label: "Low",    icon: "arrow_downward", color: "text-green-700 bg-green-50 border-green-200",   activeColor: "bg-green-600 text-white border-green-600" },
  { id: "medium", label: "Medium", icon: "remove",         color: "text-amber-700 bg-amber-50 border-amber-200",   activeColor: "bg-amber-500 text-white border-amber-500" },
  { id: "high",   label: "High",   icon: "arrow_upward",   color: "text-red-700 bg-red-50 border-red-200",         activeColor: "bg-red-600 text-white border-red-600" },
];

export default function NewIncidentPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [mode, setMode] = useState("formal");
  const [severity, setSeverity] = useState<"low" | "medium" | "high">("medium");

  // Step 2
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [location, setLocation] = useState("");
  const [witnesses, setWitnesses] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);

  const canProceed = () => {
    if (step === 0) return !!mode && !!severity;
    if (step === 1) return subject.trim().length >= 5 && description.trim().length >= 10;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const modeLabel = MODES.find((m) => m.id === mode)?.label ?? mode;
      const fullSubject = `[${modeLabel}] ${subject.trim()}`;
      const fullDescription = [
        description.trim(),
        location ? `\n\nLocation: ${location}` : "",
        witnesses ? `\nWitnesses: ${witnesses}` : "",
      ].join("");

      await hrIncidentsApi.create({
        subject: fullSubject,
        description: fullDescription,
        severity,
      });

      router.push("/hr/incidents");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } }; message?: string };
      setError(ax.response?.data?.message ?? ax.message ?? "Failed to submit incident report.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedMode = MODES.find((m) => m.id === mode)!;
  const selectedSeverity = SEVERITIES.find((s) => s.id === severity)!;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/hr/incidents" className="text-neutral-400 hover:text-neutral-600 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="page-title">New Incident Report</h1>
          <p className="page-subtitle">Report a workplace incident, safety concern, or conduct issue.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                i < step ? "bg-green-600 text-white" : i === step ? "bg-primary text-white" : "bg-neutral-100 text-neutral-400"
              }`}>
                {i < step ? (
                  <span className="material-symbols-outlined text-[14px]">check</span>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${i === step ? "text-primary" : i < step ? "text-green-600" : "text-neutral-400"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-3 ${i < step ? "bg-green-600" : "bg-neutral-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0 — Mode & Severity */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
              </div>
              <h3 className="text-sm font-semibold text-neutral-900">Incident Mode</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MODES.map((m) => (
                <button key={m.id} type="button" onClick={() => setMode(m.id)}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${mode === m.id ? m.activeColor : "bg-white border-neutral-200 hover:border-neutral-300"}`}>
                  <span className={`material-symbols-outlined text-[22px] mt-0.5 ${mode === m.id ? "" : m.color.split(" ")[0]}`} style={{ fontVariationSettings: "'FILL' 1" }}>{m.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className={`text-xs mt-0.5 leading-relaxed ${mode === m.id ? "opacity-80" : "text-neutral-500"}`}>{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50">
                <span className="material-symbols-outlined text-red-600 text-[18px]">priority_high</span>
              </div>
              <h3 className="text-sm font-semibold text-neutral-900">Severity Level</h3>
            </div>
            <div className="flex gap-3">
              {SEVERITIES.map((s) => (
                <button key={s.id} type="button" onClick={() => setSeverity(s.id as "low" | "medium" | "high")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold text-sm transition-all ${severity === s.id ? s.activeColor : s.color + " hover:opacity-80"}`}>
                  <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 1 — Core Details */}
      {step === 1 && (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <span className="material-symbols-outlined text-amber-600 text-[18px]">edit_note</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">Incident Details</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Subject / Title <span className="text-red-500">*</span></label>
            <input
              className="form-input"
              placeholder="Brief description of what occurred…"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Detailed Description <span className="text-red-500">*</span></label>
            <textarea
              rows={5}
              className="form-input resize-none"
              placeholder="Describe the incident in full detail — what happened, how it happened, who was involved, and the immediate impact…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-neutral-400 mt-1">{description.length} characters — minimum 10</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Incident Date (if known)</label>
              <input type="date" className="form-input" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Location</label>
              <input className="form-input" placeholder="e.g. Office Block A, Floor 2" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Witnesses (optional)</label>
            <input className="form-input" placeholder="Names of witnesses, if any…" value={witnesses} onChange={(e) => setWitnesses(e.target.value)} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={isConfidential} onChange={(e) => setIsConfidential(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary" />
            <div>
              <p className="text-sm font-medium text-neutral-900">Mark as Confidential</p>
              <p className="text-xs text-neutral-400">Only HR administrators will be able to view this report.</p>
            </div>
          </label>
        </div>
      )}

      {/* Step 2 — Review & Submit */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
                <span className="material-symbols-outlined text-green-600 text-[18px]">checklist</span>
              </div>
              <h3 className="text-sm font-semibold text-neutral-900">Review Report</h3>
            </div>

            <div className="rounded-xl bg-neutral-50 border border-neutral-200 divide-y divide-neutral-200">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className={`material-symbols-outlined text-[18px] ${selectedMode.color.split(" ")[0]}`} style={{ fontVariationSettings: "'FILL' 1" }}>{selectedMode.icon}</span>
                <div className="flex-1">
                  <p className="text-xs text-neutral-500">Mode</p>
                  <p className="text-sm font-semibold text-neutral-900">{selectedMode.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <span className={`material-symbols-outlined text-[18px] ${selectedSeverity.color.split(" ")[0]}`}>{selectedSeverity.icon}</span>
                <div className="flex-1">
                  <p className="text-xs text-neutral-500">Severity</p>
                  <p className="text-sm font-semibold text-neutral-900">{selectedSeverity.label}</p>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-neutral-500 mb-1">Subject</p>
                <p className="text-sm font-semibold text-neutral-900">[{selectedMode.label}] {subject}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-neutral-500 mb-1">Description</p>
                <p className="text-sm text-neutral-700 whitespace-pre-wrap">{description}</p>
              </div>
              {(incidentDate || location) && (
                <div className="grid grid-cols-2 divide-x divide-neutral-200">
                  {incidentDate && (
                    <div className="px-4 py-3">
                      <p className="text-xs text-neutral-500">Incident Date</p>
                      <p className="text-sm font-medium text-neutral-900">{incidentDate}</p>
                    </div>
                  )}
                  {location && (
                    <div className="px-4 py-3">
                      <p className="text-xs text-neutral-500">Location</p>
                      <p className="text-sm font-medium text-neutral-900">{location}</p>
                    </div>
                  )}
                </div>
              )}
              {witnesses && (
                <div className="px-4 py-3">
                  <p className="text-xs text-neutral-500">Witnesses</p>
                  <p className="text-sm text-neutral-700">{witnesses}</p>
                </div>
              )}
              {isConfidential && (
                <div className="flex items-center gap-2 px-4 py-3 bg-amber-50">
                  <span className="material-symbols-outlined text-amber-600 text-[16px]">lock</span>
                  <p className="text-xs font-semibold text-amber-700">Marked as Confidential</p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        {step > 0 ? (
          <button type="button" onClick={() => setStep(step - 1)}
            className="btn-secondary px-5 py-2.5 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </button>
        ) : (
          <Link href="/hr/incidents" className="btn-secondary px-5 py-2.5 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">close</span>
            Cancel
          </Link>
        )}

        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => setStep(step + 1)} disabled={!canProceed()}
            className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40">
            Continue
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting}
            className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">send</span>
            {submitting ? "Submitting…" : "Submit Report"}
          </button>
        )}
      </div>
    </div>
  );
}
