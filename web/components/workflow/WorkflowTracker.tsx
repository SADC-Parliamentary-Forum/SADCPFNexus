'use client';

/**
 * Compact workflow tracker: current holder / stage / next stage (PRD §11–§12).
 */
export function WorkflowTracker({
  snapshot,
}: {
  snapshot?: {
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
  } | null;
}) {
  if (!snapshot) return null;

  const holders = snapshot.currently_with ?? [];
  const impact = snapshot.resubmission_impact;

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3 bg-white dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Workflow tracker</h4>
        <span className="text-xs capitalize text-neutral-600 dark:text-neutral-300">{snapshot.status ?? '—'}</span>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-[11px] uppercase text-neutral-400">Current stage</dt>
          <dd className="font-medium mt-0.5">
            {snapshot.current_stage?.label ?? '—'}
            {snapshot.current_stage?.stage_type ? (
              <span className="ml-1 text-xs text-neutral-500">({snapshot.current_stage.stage_type})</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-neutral-400">Currently with</dt>
          <dd className="font-medium mt-0.5">
            {holders.length
              ? holders.map((h) => h.name + (h.position ? ` · ${h.position}` : '')).join(', ')
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-neutral-400">Next stage</dt>
          <dd className="font-medium mt-0.5">
            {snapshot.next_step?.label ?? 'Complete'}
            {snapshot.next_step?.stage_type ? (
              <span className="ml-1 text-xs text-neutral-500">({snapshot.next_step.stage_type})</span>
            ) : null}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-4 text-[11px] text-neutral-400">
        {snapshot.due_at ? <span>Due {new Date(snapshot.due_at).toLocaleString()}</span> : null}
        {snapshot.record_version ? <span>Record v{snapshot.record_version}</span> : null}
        {snapshot.approval_package_hash ? (
          <span title={snapshot.approval_package_hash}>Package {snapshot.approval_package_hash.slice(0, 10)}…</span>
        ) : null}
      </div>
      {impact ? (
        <div
          className={
            impact.is_material
              ? "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300"
              : "flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800 dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-300"
          }
        >
          <span className="material-symbols-outlined text-[16px]">
            {impact.is_material ? "history" : "verified"}
          </span>
          <span>
            <strong>{impact.is_material ? "Full re-approval on resubmit. " : "Prior approvals preserved. "}</strong>
            {impact.message}
          </span>
        </div>
      ) : null}
    </div>
  );
}
