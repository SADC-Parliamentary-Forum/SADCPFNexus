"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { researcherReportsApi, deploymentsApi, type StaffDeployment, type ResearcherReportActivity } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/** Values are stored on the attachment; labels are translation keys. */
const DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: "Monthly Report", label: "srhr.reportTypeFull.monthly" },
  { value: "Quarterly Report", label: "srhr.reportTypeFull.quarterly" },
  { value: "Field Notes", label: "srhr.newReport.doc.fieldNotes" },
  { value: "Meeting Minutes", label: "srhr.newReport.doc.minutes" },
  { value: "Supporting Evidence", label: "srhr.newReport.doc.evidence" },
  { value: "Photo Documentation", label: "srhr.newReport.doc.photos" },
  { value: "Other", label: "srhr.deploymentType.other" },
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
  const { t } = useI18n();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const toast        = useToast();
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
      let failedUploads = 0;
      if (pendingFiles.length > 0) {
        const reportId = created.data.id;
        setUploadProgress({ done: 0, total: pendingFiles.length });
        for (let i = 0; i < pendingFiles.length; i++) {
          const pf = pendingFiles[i];
          try {
            await researcherReportsApi.uploadAttachment(reportId, pf.file, pf.document_type);
          } catch {
            // Non-fatal: continue uploading remaining files
            failedUploads++;
          }
          setUploadProgress({ done: i + 1, total: pendingFiles.length });
        }
      }

      toast.success(t("srhr.newReport.saved"), form.title);
      if (failedUploads > 0) {
        toast.warning(t("srhr.newReport.someNotUploaded"), t("srhr.newReport.someNotUploadedDetail", { count: failedUploads }));
      }
      router.push("/srhr/reports");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msgs = e.response?.data?.errors
        ? Object.values(e.response.data.errors).flat().join("; ")
        : (e.response?.data?.message ?? t("srhr.newReport.saveFailed"));
      setError(msgs);
      toast.error(t("srhr.newReport.notSaved"), msgs);
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/srhr" className="hover:text-primary">{t("srhr.crumb")}</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/srhr/reports" className="hover:text-primary">{t("srhr.report.crumb")}</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-800 font-medium">{t("srhr.newReport.crumb")}</span>
      </div>

      <ModulePageHeader
        title="srhr.newReport.title"
        subtitle="srhr.newReport.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "srhr.newReport.title" }]} />}
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Report metadata */}
        <div className="card p-6 space-y-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t("srhr.report.details")}</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="srhr-reports-new-deployment" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.newReport.deployment")} <span className="text-red-500">*</span></label>
              <select id="srhr-reports-new-deployment" className="form-input" value={form.deployment_id} onChange={(e) => set("deployment_id", e.target.value)} required>
                <option value="">{t("srhr.newReport.selectDeployment")}</option>
                {deployments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.employee?.name} → {d.parliament?.name} ({d.reference_number})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="srhr-reports-new-report-type" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.newReport.reportType")}</label>
              <select id="srhr-reports-new-report-type" className="form-input" value={form.report_type} onChange={(e) => set("report_type", e.target.value)}>
                <option value="monthly">{t("srhr.reportType.monthly")}</option>
                <option value="quarterly">{t("srhr.reportType.quarterly")}</option>
                <option value="annual">{t("srhr.reportType.annual")}</option>
                <option value="ad_hoc">{t("srhr.reportType.ad_hoc")}</option>
              </select>
            </div>
            <div />
            <div>
              <label htmlFor="srhr-reports-new-period-start" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.newReport.periodStart")} <span className="text-red-500">*</span></label>
              <input id="srhr-reports-new-period-start" type="date" className="form-input" value={form.period_start} onChange={(e) => set("period_start", e.target.value)} required />
            </div>
            <div>
              <label htmlFor="srhr-reports-new-period-end" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.newReport.periodEnd")} <span className="text-red-500">*</span></label>
              <input id="srhr-reports-new-period-end" type="date" className="form-input" value={form.period_end} onChange={(e) => set("period_end", e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="srhr-reports-new-report-title" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.newReport.reportTitle")} <span className="text-red-500">*</span></label>
              <input id="srhr-reports-new-report-title" className="form-input" placeholder={t("srhr.newReport.titlePlaceholder")} value={form.title} onChange={(e) => set("title", e.target.value)} required />
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="card p-6 space-y-3">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t("srhr.report.executiveSummary")}</p>
          <textarea
            className="form-input"
            rows={4}
            placeholder={t("srhr.newReport.summaryPlaceholder")}
            value={form.executive_summary}
            onChange={(e) => set("executive_summary", e.target.value)}
          />
        </div>

        {/* Activities */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t("srhr.newReport.activities")}</p>
            <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={addActivity}>
              {t("srhr.newReport.addActivity")}
            </button>
          </div>
          {activities.map((act, i) => (
            <div key={i} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-600">{t("srhr.newReport.activityN", { n: i + 1 })}</p>
                {activities.length > 1 && (
                  <button type="button" onClick={() => removeActivity(i)} className="text-red-400 hover:text-red-600" aria-label={t("srhr.newReport.removeActivity", { n: i + 1 })}>
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                )}
              </div>
              <input className="form-input" placeholder={t("srhr.newReport.activityTitle")} value={act.title} onChange={(e) => updateActivity(i, "title", e.target.value)} />
              <textarea className="form-input" rows={2} placeholder={t("hr.timesheets.templates.description")} value={act.description ?? ""} onChange={(e) => updateActivity(i, "description", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" className="form-input" placeholder={t("hr.timesheets.col.date")} value={act.date ?? ""} onChange={(e) => updateActivity(i, "date", e.target.value)} />
                <input className="form-input" placeholder={t("srhr.newReport.outcome")} value={act.outcome ?? ""} onChange={(e) => updateActivity(i, "outcome", e.target.value)} />
              </div>
            </div>
          ))}
        </div>

        {/* Challenges, Recommendations, Next Period */}
        <div className="card p-6 space-y-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t("srhr.report.analysis")}</p>
          <div>
            <label htmlFor="srhr-reports-new-challenges-faced" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.report.challenges")}</label>
            <textarea id="srhr-reports-new-challenges-faced" className="form-input" rows={3} placeholder={t("srhr.newReport.challengesPlaceholder")} value={form.challenges_faced} onChange={(e) => set("challenges_faced", e.target.value)} />
          </div>
          <div>
            <label htmlFor="srhr-reports-new-recommendations" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.report.recommendations")}</label>
            <textarea id="srhr-reports-new-recommendations" className="form-input" rows={3} placeholder={t("srhr.newReport.recommendationsPlaceholder")} value={form.recommendations} onChange={(e) => set("recommendations", e.target.value)} />
          </div>
          <div>
            <label htmlFor="srhr-reports-new-plan-for-next-period" className="block text-xs font-medium text-neutral-700 mb-1.5">{t("srhr.report.nextPlan")}</label>
            <textarea id="srhr-reports-new-plan-for-next-period" className="form-input" rows={3} placeholder={t("srhr.newReport.nextPlanPlaceholder")} value={form.next_period_plan} onChange={(e) => set("next_period_plan", e.target.value)} />
          </div>
        </div>

        {/* Supporting Documents */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t("srhr.newReport.documents")}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{t("srhr.newReport.documentsHint")}</p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[15px]">attach_file</span>
              {t("srhr.newReport.addFiles")}
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
              <p className="text-sm text-neutral-500 mt-2">{t("srhr.newReport.dropHint")} <span className="text-primary underline">{t("srhr.newReport.browse")}</span></p>
              <p className="text-xs text-neutral-400 mt-1">{t("srhr.newReport.anyType")}</p>
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
                    {DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{t(d.label)}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeFile(pf.id)}
                    className="text-neutral-300 hover:text-red-400 transition-colors flex-shrink-0"
                    title={t("srhr.newReport.removeFile")}
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
                {t("srhr.newReport.addMore")}
              </button>
            </div>
          )}

          {/* Upload progress */}
          {uploadProgress && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{t("srhr.newReport.uploadingAttachments")}</span>
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
          <Link href="/srhr/reports" className="btn-secondary">{t("common.cancel")}</Link>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? uploadProgress
                ? t("srhr.newReport.uploadingProgress", { done: uploadProgress.done, total: uploadProgress.total })
                : t("hr.timesheets.saving")
              : t("hr.timesheets.saveDraft")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewReportPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="w-full min-w-0 p-6 text-sm text-neutral-500">{t("common.loading")}</div>}>
      <NewReportPageInner />
    </Suspense>
  );
}
