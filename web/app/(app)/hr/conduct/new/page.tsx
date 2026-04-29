"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { conductApi, tenantUsersApi, type TenantUserOption } from "@/lib/api";

const RECORD_TYPES = [
  { id: "commendation",          label: "Commendation",           icon: "stars",              color: "text-green-700 bg-green-50 border-green-200",   activeColor: "bg-green-600 text-white border-green-600" },
  { id: "verbal_counseling",     label: "Verbal Counseling",      icon: "record_voice_over",  color: "text-amber-700 bg-amber-50 border-amber-200",   activeColor: "bg-amber-500 text-white border-amber-500" },
  { id: "written_warning",       label: "Written Warning",        icon: "warning",            color: "text-orange-700 bg-orange-50 border-orange-200", activeColor: "bg-orange-500 text-white border-orange-500" },
  { id: "final_warning",         label: "Final Warning",          icon: "report",             color: "text-red-700 bg-red-50 border-red-200",         activeColor: "bg-red-600 text-white border-red-600" },
  { id: "performance_improvement", label: "Performance Improvement", icon: "trending_up",    color: "text-blue-700 bg-blue-50 border-blue-200",      activeColor: "bg-blue-600 text-white border-blue-600" },
  { id: "suspension",            label: "Suspension",             icon: "block",              color: "text-red-700 bg-red-50 border-red-200",         activeColor: "bg-red-600 text-white border-red-600" },
  { id: "dismissal",             label: "Dismissal",              icon: "person_off",         color: "text-neutral-700 bg-neutral-50 border-neutral-200", activeColor: "bg-neutral-800 text-white border-neutral-800" },
];

function UserAutocomplete({
  label, value, onSelect, required,
}: {
  label: string;
  value: TenantUserOption | null;
  onSelect: (u: TenantUserOption | null) => void;
  required?: boolean;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [options, setOptions] = useState<TenantUserOption[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || (value && query === value.name)) { setOptions([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await tenantUsersApi.list({ search: query });
        setOptions(r.data.data ?? []);
        setOpen(true);
      } catch { setOptions([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-semibold text-neutral-700 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input
        className="form-input"
        placeholder="Search by name or email…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); onSelect(null); }}
        autoComplete="off"
      />
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
          {options.slice(0, 6).map((u) => (
            <button key={u.id} type="button"
              className="w-full px-3 py-2.5 text-left hover:bg-neutral-50 flex items-center gap-2"
              onMouseDown={() => { onSelect(u); setQuery(u.name); setOpen(false); }}>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">{u.name[0]}</div>
              <div>
                <p className="text-sm font-medium text-neutral-900">{u.name}</p>
                <p className="text-xs text-neutral-400">{u.job_title ?? u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewConductRecordPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employee, setEmployee] = useState<TenantUserOption | null>(null);
  const [recordType, setRecordType] = useState("written_warning");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [incidentDate, setIncidentDate] = useState("");
  const [outcome, setOutcome] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);

  const canSubmit = employee && title.trim().length >= 3 && description.trim().length >= 5 && issueDate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setSubmitting(true);
    setError(null);
    try {
      await conductApi.create({
        employee_id: employee.id,
        record_type: recordType,
        title: title.trim(),
        description: description.trim(),
        issue_date: issueDate,
        incident_date: incidentDate || undefined,
        outcome: outcome || undefined,
        is_confidential: isConfidential,
      });
      router.push("/hr/conduct");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string };
      const msg = Object.values(ax.response?.data?.errors ?? {}).flat()[0] ?? ax.response?.data?.message ?? "Failed to create record.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = RECORD_TYPES.find((t) => t.id === recordType)!;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/hr/conduct" className="text-neutral-400 hover:text-neutral-600 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="page-title">New Conduct Record</h1>
          <p className="page-subtitle">Create a formal conduct, performance, or commendation record for a staff member.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Record Type selection */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">label</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">Record Type</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {RECORD_TYPES.map((t) => (
              <button key={t.id} type="button" onClick={() => setRecordType(t.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all text-sm font-medium ${recordType === t.id ? t.activeColor : "bg-white border-neutral-200 hover:border-neutral-300 text-neutral-700"}`}>
                <span className={`material-symbols-outlined text-[18px] ${recordType === t.id ? "" : t.color.split(" ")[0]}`} style={{ fontVariationSettings: "'FILL' 1" }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Employee & basic details */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${selectedType.color.split(" ").slice(1).join(" ")}`}>
              <span className={`material-symbols-outlined text-[18px] ${selectedType.color.split(" ")[0]}`} style={{ fontVariationSettings: "'FILL' 1" }}>{selectedType.icon}</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">Record Details</h3>
          </div>

          <UserAutocomplete label="Employee" value={employee} onSelect={setEmployee} required />

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input className="form-input" placeholder="Brief summary of this record…" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Description <span className="text-red-500">*</span></label>
            <textarea rows={5} className="form-input resize-none"
              placeholder="Detailed account of the conduct issue or commendation — include context, specific actions, dates, and impact…"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Issue Date <span className="text-red-500">*</span></label>
              <input type="date" className="form-input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Incident Date (if applicable)</label>
              <input type="date" className="form-input" value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Outcome / Decision (optional)</label>
            <input className="form-input" placeholder="e.g. First written warning issued; further action on recurrence" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={isConfidential} onChange={(e) => setIsConfidential(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary" />
            <div>
              <p className="text-sm font-medium text-neutral-900">Mark as Confidential</p>
              <p className="text-xs text-neutral-400">Only HR administrators and the reviewer will be able to view this record.</p>
            </div>
          </label>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-between">
          <Link href="/hr/conduct" className="btn-secondary px-5 py-2.5 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">close</span>
            Cancel
          </Link>
          <button type="submit" disabled={!canSubmit || submitting}
            className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">save</span>
            {submitting ? "Saving…" : "Create Record"}
          </button>
        </div>
      </form>
    </div>
  );
}
