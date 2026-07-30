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
  } | null;
}) {
  if (!snapshot) return null;

  const holders = snapshot.currently_with ?? [];

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
    </div>
  );
}
