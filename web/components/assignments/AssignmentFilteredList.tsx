"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { assignmentsApi, type Assignment } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  BulkSelectionBar,
  RowCheckbox,
  SelectAllCheckbox,
  selectionColumnClass,
} from "@/components/ui/BulkSelectionBar";
import { useRowSelection } from "@/lib/useRowSelection";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const priorityConfig: Record<string, { label: string; cls: string }> = {
  low: { label: "assignments.filteredList.priority.low", cls: "badge-muted" },
  medium: { label: "assignments.filteredList.priority.medium", cls: "badge-primary" },
  high: { label: "assignments.filteredList.priority.high", cls: "badge-warning" },
  urgent: { label: "assignments.filteredList.priority.urgent", cls: "badge-warning" },
  critical: { label: "assignments.filteredList.priority.critical", cls: "badge-danger" },
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft: { label: "assignments.filteredList.status.draft", cls: "badge-muted" },
  issued: { label: "assignments.filteredList.status.issued", cls: "badge-primary" },
  awaiting_acceptance: { label: "assignments.filteredList.status.awaiting_acceptance", cls: "badge-warning" },
  accepted: { label: "assignments.filteredList.status.accepted", cls: "badge-primary" },
  active: { label: "assignments.filteredList.status.active", cls: "badge-success" },
  at_risk: { label: "assignments.filteredList.status.at_risk", cls: "badge-warning" },
  blocked: { label: "assignments.filteredList.status.blocked", cls: "badge-danger" },
  delayed: { label: "assignments.filteredList.status.delayed", cls: "badge-danger" },
  completed: { label: "assignments.filteredList.status.completed", cls: "badge-success" },
  closed: { label: "assignments.filteredList.status.closed", cls: "badge-muted" },
  returned: { label: "assignments.filteredList.status.returned", cls: "badge-warning" },
  cancelled: { label: "assignments.filteredList.status.cancelled", cls: "badge-muted" },
};

type Fetcher = (params: Record<string, string>) => Promise<{ data: unknown }>;

export function AssignmentFilteredList({
  title,
  subtitle,
  queryKey,
  fetcher,
  fixedParams = {},
  emptyTitle,
  emptyIcon = "assignment",
}: {
  title: string;
  subtitle: string;
  queryKey: string;
  fetcher: Fetcher;
  fixedParams?: Record<string, string>;
  emptyTitle?: string;
  emptyIcon?: string;
}) {
  const { t } = useI18n();
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
        { key: "reference", header: t("assignments.filteredList.col.reference") },
        { key: "title", header: t("assignments.filteredList.col.title") },
        { key: "status", header: t("assignments.filteredList.col.status") },
        { key: "priority", header: t("assignments.filteredList.col.priority") },
        { key: "assignee", header: t("assignments.filteredList.col.assignee") },
        { key: "due_date", header: t("assignments.filteredList.col.dueDate") },
        { key: "progress", header: t("assignments.filteredList.col.progressPct") },
      ],
    );
  };

  return (
    <RegisterShell
      title={title}
      subtitle={subtitle}
      breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.assignments", href: "/assignments" }, { label: title }]} />}
      density={density}
      onDensityChange={setDensity}
      loading={isLoading}
      actions={
        <Link href="/assignments/create" className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add_task</span>
          {t("assignments.filteredList.new")}
        </Link>
      }
      stats={
        isError ? <p className="text-sm text-red-600">{t("assignments.filteredList.loadFailed")}</p> : null
      }
      bulkBar={
        <BulkSelectionBar count={selection.selectedCount} onClear={selection.clear}>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={selection.selectedCount === 0}
            onClick={handleExportSelected}
          >
            {t("assignments.filteredList.exportSelected")}
          </button>
        </BulkSelectionBar>
      }
      empty={
        !isLoading && !isError && assignments.length === 0 ? (
          <EmptyState icon={emptyIcon} title={emptyTitle ?? t("assignments.filteredList.empty")} />
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
              <th className="px-4 py-3">{t("assignments.filteredList.col.reference")}</th>
              <th className="px-4 py-3">{t("assignments.filteredList.col.title")}</th>
              <th className="px-4 py-3">{t("assignments.filteredList.col.status")}</th>
              <th className="px-4 py-3">{t("assignments.filteredList.col.priority")}</th>
              <th className="px-4 py-3">{t("assignments.filteredList.col.assignee")}</th>
              <th className="px-4 py-3">{t("assignments.filteredList.col.due")}</th>
              <th className="px-4 py-3">{t("assignments.filteredList.col.progress")}</th>
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
                      label={t("assignments.filteredList.selectRow", { reference: a.reference_number })}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-neutral-400">
                    <Link href={`/assignments/${a.id}`} className="font-mono text-[10px] text-primary">
                      {a.reference_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/assignments/${a.id}`} className="font-semibold text-neutral-900">
                      {a.title}
                    </Link>
                    {overdue ? <span className="ml-2 badge badge-danger">{t("assignments.filteredList.overdue")}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${s.cls}`}>{statusConfig[a.status] ? t(s.label) : s.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${p.cls}`}>{priorityConfig[a.priority] ? t(p.label) : p.label}</span>
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
