"use client";

import { WorkflowTracker } from "@/components/workflow/WorkflowTracker";
import { cn } from "@/lib/utils";

type Snapshot = {
  status?: string;
  current_stage?: { label?: string; stage_type?: string } | null;
  currently_with?: { id: number; name: string; position?: string | null }[];
  next_step?: { label?: string; stage_type?: string } | null;
  due_at?: string | null;
  approval_package_hash?: string | null;
  record_version?: number | null;
  resubmission_impact?: {
    is_material: boolean;
    resume_step_index: number;
    message: string;
  } | null;
};

function bannerText(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return "—";
}

interface WorkflowStatusBannerProps {
  /** Prefer a full workflow snapshot when available (Approvals / Travel). */
  snapshot?: Snapshot | null;
  /** Fallback fields when modules only expose stage/holder strings (Leave). */
  status?: string | null;
  currentStage?: string | null;
  currentHolder?: string | null;
  extras?: { label: string; value: string }[];
  className?: string;
}

/**
 * Unified workflow chrome: use WorkflowTracker when a snapshot exists,
 * otherwise a compact stage/holder card matching the same visual language.
 */
export function WorkflowStatusBanner({
  snapshot,
  status,
  currentStage,
  currentHolder,
  extras = [],
  className,
}: WorkflowStatusBannerProps) {
  if (snapshot) {
    return (
      <div className={className}>
        <WorkflowTracker snapshot={snapshot} />
      </div>
    );
  }

  if (!status && !currentStage && !currentHolder && extras.length === 0) {
    return null;
  }

  const cells = [
    { label: "Status", value: bannerText(status) },
    { label: "Current stage", value: bannerText(currentStage) },
    { label: "Currently with", value: bannerText(currentHolder) },
    ...extras.map((extra) => ({ label: extra.label, value: bannerText(extra.value) })),
  ];

  return (
    <div className={cn("card space-y-3 p-4 sm:p-5", className)}>
      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Workflow tracker</h4>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        {cells.map((cell) => (
          <div key={cell.label}>
            <dt className="text-[11px] uppercase text-neutral-400">{cell.label}</dt>
            <dd className="mt-0.5 font-medium text-neutral-800 capitalize">{cell.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
