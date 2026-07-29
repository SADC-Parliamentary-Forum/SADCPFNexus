"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi, type Assignment } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import {
  BulkSelectionBar,
  RowCheckbox,
  SelectAllCheckbox,
  selectionColumnClass,
} from "@/components/ui/BulkSelectionBar";
import { useRowSelection } from "@/lib/useRowSelection";

const priorityConfig: Record<string, { label: string; cls: string }> = {
  low: { label: "Low", cls: "badge-muted" },
  medium: { label: "Medium", cls: "badge-primary" },
  high: { label: "High", cls: "badge-warning" },
  urgent: { label: "Urgent", cls: "badge-warning" },
  critical: { label: "Critical", cls: "badge-danger" },
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "badge-muted" },
  issued: { label: "Issued", cls: "badge-primary" },
  awaiting_acceptance: { label: "Awaiting Acceptance", cls: "badge-warning" },
  accepted: { label: "Accepted", cls: "badge-primary" },
  active: { label: "Active", cls: "badge-success" },
  at_risk: { label: "At Risk", cls: "badge-warning" },
  blocked: { label: "Blocked", cls: "badge-danger" },
  delayed: { label: "Delayed", cls: "badge-danger" },
  completed: { label: "Completed", cls: "badge-success" },
  closed: { label: "Closed", cls: "badge-muted" },
  returned: { label: "Returned", cls: "badge-warning" },
  cancelled: { label: "Cancelled", cls: "badge-muted" },
};

type Fetcher = (params: Record<string, string>) => Promise<{ data: unknown }>;

export function AssignmentFilteredList({
  title,
  subtitle,
  queryKey,
  fetcher,
  fixedParams = {},
}: {
  title: string;
  subtitle: string;
  queryKey: string;
  fetcher: Fetcher;
  fixedParams?: Record<string, string>;
}) {
  const [density, setDensity] = useState<RegisterDensity>("comfortable");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["assignments", queryKey, fixedParams],
    queryFn: async () => {
      const res = await fetcher({ per_page: "50", ...fixedParams });
      const body = res.data as { data?: Assignment[] } | Assignment[];
      if (Array.isArray(body)) return body;
      return (body.data ?? []) as Assignment[];
    },
    staleTime: 30_000,
  });

  const assignments = data ?? [];
  const getId = useCallback((row: Assignment) => row.id, []);
  const selection = useRowSelection({
    rows: assignments,
    getId,
  });

  const handleExportSelected = () => {
    const selected = assignments.filter((row) => selection.isSelected(row.id));
    if (selected.length === 0) return;
    exportToCsv(
      `assignments-selected-${new Date().toISOString().slice(0, 10)}.csv`,
      selected.map((a) => ({
        reference: a.reference_number,
        title: a.title,
        status: a.status,
        priority: a.priority,
        assignee: a.assignee?.name ?? "",
        due_date: a.due_date ?? "",
        progress: a.progress_percent ?? "",
      })),
      [
        { key: "reference", header: "Reference" },
        { key: "title", header: "Title" },
        { key: "status", header: "Status" },
        { key: "priority", header: "Priority" },
        { key: "assignee", header: "Assignee" },
        { key: "due_date", header: "Due date" },
        { key: "progress", header: "Progress %" },
      ],
    );
  };

  return (
    <RegisterShell
      title={title}
      subtitle={subtitle}
      density={density}
      onDensityChange={setDensity}
      loading={isLoading}
      actions={
        <Link href="/assignments/create" className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add_task</span>
          New Assignment
        </Link>
      }
      stats={
        isError ? <p className="text-sm text-red-600">Failed to load assignments.</p> : null
      }
      bulkBar={
        <BulkSelectionBar count={selection.selectedCount} onClear={selection.clear}>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={selection.selectedCount === 0}
            onClick={handleExportSelected}
          >
            Export selected
          </button>
        </BulkSelectionBar>
      }
      empty={
        !isLoading && !isError && assignments.length === 0 ? (
          <div className="card p-8 text-center text-neutral-500 text-sm">No assignments in this view.</div>
        ) : null
      }
    >
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className={selectionColumnClass.th}>
                <SelectAllCheckbox
                  checked={selection.allSelectableSelected}
                  indeterminate={selection.someSelectableSelected && !selection.allSelectableSelected}
                  onChange={selection.toggleAllSelectable}
                />
              </th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Progress</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => {
              const p = priorityConfig[a.priority] ?? { label: a.priority, cls: "badge-muted" };
              const s = statusConfig[a.status] ?? { label: a.status, cls: "badge-muted" };
              const overdue = a.is_overdue_flag || a.deadline_state === "overdue";
              return (
                <tr key={a.id} className="border-t border-neutral-100 hover:bg-neutral-50/80">
                  <td className={selectionColumnClass.td}>
                    <RowCheckbox
                      checked={selection.isSelected(a.id)}
                      onChange={() => selection.toggle(a.id)}
                      label={`Select ${a.reference_number}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-neutral-400">
                    <Link href={`/assignments/${a.id}`} className="text-primary hover:underline">
                      {a.reference_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/assignments/${a.id}`} className="font-semibold text-neutral-900 hover:underline">
                      {a.title}
                    </Link>
                    {overdue ? <span className="ml-2 badge badge-danger">Overdue</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${p.cls}`}>{p.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{a.assignee?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{formatDateShort(a.due_date)}</td>
                  <td className="px-4 py-3 text-xs text-neutral-400">{a.progress_percent}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </RegisterShell>
  );
}

export { assignmentsApi };
