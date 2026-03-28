"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { researcherReportsApi, deploymentsApi, type StaffDeployment, type ResearcherReportActivity } from "@/lib/api";

const DOCUMENT_TYPES = [
  "Monthly Report",
  "Quarterly Report",
  "Field Notes",
  "Meeting Minutes",
  "Supporting Evidence",
  "Photo Documentation",
  "Other",
];

interface PendingFile {
  id: string;
  file: File;
  document_type: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function NewReportPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deployments, setDeployments]     = useState<StaffDeployment[]>([]);
  const [saving, setSaving]               = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError]                 = useState<string | null>(null);
  const [pendingFiles, setPendingFiles]   = useState<PendingFile[]>([]);
  const [dragging, setDragging]           = useState(false);

  const [activities, setActivities] = useState<ResearcherReportActivity[]>([
    { title: "", description: "", date: "", outcome: "" },
  ]);

  const [form, setForm] = useState({
    deployment_id:     searchParams.get("deployment_id") ?? "" as string | number,
    report_type:       "monthly",
    period_start:      "",
    period_end:        "",
    title:             "",
    executive_summary: "",
    challenges_faced:  "",
    recommendations:   "",
    next_period_plan:  "",
  });

  useEffect(() => {
    deploymentsApi.list({ status: "active", per_page: 50 }).then((res) => {
      setDeployments(res.data.data ?? []);
    });
  }, []);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateActivity = (i: number, field: keyof ResearcherReportActivity, value: string) => {
    setActivities((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const addActivity = () =>
    setActivities((prev) => [...prev, { title: "", description: "", date: "", outcome: "" }]);

  const removeActivity = (i: number) =>
    setActivities((prev) => prev.filter((_, idx) => idx !== i));

  function addFiles(files: FileList | null) {
    if (!files) return;
    const newEntries: PendingFile[] = Array.from(files).map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
      file: f,
      document_type: "Supporting Evidence",
    }));
    setPendingFiles((prev) => [...prev, ...newEntries]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(id: string) {
    setPendingFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function setFileDocType(id: string, document_type: string) {
    setPendingFiles((prev) => prev.map((f) => f.id === id ? { ...f, document_type } : f));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const filledActivities = activities.filter((a) => a.title.trim());
      const { data: created } = await researcherReportsApi.create({
        deployment_id:         Number(form.deployment_id),
        report_type:           form.report_type,
        period_start:          form.period_start,
        period_end:            form.period_end,
        title:                 form.title,
        executive_summary:     form.executive_summary || undefined,
        activities_undertaken: filledActivities.length ? filledActivities : undefined,
        challenges_faced:      form.challenges_faced || undefined,
        recommendations:       form.recommendations || undefined,
        next_period_plan:      form.next_period_plan || undefined,
      });

      // Upload attachments sequentially
      if (pendingFiles.length > 0) {
        const reportId = created.data.id;
        setUploadProgress({ done: 0, total: pendingFiles.length });
        for (let i = 0; i < pendingFiles.length; i++) {
          const pf = pendingFiles[i];
          try {
            await researcherReportsApi.uploadAttachment(reportId, pf.file, pf.document_type);
          } catch {
            // Non-fatal: continue uploading remaining files
          }
          setUploadProgress({ done: i + 1, total: pendingFiles.length });
        }
      }

      router.push("/srhr/reports");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msgs = e.response?.data?.errors
        ? Object.values(e.response.data.errors).flat().join("; ")
        : (e.response?.data?.message ?? "Failed to save report.");
      setError(msgs);
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/srhr" className="hover:text-primary">SRHR</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/srhr/reports" className="hover:text-primary">Reports</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-800 font-medium">New Report</span>
      </div>

      <div>
        <h1 className="page-title">Submit Activity Report</h1>
        <p className="page-subtitle">Document your activities, findings, and plans for the reporting period.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Report metadata */}
        <div className="card p-6 space-y-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Report Details</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Deployment <span className="text-red-500">*</span></label>
              <select className="form-input" value={form.deployment_id} onChange={(e) => set("deployment_id", e.target.value)} required>
                <option value="">Select deployment…</option>
                {deployments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.employee?.name} → {d.parliament?.name} ({d.reference_number})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Report Type</label>
              <select className="form-input" value={form.report_type} onChange={(e) => set("report_type", e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="ad_hoc">Ad Hoc</option>
              </select>
            </div>
            <div />
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Period Start <span className="text-red-500">*</span></label>
              <input type="date" className="form-input" value={form.period_start} onChange={(e) => set("period_start", e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Period End <span className="text-red-500">*</span></label>
              <input type="date" className="form-input" value={form.period_end} onChange={(e) => set("period_end", e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Report Title <span className="text-red-500">*</span></label>
              <input className="form-input" placeholder="e.g. February 2026 Monthly Activity Report" value={form.title} onChange={(e) => set("title", e.target.value)} required />
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="card p-6 space-y-3">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Executive Summary</p>
          <textarea
            className="form-input"
            rows={4}
            placeholder="Provide a brief overview of the key highlights of the reporting period…"
            value={form.executive_summary}
            onChange={(e) => set("executive_summary", e.target.value)}
          />
        </div>

        {/* Activities */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Activities Undertaken</p>
            <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={addActivity}>
              + Add Activity
            </button>
          </div>
          {activities.map((act, i) => (
            <div key={i} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-600">Activity {i + 1}</p>
                {activities.length > 1 && (
                  <button type="button" onClick={() => removeActivity(i)} className="text-red-400 hover:text-red-600">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                )}
              </div>
              <input className="form-input" placeholder="Title *" value={act.title} onChange={(e) => updateActivity(i, "title", e.target.value)} />
              <textarea className="form-input" rows={2} placeholder="Description" value={act.description ?? ""} onChange={(e) => updateActivity(i, "description", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" className="form-input" placeholder="Date" value={act.date ?? ""} onChange={(e) => updateActivity(i, "date", e.target.value)} />
                <input className="form-input" placeholder="Outcome" value={act.outcome ?? ""} onChange={(e) => updateActivity(i, "outcome", e.target.value)} />
              </div>
            </div>
          ))}
        </div>

        {/* Challenges, Recommendations, Next Period */}
        <div className="card p-6 space-y-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Analysis & Planning</p>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Challenges Faced</label>
            <textarea className="form-input" rows={3} placeholder="Describe any obstacles or challenges encountered…" value={form.challenges_faced} onChange={(e) => set("challenges_faced", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Recommendations</label>
            <textarea className="form-input" rows={3} placeholder="Recommendations to SADC-PF or the host parliament…" value={form.recommendations} onChange={(e) => set("recommendations", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Plan for Next Period</label>
            <textarea className="form-input" rows={3} placeholder="Key activities planned for the next reporting period…" value={form.next_period_plan} onChange={(e) => set("next_period_plan", e.target.value)} />
          </div>
        </div>

        {/* Supporting Documents */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Supporting Documents</p>
              <p className="text-xs text-neutral-400 mt-0.5">Attach photos, field notes, meeting minutes, or any supporting evidence.</p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[15px]">attach_file</span>
              Add Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* Drop zone (only shown when no files queued) */}
          {pendingFiles.length === 0 && (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-neutral-200 hover:border-neutral-300 bg-neutral-50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            >
              <span className="material-symbols-outlined text-neutral-300 text-[32px]">upload_file</span>
              <p className="text-sm text-neutral-500 mt-2">Drag &amp; drop files here, or <span className="text-primary underline">browse</span></p>
              <p className="text-xs text-neutral-400 mt-1">Any file type accepted</p>
            </div>
          )}

          {/* File list */}
          {pendingFiles.length > 0 && (
            <div className="space-y-2">
              {pendingFiles.map((pf) => (
                <div key={pf.id} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                  <span className="material-symbols-outlined text-neutral-400 text-[20px] flex-shrink-0">description</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 truncate">{pf.file.name}</p>
                    <p className="text-xs text-neutral-400">{formatBytes(pf.file.size)}</p>
                  </div>
                  <select
                    value={pf.document_type}
                    onChange={(e) => setFileDocType(pf.id, e.target.value)}
                    className="form-input text-xs py-1 h-8 w-44 flex-shrink-0"
                  >
                    {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeFile(pf.id)}
                    className="text-neutral-300 hover:text-red-400 transition-colors flex-shrink-0"
                    title="Remove"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              ))}
              {/* Add more button when files already listed */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-xl border border-dashed border-neutral-200 py-2.5 text-xs font-medium text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[15px]">add</span>
                Add more files
              </button>
            </div>
          )}

          {/* Upload progress */}
          {uploadProgress && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Uploading attachments…</span>
                <span>{uploadProgress.done} / {uploadProgress.total}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link href="/srhr/reports" className="btn-secondary">Cancel</Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? uploadProgress
                ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
                : "Saving…"
              : "Save as Draft"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewReportPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl p-6 text-sm text-neutral-500">Loading…</div>}>
      <NewReportPageInner />
    </Suspense>
  );
}
