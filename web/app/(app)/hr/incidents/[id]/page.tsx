"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { hrIncidentsApi, type HrIncident } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STEPS: { key: HrIncident["status"]; label: string; icon: string }[] = [
  { key: "reported",     label: "hr.incidents.status.reported", icon: "report" },
  { key: "under_review", label: "hr.incidents.status.underReviewStep", icon: "manage_search" },
  { key: "resolved",     label: "hr.incidents.status.resolved", icon: "check_circle" },
  { key: "closed",       label: "hr.incidents.status.closed", icon: "lock" },
];

const STEP_INDEX: Record<HrIncident["status"], number> = {
  reported: 0, under_review: 1, resolved: 2, closed: 3,
};

const SEVERITY_CONFIG: Record<HrIncident["severity"], { cls: string; label: string; icon: string; bg: string }> = {
  low:    { cls: "badge-success", label: "hr.incidents.severity.low", icon: "info",          bg: "bg-green-50 text-green-700" },
  medium: { cls: "badge-warning", label: "hr.incidents.severity.medium", icon: "warning",       bg: "bg-amber-50 text-amber-700" },
  high:   { cls: "badge-danger",  label: "hr.incidents.severity.high", icon: "error",         bg: "bg-red-50 text-red-700" },
};

export default function IncidentDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [incident, setIncident] = useState<HrIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (!id) return;
    hrIncidentsApi.get(Number(id))
      .then((res) => {
        setIncident(res.data);
        setNotes(res.data.description ?? "");
      })
      .catch(() => setError(t("hr.incidents.detail.loadFailed")))
      .finally(() => setLoading(false));
  }, [id]);

  const transition = async (status: HrIncident["status"]) => {
    if (!incident) return;
    setUpdating(true);
    setError(null);
    try {
      const res = await hrIncidentsApi.update(incident.id, { status, description: notes || undefined });
      setIncident(res.data.data);
      setConfirmClose(false);
      toast.success(t("hr.incidents.detail.statusUpdated"));
    } catch (err) {
      setError(t("hr.incidents.detail.statusFailed"));
      toast.error(t("hr.incidents.detail.statusNotUpdated"), apiErrorMessage(err, t("hr.incidents.detail.statusFailed")));
    } finally {
      setUpdating(false);
    }
  };

  const saveNotes = async () => {
    if (!incident) return;
    setUpdating(true);
    try {
      const res = await hrIncidentsApi.update(incident.id, { description: notes });
      setIncident(res.data.data);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2500);
      toast.success(t("hr.incidents.detail.notesSaved"));
    } catch (err) {
      setError(t("hr.incidents.detail.notesFailed"));
      toast.error(t("hr.incidents.detail.notesNotSaved"), apiErrorMessage(err, t("hr.incidents.detail.notesFailed")));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-neutral-400 gap-2">
        <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
        <span className="text-sm">{t("common.loading")}</span>
      </div>
    );
  }

  if (error && !incident) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        <Link href="/hr/incidents" className="btn-secondary text-sm">{t("hr.incidents.detail.back")}</Link>
      </div>
    );
  }

  if (!incident) return null;

  const sev = SEVERITY_CONFIG[incident.severity];
  const stepIdx = STEP_INDEX[incident.status];
  const canMarkReview  = incident.status === "reported";
  const canMarkResolved = incident.status === "under_review";
  const canClose       = incident.status === "resolved";

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={incident.subject}
        subtitle={t("hr.incidents.detail.reportedByOn", { name: incident.reporter?.name ?? t("hr.incidents.detail.unknown"), date: formatDateShort(incident.reported_at) })}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "hr.incidents.crumb", href: "/hr/incidents" },
              { label: incident.reference_number },
            ]}
          />
        }
        meta={
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${sev.bg}`}>
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>{sev.icon}</span>
            {t(`hr.incidents.severityBadge.${incident.severity}`)}
          </span>
        }
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Investigation timeline stepper */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-neutral-900 mb-5">{t("hr.incidents.detail.progress")}</h2>
        <div className="relative flex items-start justify-between">
          {/* connector line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-neutral-200" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-primary transition-all duration-500"
            style={{ width: stepIdx === 0 ? 0 : `${(stepIdx / (STEPS.length - 1)) * 100}%` }}
          />

          {STEPS.map((step, i) => {
            const done    = i < stepIdx;
            const current = i === stepIdx;
            return (
              <div key={step.key} className="relative flex flex-col items-center gap-2 flex-1">
                <div
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                    done    ? "bg-primary border-primary text-white" :
                    current ? "bg-white border-primary text-primary shadow-md" :
                              "bg-white border-neutral-300 text-neutral-400"
                  }`}
                >
                  {done ? (
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                  ) : (
                    <span className="material-symbols-outlined text-[14px]">{step.icon}</span>
                  )}
                </div>
                <span className={`text-[11px] font-medium text-center leading-tight ${
                  current ? "text-primary font-semibold" : done ? "text-neutral-600" : "text-neutral-400"
                }`}>
                  {t(step.label)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Incident details */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-[16px]">info</span>
          </div>
          <h2 className="text-sm font-semibold text-neutral-900">{t("hr.incidents.detail.details")}</h2>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">{t("hr.timesheets.overtime.reference")}</p>
            <p className="font-mono font-semibold text-neutral-800">{incident.reference_number}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">{t("hr.timesheets.monthly.status")}</p>
            <p className="font-semibold text-neutral-800">{t(`hr.incidents.status.${incident.status}`)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">{t("hr.incidents.new.severity")}</p>
            <p className="font-semibold text-neutral-800">{t(sev.label)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-0.5">{t("hr.incidents.status.reported")}</p>
            <p className="font-semibold text-neutral-800">{formatDateShort(incident.reported_at)}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-neutral-400 mb-0.5">{t("hr.incidents.detail.reportedBy")}</p>
            <p className="font-semibold text-neutral-800">{incident.reporter?.name ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Investigation notes */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-amber-600 text-[16px]">edit_note</span>
          </div>
          <h2 className="text-sm font-semibold text-neutral-900">{t("hr.incidents.detail.notes")}</h2>
        </div>
        <textarea
          rows={5}
          className="form-input resize-none text-sm"
          placeholder={t("hr.incidents.detail.notesPlaceholder")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={incident.status === "closed"}
        />
        {incident.status !== "closed" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveNotes}
              disabled={updating}
              className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              {updating && <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>}
              {t("hr.incidents.detail.saveNotes")}
            </button>
            {notesSaved && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                {t("hr.incidents.detail.saved")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {incident.status !== "closed" && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-blue-600 text-[16px]">settings</span>
            </div>
            <h2 className="text-sm font-semibold text-neutral-900">{t("hr.timesheets.overtime.actions")}</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {canMarkReview && (
              <button
                type="button"
                onClick={() => transition("under_review")}
                disabled={updating}
                className="btn-primary text-sm flex items-center gap-2 px-4 py-2"
              >
                <span className="material-symbols-outlined text-[16px]">manage_search</span>
                {t("hr.incidents.detail.markReview")}
              </button>
            )}
            {canMarkResolved && (
              <button
                type="button"
                onClick={() => transition("resolved")}
                disabled={updating}
                className="btn-primary text-sm flex items-center gap-2 px-4 py-2"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                {t("hr.incidents.detail.markResolved")}
              </button>
            )}
            {canClose && !confirmClose && (
              <button
                type="button"
                onClick={() => setConfirmClose(true)}
                disabled={updating}
                className="btn-secondary text-sm flex items-center gap-2 px-4 py-2 text-neutral-600"
              >
                <span className="material-symbols-outlined text-[16px]">lock</span>
                {t("hr.incidents.detail.closeRecord")}
              </button>
            )}
            {confirmClose && (
              <div className="flex items-center gap-3 rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-2.5">
                <span className="text-sm text-neutral-700">{t("hr.incidents.detail.closeConfirm")}</span>
                <button
                  type="button"
                  onClick={() => transition("closed")}
                  disabled={updating}
                  className="btn-primary text-xs px-3 py-1.5"
                >
                  {updating ? t("hr.incidents.detail.closing") : t("hr.incidents.detail.yesClose")}
                </button>
                <button type="button" onClick={() => setConfirmClose(false)} className="btn-secondary text-xs px-3 py-1.5">
                  {t("common.cancel")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {incident.status === "closed" && (
        <div className="flex items-center gap-2 text-sm text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
          {t("hr.incidents.detail.closedNotice")}
        </div>
      )}

      <div className="flex gap-3 pb-4">
        <Link href="/hr/incidents" className="btn-secondary text-sm">
          {t("hr.incidents.detail.back")}
        </Link>
      </div>
    </div>
  );
}
