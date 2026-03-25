"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrGradeBand, type HrSalaryScale, type HrSalaryScaleNotch, type HrSettingsStatus } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { SalaryScaleSlideOver } from "./SalaryScaleSlideOver";

const STATUS_BADGE: Record<HrSettingsStatus, string> = {
  draft:     "badge-muted",
  review:    "badge-warning",
  approved:  "badge-primary",
  published: "badge-success",
  archived:  "badge-muted",
};

function formatAmount(val: number, currency = "NAD"): string {
  return new Intl.NumberFormat("en-NA", {
    style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(val);
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i}><div className="h-4 bg-neutral-100 rounded animate-pulse" /></td>
      ))}
    </tr>
  );
}

export default function SalaryScalesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const user = getStoredUser();
  const canApprove = isSystemAdmin(user) || hasPermission(user, "hr_settings.approve");
  const canPublish = isSystemAdmin(user) || hasPermission(user, "hr_settings.publish");

  const [statusFilter, setStatusFilter] = useState("");
  const [gradeBandFilter, setGradeBandFilter] = useState("");
  const [slideOver, setSlideOver] = useState<{ open: boolean; scale: Partial<HrSalaryScale> | null }>({ open: false, scale: null });

  const { data: scalesData, isLoading } = useQuery({
    queryKey: ["hr-settings", "salary-scales", { statusFilter, gradeBandFilter }],
    queryFn: () =>
      hrSettingsApi.listSalaryScales({
        status: statusFilter || undefined,
        grade_band_id: gradeBandFilter ? Number(gradeBandFilter) : undefined,
        per_page: 50,
      }).then((r) => r.data),
  });

  const { data: bandsData } = useQuery({
    queryKey: ["hr-settings", "grade-bands", "all"],
    queryFn: () => hrSettingsApi.listGradeBands({ per_page: 100 }).then((r) => r.data),
  });

  const scales: HrSalaryScale[] = (scalesData as any)?.data ?? [];
  const gradeBands: HrGradeBand[] = (bandsData as any)?.data ?? [];

  const saveMutation = useMutation({
    mutationFn: (form: Partial<HrSalaryScale> & { notches: HrSalaryScaleNotch[] }) =>
      (form as any).id
        ? hrSettingsApi.updateSalaryScale((form as any).id, form).then((r) => r.data)
        : hrSettingsApi.createSalaryScale(form as any).then((r) => r.data),
    onSuccess: (res: any) => {
      toast("success", res.message ?? "Saved.");
      qc.invalidateQueries({ queryKey: ["hr-settings", "salary-scales"] });
      setSlideOver({ open: false, scale: null });
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? "Failed to save."),
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({ action, id }: { action: string; id: number }) => {
      if (action === "submit")  return hrSettingsApi.submitSalaryScale(id).then((r) => r.data);
      if (action === "approve") return hrSettingsApi.approveSalaryScale(id).then((r) => r.data);
      if (action === "publish") return hrSettingsApi.publishSalaryScale(id).then((r) => r.data);
      return Promise.reject("Unknown action");
    },
    onSuccess: (res: any) => {
      toast("success", res.message ?? "Done.");
      qc.invalidateQueries({ queryKey: ["hr-settings", "salary-scales"] });
      setSlideOver({ open: false, scale: null });
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? "Action failed."),
  });

  // Group scales by grade band for display
  const grouped: Record<string, HrSalaryScale[]> = {};
  for (const s of scales) {
    const key = s.grade_band?.code ?? String(s.grade_band_id);
    grouped[key] = [...(grouped[key] ?? []), s];
  }

  const currentScale = slideOver.scale;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <SalaryScaleSlideOver
        open={slideOver.open}
        scale={slideOver.scale}
        gradeBands={gradeBands}
        canApprove={canApprove}
        canPublish={canPublish}
        onClose={() => setSlideOver({ open: false, scale: null })}
        onSave={(form) => saveMutation.mutate(form)}
        onSubmit={currentScale?.id ? () => lifecycleMutation.mutate({ action: "submit", id: currentScale.id! }) : undefined}
        onApprove={currentScale?.id ? () => lifecycleMutation.mutate({ action: "approve", id: currentScale.id! }) : undefined}
        onPublish={currentScale?.id ? () => lifecycleMutation.mutate({ action: "publish", id: currentScale.id! }) : undefined}
        saving={saveMutation.isPending || lifecycleMutation.isPending}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <Link href="/settings/hr" className="hover:text-primary">HR Administration</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700 font-medium">Salary Scales</span>
          </div>
          <h1 className="page-title">Salary Scales</h1>
          <p className="page-subtitle">Notch-based salary structures linked to grade bands, with effective dating and approval workflow.</p>
        </div>
        <button
          onClick={() => setSlideOver({ open: true, scale: null })}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Salary Scale
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex gap-1 flex-wrap">
          {["", "published", "review", "approved", "draft", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn("filter-tab", statusFilter === s && "active")}
            >
              {s || "All"}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[160px]">
          <select
            className="form-input text-sm h-8 py-0"
            value={gradeBandFilter}
            onChange={(e) => setGradeBandFilter(e.target.value)}
          >
            <option value="">All grade bands</option>
            {gradeBands.map((g) => (
              <option key={g.id} value={g.id}>{g.code} — {g.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="card overflow-hidden">
          <table className="data-table w-full">
            <tbody>{[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
          </table>
        </div>
      ) : scales.length === 0 ? (
        <div className="card p-12 text-center">
          <span className="material-symbols-outlined text-[40px] text-neutral-300">payments</span>
          <p className="mt-2 text-sm text-neutral-500">No salary scales found.</p>
          <button onClick={() => setSlideOver({ open: true, scale: null })} className="btn-primary text-sm mt-4 mx-auto">
            Create first salary scale
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([gradeCode, gradeScales]) => {
            const band = gradeScales[0]?.grade_band;
            return (
              <div key={gradeCode} className="card overflow-hidden">
                <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center gap-3">
                  <span className="font-mono font-semibold text-sm bg-white border border-neutral-200 px-2 py-0.5 rounded text-neutral-800">
                    {gradeCode}
                  </span>
                  <span className="text-sm font-medium text-neutral-700">{band?.label ?? "—"}</span>
                  <span className="text-xs text-neutral-400 ml-auto">{gradeScales.length} scale{gradeScales.length !== 1 ? "s" : ""}</span>
                </div>
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th className="text-center">Notches</th>
                      <th className="text-right">Min (Notch 1 monthly)</th>
                      <th className="text-right">Max (top notch monthly)</th>
                      <th>Effective From</th>
                      <th>Status</th>
                      <th className="w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradeScales.map((s) => {
                      const sortedNotches = [...(s.notches ?? [])].sort((a, b) => a.notch - b.notch);
                      const minMonthly = sortedNotches[0]?.monthly ?? 0;
                      const maxMonthly = sortedNotches[sortedNotches.length - 1]?.monthly ?? 0;
                      const scaleStatus = s.status as HrSettingsStatus;
                      return (
                        <tr key={s.id}>
                          <td>
                            <span className="text-xs text-neutral-500">v{s.version_number}</span>
                          </td>
                          <td className="text-center text-sm text-neutral-700">
                            {s.notches?.length ?? 0}
                          </td>
                          <td className="text-right text-sm font-medium text-neutral-800">
                            {formatAmount(minMonthly, s.currency)}
                          </td>
                          <td className="text-right text-sm font-medium text-neutral-800">
                            {formatAmount(maxMonthly, s.currency)}
                          </td>
                          <td className="text-sm text-neutral-600">{s.effective_from}</td>
                          <td>
                            <span className={cn("badge", STATUS_BADGE[scaleStatus])}>{s.status}</span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              {(scaleStatus === "draft" || scaleStatus === "review") && (
                                <button
                                  onClick={() => setSlideOver({ open: true, scale: s })}
                                  className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 hover:text-primary"
                                  title="Edit"
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                              )}
                              {scaleStatus === "draft" && (
                                <button
                                  onClick={() => lifecycleMutation.mutate({ action: "submit", id: s.id })}
                                  className="p-1.5 rounded hover:bg-amber-50 text-neutral-500 hover:text-amber-600"
                                  title="Submit for review"
                                >
                                  <span className="material-symbols-outlined text-[16px]">send</span>
                                </button>
                              )}
                              {scaleStatus === "review" && canApprove && (
                                <button
                                  onClick={() => lifecycleMutation.mutate({ action: "approve", id: s.id })}
                                  className="p-1.5 rounded hover:bg-green-50 text-neutral-500 hover:text-green-600"
                                  title="Approve"
                                >
                                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                </button>
                              )}
                              {scaleStatus === "approved" && canPublish && (
                                <button
                                  onClick={() => lifecycleMutation.mutate({ action: "publish", id: s.id })}
                                  className="p-1.5 rounded hover:bg-primary/10 text-neutral-500 hover:text-primary"
                                  title="Publish"
                                >
                                  <span className="material-symbols-outlined text-[16px]">publish</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
