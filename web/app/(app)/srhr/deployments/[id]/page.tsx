"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deploymentsApi, researcherReportsApi, type StaffDeployment, type ResearcherReport } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string }> = {
  active:    { label: "Active",    cls: "badge-success" },
  completed: { label: "Completed", cls: "badge-muted"   },
  recalled:  { label: "Recalled",  cls: "badge-danger"  },
  suspended: { label: "Suspended", cls: "badge-warning" },
};

const reportStatusConfig: Record<string, { label: string; cls: string }> = {
  draft:              { label: "Draft",             cls: "badge-muted"   },
  submitted:          { label: "Submitted",         cls: "badge-primary" },
  acknowledged:       { label: "Acknowledged",      cls: "badge-success" },
  revision_requested: { label: "Revision Requested",cls: "badge-warning" },
  archived:           { label: "Archived",          cls: "badge-muted"   },
};

export default function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }      = use(params);
  const router      = useRouter();
  const [dep, setDep] = useState<StaffDeployment | null>(null);
  const [reports, setReports]     = useState<ResearcherReport[]>([]);
  const [loading, setLoading]     = useState(true);
  const [recalling, setRecalling] = useState(false);
  const [recallReason, setRecallReason] = useState("");
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      deploymentsApi.get(Number(id)),
      researcherReportsApi.list({ deployment_id: Number(id), per_page: 10 }),
    ])
      .then(([dRes, rRes]) => {
        setDep(dRes.data.data);
        setReports(rRes.data.data ?? []);
      })
      .catch(() => setError("Deployment not found."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRecall = async () => {
    if (!recallReason.trim()) return;
    setRecalling(true);
    try {
      await deploymentsApi.recall(Number(id), recallReason);
      router.push("/srhr/deployments");
    } catch {
      setError("Failed to recall deployment.");
      setRecalling(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm("Mark this deployment as completed?")) return;
    try {
      await deploymentsApi.complete(Number(id));
      router.push("/srhr/deployments");
    } catch {
      setError("Failed to complete deployment.");
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

  if (error || !dep) {
    return <div className="card p-8 text-center text-sm text-red-600">{error ?? "Not found."}</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/srhr" className="hover:text-primary">SRHR</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/srhr/deployments" className="hover:text-primary">Deployments</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-800 font-medium">{dep.reference_number}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{dep.employee?.name}</h1>
          <p className="page-subtitle">{dep.parliament?.name} · {dep.reference_number}</p>
        </div>
        <span className={`badge ${statusConfig[dep.status]?.cls ?? "badge-muted"} flex-shrink-0`}>
          {statusConfig[dep.status]?.label}
        </span>
      </div>

      {/* Actions */}
      {dep.status === "active" && (
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/srhr/reports/new?deployment_id=${dep.id}`}
            className="btn-primary inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add_notes</span>
            Submit Report
          </Link>
          <button
            className="btn-secondary inline-flex items-center gap-2"
            onClick={handleComplete}
          >
            <span className="material-symbols-outlined text-[18px]">task_alt</span>
            Mark Completed
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
            onClick={() => setShowRecallModal(true)}
          >
            <span className="material-symbols-outlined text-[18px]">undo</span>
            Recall
          </button>
        </div>
      )}

      {/* Deployment info */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-neutral-400">info</span>
          Deployment Details
        </h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          {[
            { label: "Researcher",   value: dep.employee?.name },
            { label: "Parliament",   value: dep.parliament?.name },
            { label: "Type",          value: dep.deployment_type === "field_researcher" ? "Field Researcher" : dep.deployment_type },
          { label: "Research Area", value: dep.research_area ?? "—" },
            { label: "Start Date",   value: formatDate(dep.start_date) },
            { label: "End Date",     value: dep.end_date ? formatDate(dep.end_date) : "Open-ended" },
            { label: "Payroll",      value: dep.payroll_active ? "Active" : "Paused" },
          ].map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-neutral-500 mb-0.5">{f.label}</dt>
              <dd className="font-medium text-neutral-900">{f.value}</dd>
            </div>
          ))}
        </dl>
        {dep.research_focus && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-1">Research Focus</p>
            <p className="text-sm text-neutral-700 whitespace-pre-line">{dep.research_focus}</p>
          </div>
        )}
        {dep.terms_of_reference && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-1">Terms of Reference</p>
            <p className="text-sm text-neutral-700 whitespace-pre-line">{dep.terms_of_reference}</p>
          </div>
        )}
      </div>

      {/* Supervisor */}
      {(dep.supervisor_name || dep.supervisor_email) && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">person</span>
            Supervisor at Parliament
          </h3>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            {dep.supervisor_name  && <div><dt className="text-xs text-neutral-500">Name</dt><dd className="font-medium">{dep.supervisor_name}</dd></div>}
            {dep.supervisor_title && <div><dt className="text-xs text-neutral-500">Title</dt><dd className="font-medium">{dep.supervisor_title}</dd></div>}
            {dep.supervisor_email && <div><dt className="text-xs text-neutral-500">Email</dt><dd><a href={`mailto:${dep.supervisor_email}`} className="text-primary hover:underline">{dep.supervisor_email}</a></dd></div>}
            {dep.supervisor_phone && <div><dt className="text-xs text-neutral-500">Phone</dt><dd className="font-medium">{dep.supervisor_phone}</dd></div>}
          </dl>
        </div>
      )}

      {/* Reports */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">summarize</span>
            <h3 className="text-sm font-semibold text-neutral-900">Activity Reports</h3>
          </div>
          {dep.status === "active" && (
            <Link href={`/srhr/reports/new?deployment_id=${dep.id}`} className="text-xs text-primary hover:underline">+ New report</Link>
          )}
        </div>
        {reports.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-neutral-400">No reports submitted yet.</div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {reports.map((r) => (
              <Link
                key={r.id}
                href={`/srhr/reports/${r.id}`}
                className="px-5 py-3.5 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">{r.title}</p>
                  <p className="text-xs text-neutral-500">{r.reference_number} · {formatDate(r.period_start)} – {formatDate(r.period_end)}</p>
                </div>
                <span className={`badge ${reportStatusConfig[r.status]?.cls ?? "badge-muted"} text-[10px] flex-shrink-0`}>
                  {reportStatusConfig[r.status]?.label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recall modal */}
      {showRecallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-neutral-900">Recall Deployment</h3>
            <p className="text-sm text-neutral-600">Please provide a reason for recalling this deployment. This will clear the researcher&apos;s external HR flag.</p>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Reason for recall…"
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowRecallModal(false)}>Cancel</button>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={!recallReason.trim() || recalling}
                onClick={handleRecall}
              >
                {recalling ? "Recalling…" : "Confirm Recall"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
