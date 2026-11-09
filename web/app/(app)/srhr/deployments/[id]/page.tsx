"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deploymentsApi, researcherReportsApi, type StaffDeployment, type ResearcherReport } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const statusConfig: Record<string, { label: string; cls: string }> = {
  active:    { label: "srhr.deploymentStatus.active", cls: "badge-success" },
  completed: { label: "srhr.deploymentStatus.completed", cls: "badge-muted"   },
  recalled:  { label: "srhr.deploymentStatus.recalled", cls: "badge-danger"  },
  suspended: { label: "srhr.deploymentStatus.suspended", cls: "badge-warning" },
};

const reportStatusConfig: Record<string, { label: string; cls: string }> = {
  draft:              { label: "srhr.reportStatus.draft", cls: "badge-muted"   },
  submitted:          { label: "srhr.reportStatus.submitted", cls: "badge-primary" },
  acknowledged:       { label: "srhr.reportStatus.acknowledged", cls: "badge-success" },
  revision_requested: { label: "srhr.reportStatus.revision_requested", cls: "badge-warning" },
  archived:           { label: "srhr.reportStatus.archived", cls: "badge-muted"   },
};

export default function DeploymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }      = use(params);
  const { t }       = useI18n();
  const router      = useRouter();
  const { confirm } = useConfirm();
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
      .catch(() => setError(t("srhr.deployment.notFound")))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRecall = async () => {
    if (!recallReason.trim()) return;
    setRecalling(true);
    try {
      await deploymentsApi.recall(Number(id), recallReason);
      router.push("/srhr/deployments");
    } catch {
      setError(t("srhr.deployment.recallFailed"));
      setRecalling(false);
    }
  };

  const handleComplete = async () => {
    if (!(await confirm({ title: t("srhr.deployment.completeTitle"), message: t("srhr.deployment.completeMessage"), variant: "primary" }))) return;
    try {
      await deploymentsApi.complete(Number(id));
      router.push("/srhr/deployments");
    } catch {
      setError(t("srhr.deployment.completeFailed"));
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

  if (error || !dep) {
    return <div className="card p-8 text-center text-sm text-red-600">{error ?? t("srhr.notFound")}</div>;
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={dep.employee?.name ?? dep.reference_number}
        subtitle={`${dep.parliament?.name} · ${dep.reference_number}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "srhr.crumb", href: "/srhr" },
              { label: "srhr.deployment.crumb", href: "/srhr/deployments" },
              { label: dep.reference_number },
            ]}
          />
        }
        meta={
          <span className={`badge ${statusConfig[dep.status]?.cls ?? "badge-muted"}`}>
            {statusConfig[dep.status] ? t(statusConfig[dep.status].label) : dep.status}
          </span>
        }
      />

      {/* Actions */}
      {dep.status === "active" && (
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/srhr/reports/new?deployment_id=${dep.id}`}
            className="btn-primary inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add_notes</span>
            {t("srhr.submitReport")}
          </Link>
          <button
            className="btn-secondary inline-flex items-center gap-2"
            onClick={handleComplete}
          >
            <span className="material-symbols-outlined text-[18px]">task_alt</span>
            {t("srhr.deployment.markCompleted")}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
            onClick={() => setShowRecallModal(true)}
          >
            <span className="material-symbols-outlined text-[18px]">undo</span>
            {t("srhr.deployment.recall")}
          </button>
        </div>
      )}

      {/* Deployment info */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-neutral-400">info</span>
          {t("srhr.deployment.details")}
        </h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          {[
            { label: t("srhr.col.researcher"), value: dep.employee?.name },
            { label: t("srhr.col.parliament"), value: dep.parliament?.name },
            { label: t("srhr.col.type"), value: dep.deployment_type === "field_researcher" ? t("srhr.deploymentType.field_researcher") : dep.deployment_type },
          { label: t("srhr.deployment.researchArea"), value: dep.research_area ?? "—" },
            { label: t("common.startDate"), value: formatDate(dep.start_date) },
            { label: t("common.endDate"), value: dep.end_date ? formatDate(dep.end_date) : t("srhr.deployment.openEnded") },
            { label: t("srhr.deployment.payroll"), value: dep.payroll_active ? t("hr.timesheets.templates.active") : t("srhr.deployment.paused") },
          ].map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-neutral-500 mb-0.5">{f.label}</dt>
              <dd className="font-medium text-neutral-900">{f.value}</dd>
            </div>
          ))}
        </dl>
        {dep.research_focus && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-1">{t("srhr.deployment.researchFocus")}</p>
            <p className="text-sm text-neutral-700 whitespace-pre-line">{dep.research_focus}</p>
          </div>
        )}
        {dep.terms_of_reference && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-1">{t("srhr.deployment.tor")}</p>
            <p className="text-sm text-neutral-700 whitespace-pre-line">{dep.terms_of_reference}</p>
          </div>
        )}
      </div>

      {/* Supervisor */}
      {(dep.supervisor_name || dep.supervisor_email) && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">person</span>
            {t("srhr.deployment.supervisorAtParliament")}
          </h3>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            {dep.supervisor_name  && <div><dt className="text-xs text-neutral-500">{t("hr.timesheets.templates.name")}</dt><dd className="font-medium">{dep.supervisor_name}</dd></div>}
            {dep.supervisor_title && <div><dt className="text-xs text-neutral-500">{t("srhr.deployment.supervisorTitle")}</dt><dd className="font-medium">{dep.supervisor_title}</dd></div>}
            {dep.supervisor_email && <div><dt className="text-xs text-neutral-500">{t("srhr.deployment.email")}</dt><dd><a href={`mailto:${dep.supervisor_email}`} className="text-primary hover:underline">{dep.supervisor_email}</a></dd></div>}
            {dep.supervisor_phone && <div><dt className="text-xs text-neutral-500">{t("srhr.deployment.phone")}</dt><dd className="font-medium">{dep.supervisor_phone}</dd></div>}
          </dl>
        </div>
      )}

      {/* Reports */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">summarize</span>
            <h3 className="text-sm font-semibold text-neutral-900">{t("srhr.deployment.activityReports")}</h3>
          </div>
          {dep.status === "active" && (
            <Link href={`/srhr/reports/new?deployment_id=${dep.id}`} className="btn-secondary text-xs">{t("srhr.deployment.newReport")}</Link>
          )}
        </div>
        {reports.length === 0 ? (
          <EmptyState icon="summarize" title={t("srhr.deployment.noReports")} className="py-8 min-h-0" />
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
                  {reportStatusConfig[r.status] ? t(reportStatusConfig[r.status].label) : r.status}
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
            <h3 className="text-base font-semibold text-neutral-900">{t("srhr.deployment.recallTitle")}</h3>
            <p className="text-sm text-neutral-600">{t("srhr.deployment.recallPrompt")}</p>
            <textarea
              className="form-input"
              rows={3}
              placeholder={t("srhr.deployment.recallPlaceholder")}
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowRecallModal(false)}>{t("common.cancel")}</button>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={!recallReason.trim() || recalling}
                onClick={handleRecall}
              >
                {recalling ? t("srhr.deployment.recalling") : t("srhr.deployment.confirmRecall")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
