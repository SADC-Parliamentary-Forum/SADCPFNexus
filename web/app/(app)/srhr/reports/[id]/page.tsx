"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { researcherReportsApi, type ResearcherReport } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:              { label: "srhr.reportStatus.draft", cls: "badge-muted",    icon: "draft"            },
  submitted:          { label: "srhr.reportStatus.submitted", cls: "badge-primary",  icon: "send"             },
  acknowledged:       { label: "srhr.reportStatus.acknowledged", cls: "badge-success",  icon: "check_circle"     },
  revision_requested: { label: "srhr.reportStatus.revision_requested", cls: "badge-warning",  icon: "edit_note"        },
  archived:           { label: "srhr.reportStatus.archived", cls: "badge-muted",    icon: "inventory_2"      },
};

const typeLabel: Record<string, string> = {
  monthly:   "srhr.reportTypeFull.monthly",
  quarterly: "srhr.reportTypeFull.quarterly",
  annual:    "srhr.reportTypeFull.annual",
  ad_hoc:    "srhr.reportTypeFull.ad_hoc",
};

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }     = use(params);
  const { t }      = useI18n();
  const router     = useRouter();
  const { confirm } = useConfirm();
  const toast      = useToast();
  const [report, setReport]               = useState<ResearcherReport | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [submitting, setSubmitting]       = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [requestingRevision, setRequestingRevision] = useState(false);

  const loadReport = () => {
    researcherReportsApi
      .get(Number(id))
      .then((res) => setReport(res.data.data))
      .catch(() => setError(t("srhr.report.notFound")))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReport(); }, [id]);

  const handleSubmit = async () => {
    if (!(await confirm({ title: t("srhr.report.submitTitle"), message: t("srhr.report.submitMessage"), variant: "primary" }))) return;
    setSubmitting(true);
    try {
      const res = await researcherReportsApi.submit(Number(id));
      setReport(res.data.data);
      toast.success(t("srhr.report.submitted"));
    } catch (err) {
      const message = apiErrorMessage(err, t("srhr.report.submitFailed"));
      setError(message);
      toast.error(t("srhr.report.notSubmitted"), message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!(await confirm({ title: t("srhr.report.ackTitle"), message: t("srhr.report.ackMessage"), variant: "primary" }))) return;
    setAcknowledging(true);
    try {
      const res = await researcherReportsApi.acknowledge(Number(id));
      setReport(res.data.data);
      toast.success(t("srhr.report.acknowledged"));
    } catch (err) {
      const message = apiErrorMessage(err, t("srhr.report.ackFailed"));
      setError(message);
      toast.error(t("srhr.report.notAcknowledged"), message);
    } finally {
      setAcknowledging(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!revisionNotes.trim()) return;
    setRequestingRevision(true);
    try {
      const res = await researcherReportsApi.requestRevision(Number(id), revisionNotes);
      setReport(res.data.data);
      setShowRevisionModal(false);
      setRevisionNotes("");
      toast.success(t("srhr.report.revisionRequested"));
    } catch (err) {
      const message = apiErrorMessage(err, t("srhr.report.revisionFailed"));
      setError(message);
      toast.error(t("srhr.report.revisionNotRequested"), message);
    } finally {
      setRequestingRevision(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <div className="h-6 bg-neutral-100 rounded animate-pulse w-1/3" />
        <div className="card p-6 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 bg-neutral-100 rounded animate-pulse w-2/3" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !report) {
    return <div className="card p-8 text-center text-sm text-red-600">{error ?? t("srhr.notFound")}</div>;
  }

  const status = statusConfig[report.status];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={report.title}
        subtitle={`${typeLabel[report.report_type] ? t(typeLabel[report.report_type]) : report.report_type} · ${report.employee?.name} · ${report.parliament?.name}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "srhr.crumb", href: "/srhr" },
              { label: "srhr.report.crumb", href: "/srhr/reports" },
              { label: report.reference_number },
            ]}
          />
        }
        meta={<span className={`badge ${status?.cls ?? "badge-muted"}`}>{status ? t(status.label) : report.status}</span>}
      />

      {/* Revision feedback banner */}
      {report.status === "revision_requested" && report.revision_notes && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-amber-600 text-[18px] flex-shrink-0 mt-0.5">edit_note</span>
          <div>
            <p className="text-sm font-medium text-amber-800">{t("srhr.reportStatus.revision_requested")}</p>
            <p className="text-sm text-amber-700 mt-0.5">{report.revision_notes}</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {(report.status === "draft" || report.status === "revision_requested") && (
          <>
            <Link href={`/srhr/reports/${report.id}/edit`} className="btn-secondary inline-flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">edit</span>
              {t("common.edit")}
            </Link>
            <button className="btn-primary inline-flex items-center gap-2" onClick={handleSubmit} disabled={submitting}>
              <span className="material-symbols-outlined text-[18px]">send</span>
              {submitting ? t("hr.incidents.new.submitting") : t("srhr.report.submitToSadcpf")}
            </button>
          </>
        )}
        {report.status === "submitted" && (
          <>
            <button className="btn-primary inline-flex items-center gap-2" onClick={handleAcknowledge} disabled={acknowledging}>
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {acknowledging ? t("srhr.report.acknowledging") : t("srhr.report.acknowledge")}
            </button>
            <button
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => setShowRevisionModal(true)}
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              {t("srhr.report.requestRevision")}
            </button>
          </>
        )}
      </div>

      {/* Report metadata */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-neutral-400">info</span>
          {t("srhr.report.details")}
        </h3>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: t("hr.timesheets.overtime.reference"), value: report.reference_number },
            { label: t("srhr.col.type"), value: typeLabel[report.report_type] ? t(typeLabel[report.report_type]) : report.report_type },
            { label: t("srhr.reports.colPeriod"), value: `${formatDate(report.period_start)} – ${formatDate(report.period_end)}` },
            { label: t("srhr.col.researcher"), value: report.employee?.name },
            { label: t("srhr.col.parliament"), value: report.parliament?.name },
            { label: t("srhr.reportStatus.submitted"), value: report.submitted_at ? formatDate(report.submitted_at) : "—" },
            { label: t("srhr.reportStatus.acknowledged"), value: report.acknowledged_at ? formatDate(report.acknowledged_at) : "—" },
            { label: t("srhr.report.acknowledgedBy"), value: report.acknowledged_by_user?.name ?? "—" },
          ].map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-neutral-500 mb-0.5">{f.label}</dt>
              <dd className="font-medium text-neutral-900">{f.value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Executive Summary */}
      {report.executive_summary && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">summarize</span>
            {t("srhr.report.executiveSummary")}
          </h3>
          <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">{report.executive_summary}</p>
        </div>
      )}

      {/* Activities */}
      {report.activities_undertaken && report.activities_undertaken.length > 0 && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">checklist</span>
            {t("srhr.report.activitiesCount", { count: report.activities_undertaken.length })}
          </h3>
          <div className="space-y-4">
            {report.activities_undertaken.map((act, i) => (
              <div key={i} className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">{i + 1}</span>
                  <p className="text-sm font-semibold text-neutral-900">{act.title}</p>
                  {act.date && <span className="ml-auto text-xs text-neutral-400">{formatDate(act.date)}</span>}
                </div>
                {act.description && <p className="text-sm text-neutral-600 mt-1.5">{act.description}</p>}
                {act.outcome && (
                  <div className="mt-2 flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-green-500 text-[14px] mt-0.5">check</span>
                    <p className="text-xs text-neutral-600">{act.outcome}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis sections */}
      {(report.challenges_faced || report.recommendations || report.next_period_plan) && (
        <div className="card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">analytics</span>
            {t("srhr.report.analysis")}
          </h3>
          {report.challenges_faced && (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-1.5">{t("srhr.report.challenges")}</p>
              <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">{report.challenges_faced}</p>
            </div>
          )}
          {report.recommendations && (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-1.5">{t("srhr.report.recommendations")}</p>
              <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">{report.recommendations}</p>
            </div>
          )}
          {report.next_period_plan && (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-1.5">{t("srhr.report.nextPlan")}</p>
              <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">{report.next_period_plan}</p>
            </div>
          )}
        </div>
      )}

      {/* SRHR Indicators */}
      {report.srhr_indicators && Object.keys(report.srhr_indicators).length > 0 && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">bar_chart</span>
            {t("srhr.report.indicators")}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(report.srhr_indicators).map(([key, val]) => (
              <div key={key} className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-center">
                <p className="text-xl font-bold text-neutral-900">{val}</p>
                <p className="text-[10px] text-neutral-500 mt-1 capitalize">{key.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revision modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-neutral-900">{t("srhr.report.requestRevision")}</h3>
            <p className="text-sm text-neutral-600">{t("srhr.report.revisionPrompt")}</p>
            <textarea
              className="form-input"
              rows={4}
              placeholder={t("srhr.report.revisionPlaceholder")}
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowRevisionModal(false)}>{t("common.cancel")}</button>
              <button
                className="btn-primary"
                disabled={!revisionNotes.trim() || requestingRevision}
                onClick={handleRequestRevision}
              >
                {requestingRevision ? t("srhr.report.sending") : t("srhr.report.requestRevision")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
