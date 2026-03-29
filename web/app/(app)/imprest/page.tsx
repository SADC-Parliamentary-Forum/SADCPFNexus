"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { imprestApi, type ImprestRequest } from "@/lib/api";
import { useFormatDate } from "@/lib/useFormatDate";

const statusConfig: Record<string, { label: string; cls: string }> = {
  approved:   { label: "Approved",   cls: "badge-success" },
  submitted:  { label: "Submitted",  cls: "badge-warning" },
  rejected:   { label: "Rejected",   cls: "badge-danger"  },
  draft:      { label: "Draft",      cls: "badge-muted"   },
  liquidated: { label: "Liquidated", cls: "badge-success" },
};

const FILTERS = ["All", "Draft", "Submitted", "Approved", "Liquidated"] as const;
const filterMap: Record<string, string | undefined> = {
  All: undefined, Draft: "draft", Submitted: "submitted", Approved: "approved", Liquidated: "liquidated",
};

export default function ImprestPage() {
  const { fmt: formatDateShort } = useFormatDate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: requests = [], isLoading: loading } = useQuery({
    queryKey: ["imprest", "list", statusFilter],
    queryFn: () => {
      const status = filterMap[statusFilter];
      return imprestApi.list(status ? { status } : undefined).then((res) => (res.data as any).data as ImprestRequest[]);
    },
    staleTime: 30_000,
  });

  const toggleSelect = (id: number) => setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () => setSelected((prev) => prev.size === requests.length ? new Set() : new Set(requests.map((r) => r.id)));

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map((id) => imprestApi.delete(id)));
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["imprest", "list"] });
    } catch { setError("Some deletions failed."); }
    finally { setBulkLoading(false); }
  };

  const handleBulkSubmit = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selected].map((id) => imprestApi.submit(id)));
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["imprest", "list"] });
    } catch { setError("Some submissions failed."); }
    finally { setBulkLoading(false); }
  };

  const pendingCount = requests.filter((r) => r.status === "submitted").length;
  const unliquidated = requests.filter(
    (r) => r.status === "approved" && (!r.amount_liquidated || r.amount_liquidated === 0)
  ).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Imprest Requests</h1>
          <p className="page-subtitle">Manage petty cash requests and liquidations.</p>
        </div>
        <Link href="/imprest/create" className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Request
        </Link>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending Approval", value: String(pendingCount),        icon: "pending_actions",         color: "text-amber-600", bg: "bg-amber-50"  },
          { label: "Unliquidated",     value: String(unliquidated),         icon: "account_balance_wallet",  color: "text-primary",   bg: "bg-primary/10"},
          { label: "Total This View",  value: String(requests.length),     icon: "receipt_long",            color: "text-purple-600",bg: "bg-purple-50" },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">{stat.label}</p>
                <p className="text-xl font-bold text-neutral-900 mt-1">{stat.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${stat.color} text-[20px]`}>{stat.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs + bulk toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)} className={`filter-tab ${statusFilter === f ? "active" : ""}`}>{f}</button>
          ))}
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2">
            <span className="text-xs font-semibold text-primary">{selected.size} selected</span>
            {statusFilter === "Draft" && (
              <>
                <button type="button" disabled={bulkLoading} onClick={handleBulkSubmit}
                  className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:underline disabled:opacity-50">
                  <span className="material-symbols-outlined text-[14px]">send</span>Submit all
                </button>
                <button type="button" disabled={bulkLoading} onClick={handleBulkDelete}
                  className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                  <span className="material-symbols-outlined text-[14px]">delete</span>Delete all
                </button>
              </>
            )}
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-neutral-400 hover:text-neutral-600">Clear</button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-neutral-400">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      ) : requests.length > 0 ? (
        <div className="space-y-3">
          {requests.length > 1 && (
            <div className="flex items-center gap-2 px-1">
              <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 accent-primary"
                checked={selected.size === requests.length} onChange={toggleAll} />
              <span className="text-xs text-neutral-500">Select all</span>
            </div>
          )}
          {requests.map((req) => {
            const s = statusConfig[req.status] ?? { label: req.status, cls: "badge-muted" };
            const isSelected = selected.has(req.id);
            return (
              <div key={req.id} className={`card p-5 hover:shadow-elevated transition-all ${isSelected ? "border-primary/30 bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex flex-col items-center gap-2 flex-shrink-0">
                      <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 accent-primary mt-1"
                        checked={isSelected} onChange={() => toggleSelect(req.id)} />
                    </div>
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50">
                      <span className="material-symbols-outlined text-amber-600 text-[20px]">account_balance_wallet</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-neutral-400">{req.reference_number}</span>
                        <span className={`badge ${s.cls}`}>{s.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-neutral-900 truncate">{req.purpose}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-neutral-500">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">receipt</span>
                          {req.budget_line}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">event</span>
                          Liquidate by {formatDateShort(req.expected_liquidation_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Amount</p>
                    <p className="text-base font-bold text-neutral-900 mt-0.5">
                      {req.currency} {req.amount_requested.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 mt-3 pt-3 border-t border-neutral-50">
                  {req.status === "draft" && (
                    <Link href={`/imprest/create?edit=${req.id}`} className="text-xs font-semibold text-primary hover:underline">Edit</Link>
                  )}
                  {req.status === "approved" && (!req.amount_liquidated || req.amount_liquidated === 0) && (
                    <Link href={`/imprest/${req.id}`} className="text-xs font-semibold text-amber-600 hover:underline">Retire →</Link>
                  )}
                  <Link href={`/imprest/${req.id}`} className="text-xs font-medium text-neutral-500 hover:text-neutral-700">View Details →</Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 mx-auto">
            <span className="material-symbols-outlined text-4xl text-neutral-300">account_balance_wallet</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-neutral-600">No imprest requests found</p>
          <p className="text-xs text-neutral-400 mt-1">
            {statusFilter === "All" ? "Create a petty cash request to get started." : `No ${statusFilter.toLowerCase()} requests.`}
          </p>
          <Link href="/imprest/create" className="btn-primary mt-5 inline-flex">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Imprest Request
          </Link>
        </div>
      )}
    </div>
  );
}
