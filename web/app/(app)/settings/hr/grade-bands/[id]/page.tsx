"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrGradeBand, type HrSettingsStatus } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { GradeBandSlideOver } from "../GradeBandSlideOver";

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
      toast("success", res.message ?? "Saved.");
      qc.invalidateQueries({ queryKey: ["hr-settings", "grade-bands", id] });
      setEditOpen(false);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? "Failed."),
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
      toast("success", res.message ?? "Done.");
      qc.invalidateQueries({ queryKey: ["hr-settings", "grade-bands"] });
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? "Action failed."),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-neutral-100 rounded w-48 animate-pulse" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card p-8 text-center">
        <span className="material-symbols-outlined text-[32px] text-red-400">error</span>
        <p className="mt-2 text-sm text-red-600">Failed to load grade band.</p>
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

      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
          <Link href="/settings/hr" className="hover:text-primary">HR Administration</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/settings/hr/grade-bands" className="hover:text-primary">Position Grades</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700 font-medium">{g.code}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="page-title">{g.label}</h1>
              <span className={cn("badge", STATUS_BADGE[status])}>{status}</span>
              <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">v{g.version_number}</span>
            </div>
            <p className="page-subtitle">Grade code {g.code} · {g.band_group} band · {g.employment_category}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {status === "draft" && (
              <button onClick={() => setEditOpen(true)} className="btn-secondary text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Edit
              </button>
            )}
            {status === "draft" && (
              <button onClick={() => lifecycleMutation.mutate("submit")} className="btn-secondary text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">send</span>
                Submit
              </button>
            )}
            {status === "review" && canApprove && (
              <button onClick={() => lifecycleMutation.mutate("approve")} className="btn-secondary text-sm flex items-center gap-1.5 text-green-700 border-green-300 hover:bg-green-50">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Approve
              </button>
            )}
            {status === "approved" && canPublish && (
              <button onClick={() => lifecycleMutation.mutate("publish")} className="btn-primary text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">publish</span>
                Publish
              </button>
            )}
            {status === "published" && (
              <button onClick={() => lifecycleMutation.mutate("new-version")} className="btn-secondary text-sm flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                New Version
              </button>
            )}
            {(status === "draft" || status === "review") && (
              <button onClick={() => lifecycleMutation.mutate("archive")} className="btn-secondary text-sm text-neutral-500">
                Archive
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Core Details */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="grade" color="text-primary" bg="bg-primary/10" />
            <h2 className="font-semibold text-neutral-900">Core Details</h2>
          </div>
          <InfoRow label="Grade Code" value={<span className="font-mono font-bold">{g.code}</span>} />
          <InfoRow label="Label" value={g.label} />
          <InfoRow label="Band Group" value={`${g.band_group} — ${g.band_group === "A" ? "Executive" : g.band_group === "B" ? "Senior/Manager" : g.band_group === "C" ? "Officer" : "Support"}`} />
          <InfoRow label="Employment Category" value={<span className="capitalize">{g.employment_category}</span>} />
          <InfoRow label="Job Family" value={g.job_family?.name ?? "—"} />
          <InfoRow label="Effective From" value={g.effective_from} />
          <InfoRow label="Effective To" value={g.effective_to ?? "Open-ended"} />
          {g.notes && (
            <div className="mt-3 pt-3 border-t border-neutral-100">
              <p className="text-xs text-neutral-500 mb-1">Notes / Policy Reference</p>
              <p className="text-sm text-neutral-700">{g.notes}</p>
            </div>
          )}
        </div>

        {/* Salary & Notches */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="payments" color="text-green-600" bg="bg-green-50" />
            <h2 className="font-semibold text-neutral-900">Salary & Benefits</h2>
          </div>
          <InfoRow label="Notch Range" value={`${g.min_notch} – ${g.max_notch}`} />
          <InfoRow label="Leave Days / Year" value={g.leave_days_per_year} />
          <InfoRow label="Probation" value={`${g.probation_months} months`} />
          <InfoRow label="Notice Period" value={`${g.notice_period_days} days`} />
          <InfoRow label="Acting Allowance" value={g.acting_allowance_rate != null ? `${(Number(g.acting_allowance_rate) * 100).toFixed(1)}%` : "Not eligible"} />
          <InfoRow label="Medical Aid" value={g.medical_aid_eligible ? "Eligible" : "Not eligible"} />
          <InfoRow label="Housing Allowance" value={g.housing_allowance_eligible ? "Eligible" : "Not eligible"} />
          <InfoRow label="Travel Class" value={g.travel_class ? <span className="capitalize">{g.travel_class}</span> : "—"} />
          <InfoRow label="Overtime" value={g.overtime_eligible ? "Eligible" : "Not eligible"} />
        </div>

        {/* Linked Salary Scales */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <SectionIcon icon="account_balance" color="text-teal-600" bg="bg-teal-50" />
              <h2 className="font-semibold text-neutral-900">Salary Scales</h2>
            </div>
            <Link
              href={`/settings/hr/salary-scales?grade_band_id=${g.id}`}
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {!g.salary_scales?.length ? (
            <div className="py-6 text-center">
              <p className="text-sm text-neutral-400">No salary scales linked to this grade yet.</p>
              <Link href="/settings/hr/salary-scales" className="text-xs text-primary hover:underline mt-1 block">
                Create salary scale
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {g.salary_scales.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{s.currency} scale · v{s.version_number}</p>
                    <p className="text-xs text-neutral-500">Effective {s.effective_from}</p>
                  </div>
                  <span className={cn("badge", STATUS_BADGE[s.status as HrSettingsStatus])}>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Impact Analysis */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="analytics" color="text-amber-600" bg="bg-amber-50" />
            <h2 className="font-semibold text-neutral-900">Impact Analysis</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-neutral-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-neutral-900">{impact.positions_count}</p>
              <p className="text-xs text-neutral-500 mt-0.5">Positions</p>
            </div>
            <div className="bg-neutral-50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-neutral-900">{impact.active_staff_count}</p>
              <p className="text-xs text-neutral-500 mt-0.5">Active Staff</p>
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
                <p className="text-xs text-neutral-400 text-center pt-1">+{impact.positions.length - 6} more</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Governance Trail */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="policy" color="text-indigo-600" bg="bg-indigo-50" />
          <h2 className="font-semibold text-neutral-900">Governance Trail</h2>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: "Reviewed by",  name: (g as any).reviewer?.name, at: g.reviewed_at },
            { label: "Approved by",  name: (g as any).approver?.name, at: g.approved_at },
            { label: "Published by", name: (g as any).publisher?.name, at: g.published_at },
          ].map(({ label, name, at }) => (
            <div key={label} className="bg-neutral-50 rounded-xl p-3">
              <p className="text-xs text-neutral-500 mb-1">{label}</p>
              <p className="text-sm font-medium text-neutral-800">{name ?? "—"}</p>
              {at && <p className="text-xs text-neutral-400 mt-0.5">{new Date(at).toLocaleDateString()}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
