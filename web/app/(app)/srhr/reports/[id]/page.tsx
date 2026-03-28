"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { researcherReportsApi, type ResearcherReport } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:              { label: "Draft",              cls: "badge-muted",    icon: "draft"            },
  submitted:          { label: "Submitted",          cls: "badge-primary",  icon: "send"             },
  acknowledged:       { label: "Acknowledged",       cls: "badge-success",  icon: "check_circle"     },
  revision_requested: { label: "Revision Requested", cls: "badge-warning",  icon: "edit_note"        },
  archived:           { label: "Archived",           cls: "badge-muted",    icon: "inventory_2"      },
};

const typeLabel: Record<string, string> = {
  monthly:   "Monthly Report",
  quarterly: "Quarterly Report",
  annual:    "Annual Report",
  ad_hoc:    "Ad Hoc Report",
};

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }     = use(params);
  const router     = useRouter();
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
      .catch(() => setError("Report not found."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReport(); }, [id]);

  const handleSubmit = async () => {
    if (!confirm("Submit this report to SADC-PF?")) return;
    setSubmitting(true);
    try {
      const res = await researcherReportsApi.submit(Number(id));
      setReport(res.data.data);
    } catch {
      setError("Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!confirm("Acknowledge this report?")) return;
    setAcknowledging(true);
    try {
      const res = await researcherReportsApi.acknowledge(Number(id));
      setReport(res.data.data);
    } catch {
      setError("Failed to acknowledge report.");
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
    } catch {
      setError("Failed to request revision.");
    } finally {
      setRequestingRevision(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
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
    return <div className="card p-8 text-center text-sm text-red-600">{error ?? "Not found."}</div>;
  }

  const status = statusConfig[report.status];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/srhr" className="hover:text-primary">SRHR</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/srhr/reports" className="hover:text-primary">Reports</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-800 font-medium">{report.reference_number}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{report.title}</h1>
          <p className="page-subtitle">
            {typeLabel[report.report_type]} · {report.employee?.name} · {report.parliament?.name}
          </p>
        </div>
        <span className={`badge ${status?.cls ?? "badge-muted"} flex-shrink-0`}>{status?.label}</span>
      </div>

      {/* Revision feedback banner */}
      {report.status === "revision_requested" && report.revision_notes && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-amber-600 text-[18px] flex-shrink-0 mt-0.5">edit_note</span>
          <div>
            <p className="text-sm font-medium text-amber-800">Revision Requested</p>
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
              Edit
            </Link>
            <button className="btn-primary inline-flex items-center gap-2" onClick={handleSubmit} disabled={submitting}>
              <span className="material-symbols-outlined text-[18px]">send</span>
              {submitting ? "Submitting…" : "Submit to SADC-PF"}
            </button>
          </>
        )}
        {report.status === "submitted" && (
          <>
            <button className="btn-primary inline-flex items-center gap-2" onClick={handleAcknowledge} disabled={acknowledging}>
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {acknowledging ? "Acknowledging…" : "Acknowledge"}
            </button>
            <button
              className="btn-secondary inline-flex items-center gap-2"
              onClick={() => setShowRevisionModal(true)}
            >
              <span className="material-symbols-outlined text-[18px]">edit_note</span>
              Request Revision
            </button>
          </>
        )}
      </div>

      {/* Report metadata */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-neutral-400">info</span>
          Report Details
        </h3>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {[
            { label: "Reference",    value: report.reference_number },
            { label: "Type",         value: typeLabel[report.report_type] },
            { label: "Period",       value: `${formatDate(report.period_start)} – ${formatDate(report.period_end)}` },
            { label: "Researcher",   value: report.employee?.name },
            { label: "Parliament",   value: report.parliament?.name },
            { label: "Submitted",    value: report.submitted_at ? formatDate(report.submitted_at) : "—" },
            { label: "Acknowledged", value: report.acknowledged_at ? formatDate(report.acknowledged_at) : "—" },
            { label: "Acknowledged by", value: report.acknowledged_by_user?.name ?? "—" },
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
            Executive Summary
          </h3>
          <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">{report.executive_summary}</p>
        </div>
      )}

      {/* Activities */}
      {report.activities_undertaken && report.activities_undertaken.length > 0 && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">checklist</span>
            Activities Undertaken ({report.activities_undertaken.length})
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
            Analysis & Planning
          </h3>
          {report.challenges_faced && (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-1.5">Challenges Faced</p>
              <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">{report.challenges_faced}</p>
            </div>
          )}
          {report.recommendations && (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-1.5">Recommendations</p>
              <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">{report.recommendations}</p>
            </div>
          )}
          {report.next_period_plan && (
            <div>
              <p className="text-xs font-medium text-neutral-500 mb-1.5">Plan for Next Period</p>
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
            SRHR Indicators
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
            <h3 className="text-base font-semibold text-neutral-900">Request Revision</h3>
            <p className="text-sm text-neutral-600">Explain what the researcher needs to revise or clarify.</p>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Revision notes…"
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowRevisionModal(false)}>Cancel</button>
              <button
                className="btn-primary"
                disabled={!revisionNotes.trim() || requestingRevision}
                onClick={handleRequestRevision}
              >
                {requestingRevision ? "Sending…" : "Request Revision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
