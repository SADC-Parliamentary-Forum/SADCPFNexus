"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrGradeBand, type HrSettingsStatus } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { GradeBandSlideOver } from "./GradeBandSlideOver";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "published", label: "Published" },
  { key: "review",    label: "In Review" },
  { key: "approved",  label: "Approved" },
  { key: "draft",     label: "Draft" },
  { key: "archived",  label: "Archived" },
];

const STATUS_BADGE: Record<HrSettingsStatus, string> = {
  draft:     "badge-muted",
  review:    "badge-warning",
  approved:  "badge-primary",
  published: "badge-success",
  archived:  "badge-muted",
};

const BAND_LABELS: Record<string, string> = {
  A: "Executive", B: "Senior/Manager", C: "Officer", D: "Support",
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
      toast({ title: res.message ?? "Saved.", type: "success" });
      qc.invalidateQueries({ queryKey: ["hr-settings", "grade-bands"] });
      setSlideOver({ open: false, grade: null });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Failed to save.", type: "error" }),
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
      toast({ title: res.message ?? "Done.", type: "success" });
      qc.invalidateQueries({ queryKey: ["hr-settings", "grade-bands"] });
      setSlideOver({ open: false, grade: null });
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Action failed.", type: "error" }),
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

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <Link href="/settings/hr" className="hover:text-primary">HR Administration</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700 font-medium">Position Grades</span>
          </div>
          <h1 className="page-title">Position Grades</h1>
          <p className="page-subtitle">Grade band master — defines employment conditions, eligibility rules, and notch ranges.</p>
        </div>
        <button
          onClick={() => setSlideOver({ open: true, grade: null })}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Grade Band
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.total, icon: "layers", color: "text-primary", bg: "bg-primary/10" },
          { label: "Published", value: stats.published, icon: "check_circle", color: "text-green-600", bg: "bg-green-50" },
          { label: "In Review", value: stats.review, icon: "rate_review", color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Draft", value: stats.draft, icon: "draft", color: "text-neutral-500", bg: "bg-neutral-100" },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", s.bg)}>
              <span className={cn("material-symbols-outlined text-[18px]", s.color)}>{s.icon}</span>
            </div>
            <div>
              <p className="text-xs text-neutral-500">{s.label}</p>
              <p className="text-xl font-bold text-neutral-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={cn("filter-tab", statusFilter === t.key && "active")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[140px]">
          <select
            className="form-input text-sm h-8 py-0"
            value={bandGroup}
            onChange={(e) => setBandGroup(e.target.value)}
          >
            <option value="">All bands</option>
            {Object.entries(BAND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{k} — {v}</option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-neutral-400">search</span>
          <input
            className="form-input text-sm pl-8 h-8 py-0"
            placeholder="Search grade code or label…"
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
              <th>Code</th>
              <th>Label</th>
              <th>Band</th>
              <th>Category</th>
              <th className="text-right">Leave Days</th>
              <th className="text-center">Notches</th>
              <th>Status</th>
              <th>Impact</th>
              <th className="w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              : grades.length === 0
              ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-neutral-400 text-sm">
                    <span className="material-symbols-outlined text-[32px] block mb-2">grade</span>
                    No grade bands found.
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
                      {g.band_group} — {BAND_LABELS[g.band_group]}
                    </span>
                  </td>
                  <td className="text-sm text-neutral-600 capitalize">{g.employment_category}</td>
                  <td className="text-right text-sm text-neutral-700">{g.leave_days_per_year}</td>
                  <td className="text-center text-sm text-neutral-700">
                    {g.min_notch}–{g.max_notch}
                  </td>
                  <td>
                    <span className={cn("badge", STATUS_BADGE[g.status as HrSettingsStatus])}>
                      {g.status}
                    </span>
                  </td>
                  <td>
                    {(g.positions_count ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-[12px]">warning</span>
                        {g.positions_count} pos.
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
                        title="View detail"
                      >
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      </Link>
                      {(g.status === "draft" || g.status === "review") && (
                        <button
                          onClick={() => setSlideOver({ open: true, grade: g })}
                          className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 hover:text-primary"
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                      )}
                      {g.status === "draft" && (
                        <button
                          onClick={() => lifecycleMutation.mutate({ action: "submit", id: g.id })}
                          className="p-1.5 rounded hover:bg-amber-50 text-neutral-500 hover:text-amber-600"
                          title="Submit for review"
                        >
                          <span className="material-symbols-outlined text-[16px]">send</span>
                        </button>
                      )}
                      {g.status === "review" && canApprove && (
                        <button
                          onClick={() => lifecycleMutation.mutate({ action: "approve", id: g.id })}
                          className="p-1.5 rounded hover:bg-green-50 text-neutral-500 hover:text-green-600"
                          title="Approve"
                        >
                          <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        </button>
                      )}
                      {g.status === "approved" && canPublish && (
                        <button
                          onClick={() => lifecycleMutation.mutate({ action: "publish", id: g.id })}
                          className="p-1.5 rounded hover:bg-primary/10 text-neutral-500 hover:text-primary"
                          title="Publish"
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
