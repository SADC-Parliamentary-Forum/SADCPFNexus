"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrGradeBand, type HrSettingsStatus } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { GradeBandSlideOver } from "./GradeBandSlideOver";
import { HrSettingsHeader } from "@/components/hr/HrSettingsHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_TABS = [
  { key: "", label: "settings.hr.gradeBands.tab.all" },
  { key: "published", label: "settings.hr.lifecycle.published" },
  { key: "review",    label: "settings.hr.lifecycle.review" },
  { key: "approved",  label: "settings.hr.lifecycle.approved" },
  { key: "draft",     label: "settings.hr.lifecycle.draft" },
  { key: "archived",  label: "settings.hr.lifecycle.archived" },
];

const STATUS_BADGE: Record<HrSettingsStatus, string> = {
  draft:     "badge-muted",
  review:    "badge-warning",
  approved:  "badge-primary",
  published: "badge-success",
  archived:  "badge-muted",
};

const BAND_LABELS: Record<string, string> = {
  A: "settings.hr.band.A", B: "settings.hr.band.B", C: "settings.hr.band.C", D: "settings.hr.band.D",
};

const STATUS_VALUE_KEYS: Record<string, string> = {
  draft: "settings.hr.lifecycleValue.draft",
  review: "settings.hr.lifecycleValue.review",
  approved: "settings.hr.lifecycleValue.approved",
  published: "settings.hr.lifecycleValue.published",
  archived: "settings.hr.lifecycleValue.archived",
};

function SkeletonRow() {
  return (
    <tr>
      {[...Array(8)].map((_, i) => (
        <td key={i}><div className="h-4 bg-neutral-100 rounded animate-pulse w-3/4" /></td>
      ))}
    </tr>
  );
}

export default function GradeBandsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useI18n();
  const user = getStoredUser();
  const canApprove = isSystemAdmin(user) || hasPermission(user, "hr_settings.approve");
  const canPublish = isSystemAdmin(user) || hasPermission(user, "hr_settings.publish");

  const [statusFilter, setStatusFilter] = useState("");
  const [bandGroup, setBandGroup] = useState("");
  const [search, setSearch] = useState("");
  const [slideOver, setSlideOver] = useState<{ open: boolean; grade: Partial<HrGradeBand> | null }>({ open: false, grade: null });

  const { data, isLoading } = useQuery({
    queryKey: ["hr-settings", "grade-bands", { statusFilter, bandGroup, search }],
    queryFn: () =>
      hrSettingsApi.listGradeBands({
        status: statusFilter || undefined,
        band_group: bandGroup || undefined,
        search: search || undefined,
        per_page: 50,
      }).then((r) => r.data),
  });

  const { data: familiesData } = useQuery({
    queryKey: ["hr-settings", "job-families"],
    queryFn: () => hrSettingsApi.listJobFamilies().then((r) => (r.data as any).data ?? []),
  });

  const grades: HrGradeBand[] = (data as any)?.data ?? [];
  const jobFamilies = familiesData ?? [];

  // Stats
  const stats = {
    total:     grades.length,
    published: grades.filter((g) => g.status === "published").length,
    review:    grades.filter((g) => g.status === "review").length,
    draft:     grades.filter((g) => g.status === "draft").length,
  };

  const mutation = useMutation({
    mutationFn: (form: Partial<HrGradeBand>) =>
      form.id
        ? hrSettingsApi.updateGradeBand(form.id, form).then((r) => r.data)
        : hrSettingsApi.createGradeBand(form).then((r) => r.data),
    onSuccess: (res: any) => {
      toast("success", res.message ?? t("settings.hr.common.saved"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "grade-bands"] });
      setSlideOver({ open: false, grade: null });
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.saveFailed")),
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({ action, id }: { action: string; id: number }) => {
      if (action === "submit")  return hrSettingsApi.submitGradeBand(id).then((r) => r.data);
      if (action === "approve") return hrSettingsApi.approveGradeBand(id).then((r) => r.data);
      if (action === "publish") return hrSettingsApi.publishGradeBand(id).then((r) => r.data);
      if (action === "archive") return hrSettingsApi.archiveGradeBand(id).then((r) => r.data);
      return Promise.reject("Unknown action");
    },
    onSuccess: (res: any) => {
      toast("success", res.message ?? t("settings.hr.common.done"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "grade-bands"] });
      setSlideOver({ open: false, grade: null });
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.actionFailed")),
  });

  const slideGrade = slideOver.grade;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <GradeBandSlideOver
        open={slideOver.open}
        grade={slideGrade}
        jobFamilies={jobFamilies}
        canApprove={canApprove}
        canPublish={canPublish}
        onClose={() => setSlideOver({ open: false, grade: null })}
        onSave={(form) => mutation.mutate(form)}
        onSubmit={slideGrade?.id ? () => lifecycleMutation.mutate({ action: "submit", id: slideGrade.id! }) : undefined}
        onApprove={slideGrade?.id ? () => lifecycleMutation.mutate({ action: "approve", id: slideGrade.id! }) : undefined}
        onPublish={slideGrade?.id ? () => lifecycleMutation.mutate({ action: "publish", id: slideGrade.id! }) : undefined}
        saving={mutation.isPending || lifecycleMutation.isPending}
      />
      <HrSettingsHeader
        title={t("settings.hr.home.gradeBands.title")}
        subtitle={t("settings.hr.gradeBands.subtitle")}
        actions={
          <button
            type="button"
            onClick={() => setSlideOver({ open: true, grade: null })}
            className="btn-primary flex items-center gap-2 shrink-0"
          >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t("settings.hr.gradeBands.new")}
        </button>
        }
      />


      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "settings.hr.gradeBands.stat.total", value: stats.total, icon: "layers", color: "text-primary", bg: "bg-primary/10" },
          { label: "settings.hr.lifecycle.published", value: stats.published, icon: "check_circle", color: "text-green-600", bg: "bg-green-50" },
          { label: "settings.hr.lifecycle.review", value: stats.review, icon: "rate_review", color: "text-amber-600", bg: "bg-amber-50" },
          { label: "settings.hr.lifecycle.draft", value: stats.draft, icon: "draft", color: "text-neutral-500", bg: "bg-neutral-100" },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", s.bg)}>
              <span className={cn("material-symbols-outlined text-[18px]", s.color)}>{s.icon}</span>
            </div>
            <div>
              <p className="text-xs text-neutral-500">{t(s.label)}</p>
              <p className="text-xl font-bold text-neutral-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn("filter-tab", statusFilter === tab.key && "active")}
            >
              {t(tab.label)}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[140px]">
          <select
            className="form-input text-sm h-8 py-0"
            value={bandGroup}
            onChange={(e) => setBandGroup(e.target.value)}
          >
            <option value="">{t("settings.hr.gradeBands.allBands")}</option>
            {Object.entries(BAND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{k} — {t(v)}</option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-neutral-400">search</span>
          <input
            className="form-input text-sm pl-8 h-8 py-0"
            placeholder={t("settings.hr.gradeBands.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>{t("settings.hr.common.code")}</th>
              <th>{t("settings.hr.gradeBands.col.label")}</th>
              <th>{t("settings.hr.gradeBands.col.band")}</th>
              <th>{t("settings.hr.gradeBands.col.category")}</th>
              <th className="text-right">{t("settings.hr.gradeBands.col.leaveDays")}</th>
              <th className="text-center">{t("settings.hr.gradeBands.col.notches")}</th>
              <th>{t("settings.hr.common.status")}</th>
              <th>{t("settings.hr.gradeBands.col.impact")}</th>
              <th className="w-28">{t("settings.hr.common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              : grades.length === 0
              ? (
                <tr>
                  <td colSpan={9}>
                    <EmptyState icon="grade" title={t("settings.hr.gradeBands.emptyTitle")} />
                  </td>
                </tr>
              )
              : grades.map((g) => (
                <tr key={g.id}>
                  <td>
                    <span className="font-mono font-semibold text-sm text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded">
                      {g.code}
                    </span>
                  </td>
                  <td>
                    <p className="text-sm font-medium text-neutral-900">{g.label}</p>
                    {g.job_family && (
                      <p className="text-xs text-neutral-500">{g.job_family.name}</p>
                    )}
                  </td>
                  <td>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-neutral-100 text-neutral-700">
                      {g.band_group} — {BAND_LABELS[g.band_group] ? t(BAND_LABELS[g.band_group]) : ""}
                    </span>
                  </td>
                  <td className="text-sm text-neutral-600 capitalize">{g.employment_category}</td>
                  <td className="text-right text-sm text-neutral-700">{g.leave_days_per_year}</td>
                  <td className="text-center text-sm text-neutral-700">
                    {g.min_notch}–{g.max_notch}
                  </td>
                  <td>
                    <span className={cn("badge", STATUS_BADGE[g.status as HrSettingsStatus])}>
                      {STATUS_VALUE_KEYS[g.status] ? t(STATUS_VALUE_KEYS[g.status]) : g.status}
                    </span>
                  </td>
                  <td>
                    {(g.positions_count ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-[12px]">warning</span>
                        {t("settings.hr.gradeBands.positions", { count: g.positions_count ?? 0 })}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/settings/hr/grade-bands/${g.id}`}
                        className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 hover:text-primary"
                        title={t("settings.hr.gradeBands.viewDetail")}
                      >
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      </Link>
                      {(g.status === "draft" || g.status === "review") && (
                        <button
                          onClick={() => setSlideOver({ open: true, grade: g })}
                          className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 hover:text-primary"
                          title={t("common.edit")}
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                      )}
                      {g.status === "draft" && (
                        <button
                          onClick={() => lifecycleMutation.mutate({ action: "submit", id: g.id })}
                          className="p-1.5 rounded hover:bg-amber-50 text-neutral-500 hover:text-amber-600"
                          title={t("settings.hr.gradeBands.submitReview")}
                        >
                          <span className="material-symbols-outlined text-[16px]">send</span>
                        </button>
                      )}
                      {g.status === "review" && canApprove && (
                        <button
                          onClick={() => lifecycleMutation.mutate({ action: "approve", id: g.id })}
                          className="p-1.5 rounded hover:bg-green-50 text-neutral-500 hover:text-green-600"
                          title={t("common.approve")}
                        >
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        </button>
                      )}
                      {g.status === "approved" && canPublish && (
                        <button
                          onClick={() => lifecycleMutation.mutate({ action: "publish", id: g.id })}
                          className="p-1.5 rounded hover:bg-primary/10 text-neutral-500 hover:text-primary"
                          title={t("settings.hr.gradeBands.publish")}
                        >
                          <span className="material-symbols-outlined text-[16px]">publish</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
