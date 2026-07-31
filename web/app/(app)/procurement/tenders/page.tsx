"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tendersApi, type ProcurementTender } from "@/lib/api";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import {
  BulkSelectionBar,
  RowCheckbox,
  SelectAllCheckbox,
  selectionColumnClass,
} from "@/components/ui/BulkSelectionBar";
import { useRowSelection } from "@/lib/useRowSelection";
import { clientPageCount, DEFAULT_PAGE_SIZE, slicePage } from "@/lib/listPagination";
import { useToast } from "@/components/ui/Toast";

const STATUS_FILTERS = [
  "all",
  "draft",
  "published",
  "closed",
  "opened",
  "evaluating",
  "awarded",
  "cancelled",
] as const;

export default function TendersPage() {
  const { success, error: showErrorToast, info } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<RegisterDensity>("comfortable");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["procurement", "tenders", status],
    queryFn: () =>
      tendersApi.list(status !== "all" ? { status } : undefined).then((r) => r.data.data),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data ?? [];
    if (!q) return list;
    return list.filter(
      (t) =>
        t.reference_number.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q),
    );
  }, [data, search]);

  const pageCount = clientPageCount(rows.length, DEFAULT_PAGE_SIZE);
  const pageRows = slicePage(rows, page, DEFAULT_PAGE_SIZE);

  const selection = useRowSelection<ProcurementTender>({
    rows: pageRows,
    getId: (t) => t.id,
    canSelect: (t) => t.status === "draft" || t.status === "published",
  });

  const cancelMut = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => tendersApi.cancel(id, "Bulk cancelled from register")),
      );
      return results;
    },
    onSuccess: (results) => {
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      if (fail) showErrorToast(`Cancelled ${ok}; ${fail} failed.`);
      else success(`Cancelled ${ok} tender(s).`);
      selection.clear();
      qc.invalidateQueries({ queryKey: ["procurement", "tenders"] });
    },
    onError: () => setError("Bulk cancel failed."),
    onSettled: () => setBulkLoading(false),
  });

  const handleBulkCancel = () => {
    const ids = selection.selectedIds.map(Number).filter((id) => Number.isFinite(id));
    if (ids.length === 0) return;
    setBulkLoading(true);
    setError(null);
    cancelMut.mutate(ids);
  };

  return (
    <RegisterShell
      title="Tenders"
      subtitle="Open tender notices, sealed submissions, and evaluation lifecycle."
      density={density}
      onDensityChange={setDensity}
      page={page}
      pageCount={pageCount}
      total={rows.length}
      onPageChange={(p) => {
        setPage(p);
        selection.clear();
      }}
      loading={isLoading}
      stats={
        error || isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error ?? "Failed to load tenders."}
          </div>
        ) : null
      }
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1 block text-xs font-semibold text-neutral-600">Search</label>
            <input
              className="form-input text-sm"
              placeholder="Reference or title…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2 pb-0.5">
            {STATUS_FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStatus(key);
                  setPage(1);
                  selection.clear();
                }}
                className={`filter-tab ${status === key ? "active" : ""}`}
              >
                {key === "all" ? "All" : key}
              </button>
            ))}
          </div>
        </div>
      }
      bulkBar={
        <BulkSelectionBar count={selection.selectedCount} onClear={selection.clear} disabled={bulkLoading}>
          <button
            type="button"
            disabled={bulkLoading}
            onClick={handleBulkCancel}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            {bulkLoading ? "Cancelling…" : "Cancel selected drafts/published"}
          </button>
        </BulkSelectionBar>
      }
      empty={
        !isLoading && !isError && rows.length === 0 ? (
          <div className="card p-8 text-center text-sm text-neutral-400">
            No tenders yet. Create from an approved tender-method request.
          </div>
        ) : undefined
      }
    >
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
              <caption className="sr-only">Procurement tenders register</caption>
          <thead>
            <tr className="border-b text-left text-xs text-neutral-500">
              <th className={selectionColumnClass.th}>
                <SelectAllCheckbox
                  checked={selection.allSelectableSelected}
                  indeterminate={selection.someSelectableSelected && !selection.allSelectableSelected}
                  onChange={selection.toggleAllSelectable}
                />
              </th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Deadline</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => {
              const selectable = t.status === "draft" || t.status === "published";
              return (
                <tr key={t.id} className="border-b border-neutral-50 hover:bg-neutral-50/80">
                  <td className={selectionColumnClass.td}>
                    {selectable ? (
                      <RowCheckbox
                        checked={selection.isSelected(t.id)}
                        onChange={() => selection.toggle(t.id)}
                        label={`Select ${t.reference_number}`}
                      />
                    ) : (
                      <span className="inline-block w-4" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/procurement/tenders/${t.id}`} className="font-semibold text-primary hover:underline">
                      {t.reference_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-800">{t.title}</td>
                  <td className="px-4 py-3 text-neutral-500">{t.submission_deadline ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs uppercase tracking-wide text-neutral-600">{t.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </RegisterShell>
  );
}
