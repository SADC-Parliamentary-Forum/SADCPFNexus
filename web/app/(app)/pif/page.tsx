"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { programmeApi, type Programme } from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import {
  DEFAULT_PAGE_SIZE,
  clientPageCount,
  getListData,
  slicePage,
} from "@/lib/listPagination";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

const STATUS_BADGE: Record<string, string> = {
  draft: "badge-muted",
  submitted: "badge-warning",
  approved: "badge-success",
  active: "badge-success",
  on_hold: "badge-warning",
  completed: "badge-success",
  financially_closed: "badge-muted",
  archived: "badge-muted",
};

const STATUS_LABELS = ["All", "draft", "submitted", "approved", "active", "on_hold", "completed"] as const;

function formatBudget(currency: string | null | undefined, amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(Number(amount))) return "—";
  return formatCurrency(Number(amount), currency?.trim() || "NAD");
}

function statusLabel(status: string | null | undefined): string {
  if (!status) return "unknown";
  return status.replace(/_/g, " ");
}

function responsibleOfficerLabel(programme: Programme): string {
  const value = (programme as Programme & { responsible_officer?: unknown }).responsible_officer;
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name;
  }
  return "—";
}

export default function PifPage() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [page, setPage] = useState(1);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    programmeApi
      .list({ per_page: 100 })
      .then((r) => {
        if (cancelled) return;
        setProgrammes(getListData<Programme>(r.data));
      })
      .catch(() => {
        if (cancelled) return;
        setProgrammes([]);
        setError("Failed to load programmes.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programmes.filter((row) => {
      if (filterStatus !== "All" && row.status !== filterStatus) return false;
      if (!q) return true;
      const hay = [
        row.reference_number,
        row.title,
        row.status,
        row.funding_source,
        responsibleOfficerLabel(row),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [programmes, filterStatus, search]);

  const lastPage = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const safePage = Math.min(page, lastPage);
  const paged = useMemo(
    () => slicePage(filtered, safePage, DEFAULT_PAGE_SIZE),
    [filtered, safePage],
  );

  const stats = ["active", "submitted", "completed", "on_hold"].map((s) => ({
    status: s,
    count: programmes.filter((p) => p.status === s).length,
  }));

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `pif-programmes-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((p) => ({
        reference: p.reference_number ?? "",
        title: p.title ?? "",
        status: p.status ?? "",
        funding_source: p.funding_source ?? "",
        currency: p.primary_currency ?? "",
        total_budget: p.total_budget ?? "",
        responsible_officer: responsibleOfficerLabel(p),
        end_date: p.end_date ?? "",
      })),
      [
        { key: "reference", header: "Code" },
        { key: "title", header: "Title" },
        { key: "status", header: "Status" },
        { key: "funding_source", header: "Funding Source" },
        { key: "currency", header: "Currency" },
        { key: "total_budget", header: "Budget" },
        { key: "responsible_officer", header: "Responsible" },
        { key: "end_date", header: "End Date" },
      ],
    );
  };

  return (
    <RegisterShell
      title="Programmes"
      subtitle="Programme Implementation Framework — manage and track all funded programmes."
      breadcrumbs={<PageBreadcrumbs items={[{ label: "Programmes (PIF)" }]} />}
      density={density}
      onDensityChange={setDensity}
      page={safePage}
      pageCount={lastPage}
      total={filtered.length}
      onPageChange={setPage}
      loading={loading}
      actions={
        <>
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <Link href="/pif/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Programme
          </Link>
        </>
      }
      stats={
        <>
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="material-symbols-outlined text-[18px]">error_outline</span>
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map(({ status, count }) => (
              <div key={status} className="card p-4 text-center">
                <p className="text-2xl font-bold text-neutral-900">{loading ? "—" : count}</p>
                <p className="mt-0.5 text-xs capitalize text-neutral-500">{status.replace("_", " ")}</p>
              </div>
            ))}
          </div>
        </>
      }
      filters={
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative max-w-sm flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              placeholder="Search programmes…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="form-input pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_LABELS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setFilterStatus(s);
                  setPage(1);
                }}
                className={`filter-tab capitalize ${filterStatus === s ? "active" : ""}`}
              >
                {s === "All" ? "All" : s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      }
      empty={
        !loading && filtered.length === 0 && !error ? (
          <div className="card overflow-hidden">
            <EmptyState
              icon="account_tree"
              title="No programmes found"
              description={
                filterStatus === "All" && !search
                  ? "Start a Programme Implementation Form to track activities, budget, and approvals."
                  : "No rows match the current filters."
              }
              action={
                <Link href="/pif/create" className="btn-primary text-sm">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  New Programme
                </Link>
              }
            />
          </div>
        ) : undefined
      }
    >
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
              <caption className="sr-only">Programme implementation register</caption>
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Status</th>
                <th>Funding Source</th>
                <th>Budget</th>
                <th>Responsible</th>
                <th>End Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs text-neutral-600">{p.reference_number || "—"}</td>
                  <td className="max-w-[220px] font-medium text-neutral-900">
                    <p className="truncate">{p.title || "—"}</p>
                  </td>
                  <td>
                    <span className={`badge capitalize ${STATUS_BADGE[p.status] ?? "badge-muted"}`}>
                      {statusLabel(p.status)}
                    </span>
                  </td>
                  <td className="text-neutral-600">{p.funding_source || "—"}</td>
                  <td className="font-medium text-neutral-700">
                    {formatBudget(p.primary_currency, p.total_budget)}
                  </td>
                  <td className="text-neutral-600">{responsibleOfficerLabel(p)}</td>
                  <td className="text-xs text-neutral-500">{formatDateShort(p.end_date)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/pif/${p.id}`} className="text-xs font-medium text-primary hover:underline">
                        View
                      </Link>
                      {(p.status === "draft" || p.status === "amendment_draft") && (
                        <Link
                          href={`/pif/${p.id}/edit`}
                          className="text-xs font-medium text-neutral-600 hover:underline"
                        >
                          Edit
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </RegisterShell>
  );
}
