"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { financeApi, type Budget } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import { DEFAULT_PAGE_SIZE, clientPageCount, getListData, slicePage } from "@/lib/listPagination";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export default function BudgetDashboardPage() {
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "core" | "project">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    financeApi
      .listBudgets({ per_page: 100 })
      .then((res) => {
        setBudgets(getListData<Budget>(res.data));
      })
      .catch(() => setError("Failed to load budgets."))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (budget: Budget) => {
    if (
      !(await confirm({
        title: "Delete budget",
        message: `Delete budget "${budget.name}"? This cannot be undone.`,
        variant: "danger",
      }))
    ) return;
    setDeletingId(budget.id);
    financeApi
      .deleteBudget(budget.id)
      .then(() => setBudgets((prev) => prev.filter((b) => b.id !== budget.id)))
      .catch(() => setError("Failed to delete budget."))
      .finally(() => setDeletingId(null));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return budgets.filter((b) => {
      if (typeFilter !== "all" && b.type !== typeFilter) return false;
      if (!q) return true;
      const hay = [b.name, b.type, b.year, b.currency, b.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [budgets, search, typeFilter]);

  const lastPage = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const paged = useMemo(
    () => slicePage(filtered, Math.min(page, lastPage), DEFAULT_PAGE_SIZE),
    [filtered, page, lastPage],
  );

  const totalCore = budgets
    .filter((b) => b.type === "core")
    .reduce((acc, curr) => acc + Number(curr.total_amount), 0);
  const totalProject = budgets
    .filter((b) => b.type === "project")
    .reduce((acc, curr) => acc + Number(curr.total_amount), 0);

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `budgets-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((b) => ({
        name: b.name,
        type: b.type,
        year: b.year,
        currency: b.currency,
        total_amount: b.total_amount,
      })),
      [
        { key: "name", header: "Name" },
        { key: "type", header: "Type" },
        { key: "year", header: "Year" },
        { key: "currency", header: "Currency" },
        { key: "total_amount", header: "Total Amount" },
      ],
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/finance" className="hover:text-primary transition-colors">
          Finance
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Budgets</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <ModulePageHeader
        title="Budget Management"
        subtitle="Track core and project budgets, allocations, and expenditures"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Budget Management" }]} />}
      />
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <Link href="/finance/budget/upload" className="btn-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            Upload Budget
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="text-sm font-medium text-neutral-500 mb-1">Total Core Budget</div>
          <div className="text-2xl font-bold text-neutral-900">
            ${totalCore.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="card p-5">
          <div className="text-sm font-medium text-neutral-500 mb-1">Total Project Budget</div>
          <div className="text-2xl font-bold text-neutral-900">
            ${totalProject.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="card p-5 border-l-4 border-l-primary">
          <div className="text-sm font-medium text-neutral-500 mb-1">Total Managed Funds</div>
          <div className="text-2xl font-bold text-primary">
            ${(totalCore + totalProject).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="relative max-w-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
            search
          </span>
          <input
            type="search"
            className="form-input pl-10"
            placeholder="Search budgets…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: "All" },
              { key: "core", label: "Core" },
              { key: "project", label: "Project" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setTypeFilter(f.key);
                setPage(1);
              }}
              className={`filter-tab${typeFilter === f.key ? " active" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-neutral-800">Budget Portfolios</h2>
          <span className="text-xs text-neutral-400">{filtered.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Year</th>
                <th>Currency</th>
                <th className="text-right">Total Amount</th>
                <th className="text-right">Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j}>
                        <div className="h-3 bg-neutral-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-neutral-500 italic">
                    No budgets found.
                  </td>
                </tr>
              ) : (
                paged.map((budget) => (
                  <tr key={budget.id} className="hover:bg-neutral-50/50">
                    <td className="font-medium text-neutral-900">
                      <Link
                        href={`/finance/budget/${budget.id}`}
                        className="hover:text-primary transition-colors"
                      >
                        {budget.name}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`badge ${budget.type === "core" ? "badge-info" : "badge-success"} capitalize`}
                      >
                        {budget.type}
                      </span>
                    </td>
                    <td className="text-neutral-600">{budget.year}</td>
                    <td className="text-neutral-600">{budget.currency}</td>
                    <td className="text-right font-medium text-neutral-900">
                      {Number(budget.total_amount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="text-right">
                      <span className="badge badge-success">Active</span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/finance/budget/${budget.id}`}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          View
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(budget)}
                          disabled={deletingId === budget.id}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {deletingId === budget.id ? (
                            <span className="material-symbols-outlined text-[14px] animate-spin">
                              progress_activity
                            </span>
                          ) : (
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                          )}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ListPagination
          page={Math.min(page, lastPage)}
          lastPage={lastPage}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
