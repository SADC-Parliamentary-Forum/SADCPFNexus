"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrGradeBand, type HrSettingsStatus } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { GradeBandSlideOver } from "../GradeBandSlideOver";
import { HrSettingsHeader } from "@/components/hr/HrSettingsHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_VALUE_KEYS: Record<string, string> = {
  draft: "settings.hr.lifecycleValue.draft",
  review: "settings.hr.lifecycleValue.review",
  approved: "settings.hr.lifecycleValue.approved",
  published: "settings.hr.lifecycleValue.published",
  archived: "settings.hr.lifecycleValue.archived",
};

const BAND_LABELS: Record<string, string> = {
  A: "settings.hr.band.A", B: "settings.hr.band.B", C: "settings.hr.band.C", D: "settings.hr.band.D",
};

const STATUS_BADGE: Record<HrSettingsStatus, string> = {
  draft:     "badge-muted",
  review:    "badge-warning",
  approved:  "badge-primary",
  published: "badge-success",
  archived:  "badge-muted",
};

function SectionIcon({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", bg)}>
      <span className={cn("material-symbols-outlined text-[18px]", color)}>{icon}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-neutral-800">{value}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3 animate-pulse">
      <div className="h-5 bg-neutral-100 rounded w-1/3" />
      <div className="h-4 bg-neutral-100 rounded w-full" />
      <div className="h-4 bg-neutral-100 rounded w-2/3" />
    </div>
  );
}

export default function GradeBandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t, localeTag } = useI18n();
  const statusText = (s: string) => (STATUS_VALUE_KEYS[s] ? t(STATUS_VALUE_KEYS[s]) : s);
  const user = getStoredUser();
  const canApprove = isSystemAdmin(user) || hasPermission(user, "hr_settings.approve");
  const canPublish = isSystemAdmin(user) || hasPermission(user, "hr_settings.publish");

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["hr-settings", "grade-bands", id],
    queryFn: () => hrSettingsApi.getGradeBand(Number(id)).then((r) => (r.data as any).data as HrGradeBand),
  });

  const { data: impactData } = useQuery({
    queryKey: ["hr-settings", "grade-bands", id, "impact"],
    queryFn: () => hrSettingsApi.impactCheckGradeBand(Number(id)).then((r) => (r.data as any).data),
    enabled: !!data,
  });

  const { data: familiesData } = useQuery({
    queryKey: ["hr-settings", "job-families"],
    queryFn: () => hrSettingsApi.listJobFamilies().then((r) => (r.data as any).data ?? []),
  });

  const updateMutation = useMutation({
    mutationFn: (form: Partial<HrGradeBand>) =>
      hrSettingsApi.updateGradeBand(Number(id), form).then((r) => r.data),
    onSuccess: (res: any) => {
      toast("success", res.message ?? t("settings.hr.common.saved"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "grade-bands", id] });
      setEditOpen(false);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.gradeBandDetail.failed")),
  });

  const lifecycleMutation = useMutation({
    mutationFn: (action: string) => {
      if (action === "submit")  return hrSettingsApi.submitGradeBand(Number(id)).then((r) => r.data);
      if (action === "approve") return hrSettingsApi.approveGradeBand(Number(id)).then((r) => r.data);
      if (action === "publish") return hrSettingsApi.publishGradeBand(Number(id)).then((r) => r.data);
      if (action === "archive") return hrSettingsApi.archiveGradeBand(Number(id)).then((r) => r.data);
      if (action === "new-version") return hrSettingsApi.newVersionGradeBand(Number(id)).then((r) => r.data);
      return Promise.reject("Unknown action");
    },
    onSuccess: (res: any) => {
      toast("success", res.message ?? t("settings.hr.common.done"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "grade-bands"] });
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.actionFailed")),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <HrSettingsHeader
          title={t("settings.hr.gradeBandDetail.title")}
          crumbs={[
            { label: "nav.admin", href: "/admin" },
            { label: t("settings.hr.home.breadcrumb"), href: "/settings/hr" },
            { label: t("settings.hr.home.gradeBands.title"), href: "/settings/hr/grade-bands" },
            { label: t("settings.hr.gradeBandDetail.title") },
          ]}
        />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <HrSettingsHeader
          title={t("settings.hr.gradeBandDetail.title")}
          crumbs={[
            { label: "nav.admin", href: "/admin" },
            { label: t("settings.hr.home.breadcrumb"), href: "/settings/hr" },
            { label: t("settings.hr.home.gradeBands.title"), href: "/settings/hr/grade-bands" },
            { label: t("settings.hr.gradeBandDetail.title") },
          ]}
        />
        <EmptyState icon="error" title={t("settings.hr.gradeBandDetail.loadFailed")} />
      </div>
    );
  }

  const g = data;
  const status = g.status as HrSettingsStatus;
  const impact = impactData ?? { positions_count: 0, active_staff_count: 0, positions: [] };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {editOpen && (
        <GradeBandSlideOver
          open={editOpen}
          grade={g}
          jobFamilies={familiesData ?? []}
          canApprove={canApprove}
          canPublish={canPublish}
          onClose={() => setEditOpen(false)}
          onSave={(form) => updateMutation.mutate(form)}
          onSubmit={() => lifecycleMutation.mutate("submit")}
          onApprove={() => lifecycleMutation.mutate("approve")}
          onPublish={() => lifecycleMutation.mutate("publish")}
          saving={updateMutation.isPending || lifecycleMutation.isPending}
        />
      )}

      <HrSettingsHeader
        title={g.label}
        subtitle={t("settings.hr.gradeBandDetail.subtitle", { code: g.code, band: g.band_group, category: g.employment_category })}
        crumbs={[
          { label: "nav.admin", href: "/admin" },
          { label: t("settings.hr.home.breadcrumb"), href: "/settings/hr" },
          { label: t("settings.hr.home.gradeBands.title"), href: "/settings/hr/grade-bands" },
          { label: g.code },
        ]}
        meta={
          <>
            <span className={cn("badge", STATUS_BADGE[status])}>{statusText(status)}</span>
            <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">v{g.version_number}</span>
          </>
        }
        actions={
          <>
            {status === "draft" && (
              <button type="button" onClick={() => setEditOpen(true)} className="btn-secondary text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">edit</span>
                {t("common.edit")}
              </button>
            )}
            {status === "draft" && (
              <button type="button" onClick={() => lifecycleMutation.mutate("submit")} className="btn-secondary text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">send</span>
                {t("common.submit")}
              </button>
            )}
            {status === "review" && canApprove && (
              <button type="button" onClick={() => lifecycleMutation.mutate("approve")} className="btn-secondary text-sm flex items-center gap-1.5 text-green-700 border-green-300 hover:bg-green-50">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                {t("common.approve")}
              </button>
            )}
            {status === "approved" && canPublish && (
              <button type="button" onClick={() => lifecycleMutation.mutate("publish")} className="btn-primary text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">publish</span>
                {t("settings.hr.gradeBands.publish")}
              </button>
            )}
            {status === "published" && (
              <button type="button" onClick={() => lifecycleMutation.mutate("new-version")} className="btn-secondary text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                {t("settings.hr.gradeBandDetail.newVersion")}
              </button>
            )}
            {(status === "draft" || status === "review") && (
              <button type="button" onClick={() => lifecycleMutation.mutate("archive")} className="btn-secondary text-sm text-neutral-500">
                {t("settings.hr.gradeBandDetail.archive")}
              </button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Core Details */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="grade" color="text-primary" bg="bg-primary/10" />
            <h2 className="font-semibold text-neutral-900">{t("settings.hr.gradeBandDetail.coreDetails")}</h2>
          </div>
          <InfoRow label={t("settings.hr.gradeBandDetail.gradeCode")} value={<span className="font-mono font-bold">{g.code}</span>} />
          <InfoRow label={t("settings.hr.gradeBands.col.label")} value={g.label} />
          <InfoRow label={t("settings.hr.gradeBandDetail.bandGroup")} value={`${g.band_group} — ${t(BAND_LABELS[g.band_group] ?? "settings.hr.band.D")}`} />
          <InfoRow label={t("settings.hr.gradeBandDetail.employmentCategory")} value={<span className="capitalize">{g.employment_category}</span>} />
          <InfoRow label={t("settings.hr.gradeBand.jobFamily")} value={g.job_family?.name ?? "—"} />
          <InfoRow label={t("settings.hr.gradeBand.effectiveFrom")} value={g.effective_from} />
          <InfoRow label={t("settings.hr.gradeBand.effectiveTo")} value={g.effective_to ?? t("settings.hr.gradeBandDetail.openEnded")} />
          {g.notes && (
            <div className="mt-3 pt-3 border-t border-neutral-100">
              <p className="text-xs text-neutral-500 mb-1">{t("settings.hr.gradeBand.notesPolicy")}</p>
              <p className="text-sm text-neutral-700">{g.notes}</p>
            </div>
          )}
        </div>

        {/* Salary & Notches */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="payments" color="text-green-600" bg="bg-green-50" />
            <h2 className="font-semibold text-neutral-900">{t("settings.hr.gradeBandDetail.salaryBenefits")}</h2>
          </div>
          <InfoRow label={t("settings.hr.gradeBandDetail.notchRange")} value={`${g.min_notch} – ${g.max_notch}`} />
          <InfoRow label={t("settings.hr.gradeBandDetail.leaveDaysYear")} value={g.leave_days_per_year} />
          <InfoRow label={t("settings.hr.contract.probation")} value={t("settings.hr.contract.months", { count: g.probation_months })} />
          <InfoRow label={t("settings.hr.contract.noticePeriod")} value={t("settings.hr.contract.days", { count: g.notice_period_days })} />
          <InfoRow label={t("settings.hr.gradeBandDetail.actingAllowance")} value={g.acting_allowance_rate != null ? `${(Number(g.acting_allowance_rate) * 100).toFixed(1)}%` : t("settings.hr.gradeBandDetail.notEligible")} />
          <InfoRow label={t("settings.hr.gradeBandDetail.medicalAid")} value={g.medical_aid_eligible ? t("settings.hr.gradeBandDetail.eligible") : t("settings.hr.gradeBandDetail.notEligible")} />
          <InfoRow label={t("settings.hr.gradeBandDetail.housingAllowance")} value={g.housing_allowance_eligible ? t("settings.hr.gradeBandDetail.eligible") : t("settings.hr.gradeBandDetail.notEligible")} />
          <InfoRow label={t("settings.hr.gradeBand.travelClass")} value={g.travel_class ? <span className="capitalize">{g.travel_class}</span> : "—"} />
          <InfoRow label={t("settings.hr.gradeBandDetail.overtime")} value={g.overtime_eligible ? t("settings.hr.gradeBandDetail.eligible") : t("settings.hr.gradeBandDetail.notEligible")} />
        </div>

        {/* Linked Salary Scales */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <SectionIcon icon="account_balance" color="text-teal-600" bg="bg-teal-50" />
              <h2 className="font-semibold text-neutral-900">{t("settings.hr.home.salaryScales.title")}</h2>
            </div>
            <Link
              href={`/settings/hr/salary-scales?grade_band_id=${g.id}`}
              className="btn-secondary text-xs"
            >
              {t("common.viewAll")}
            </Link>
          </div>
          {!g.salary_scales?.length ? (
            <EmptyState
              icon="payments"
              title={t("settings.hr.gradeBandDetail.noScales")}
              action={
                <Link href="/settings/hr/salary-scales" className="btn-secondary text-xs">
                  {t("settings.hr.gradeBandDetail.createScale")}
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {g.salary_scales.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{t("settings.hr.gradeBandDetail.scaleVersion", { currency: s.currency, version: s.version_number })}</p>
                    <p className="text-xs text-neutral-500">{t("settings.hr.gradeBandDetail.effective", { date: s.effective_from })}</p>
                  </div>
                  <span className={cn("badge", STATUS_BADGE[s.status as HrSettingsStatus])}>{statusText(s.status)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Impact Analysis */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="analytics" color="text-amber-600" bg="bg-amber-50" />
            <h2 className="font-semibold text-neutral-900">{t("settings.hr.gradeBandDetail.impact")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-neutral-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-neutral-900">{impact.positions_count}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{t("settings.hr.gradeBandDetail.positions")}</p>
            </div>
            <div className="bg-neutral-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-neutral-900">{impact.active_staff_count}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{t("settings.hr.gradeBandDetail.activeStaff")}</p>
            </div>
          </div>
          {impact.positions.length > 0 && (
            <div className="space-y-1.5">
              {impact.positions.slice(0, 6).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-xs text-neutral-600 py-1 border-b border-neutral-50 last:border-0">
                  <span>{p.title}</span>
                  <span className="text-neutral-400">{p.department ?? "—"}</span>
                </div>
              ))}
              {impact.positions.length > 6 && (
                <p className="text-xs text-neutral-400 text-center pt-1">{t("assignments.calendar.more", { count: impact.positions.length - 6 })}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Governance Trail */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="policy" color="text-indigo-600" bg="bg-indigo-50" />
          <h2 className="font-semibold text-neutral-900">{t("settings.hr.gradeBandDetail.governanceTrail")}</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: "settings.hr.gradeBandDetail.reviewedBy",  name: (g as any).reviewer?.name, at: g.reviewed_at },
            { label: "settings.hr.gradeBand.approvedBy",  name: (g as any).approver?.name, at: g.approved_at },
            { label: "settings.hr.gradeBand.publishedBy", name: (g as any).publisher?.name, at: g.published_at },
          ].map(({ label, name, at }) => (
            <div key={label} className="bg-neutral-50 rounded-xl p-3">
              <p className="text-xs text-neutral-500 mb-1">{t(label)}</p>
              <p className="text-sm font-medium text-neutral-800">{name ?? "—"}</p>
              {at && <p className="text-xs text-neutral-400 mt-0.5">{new Date(at).toLocaleDateString(localeTag)}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
