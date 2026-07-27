"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { travelApi, type TravelRequest } from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  approved: { label: "Approved", badge: "badge-success" },
  submitted: { label: "Submitted", badge: "badge-warning" },
  resubmitted: { label: "Resubmitted", badge: "badge-warning" },
  rejected: { label: "Rejected", badge: "badge-danger" },
  draft: { label: "Draft", badge: "badge-muted" },
  cancelled: { label: "Cancelled", badge: "badge-muted" },
  withdrawn: { label: "Withdrawn", badge: "badge-muted" },
  returned_for_correction: { label: "Returned", badge: "badge-warning" },
  amendment_pending: { label: "Amendment", badge: "badge-warning" },
};

export type TravelQueueVariant = "approval" | "finance" | "admin" | "director-finance" | "retirement";

function unwrapList(payload: unknown): TravelRequest[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { data?: unknown };
  const data = root.data ?? payload;
  if (Array.isArray(data)) return data as TravelRequest[];
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: TravelRequest[] }).data;
  }
  return [];
}

function destinationOf(row: TravelRequest): string {
  return (
    [row.destination_city, row.destination_country].filter(Boolean).join(", ") ||
    row.destination_country ||
    "—"
  );
}

function dsaOf(row: TravelRequest): number {
  return Number(row.finance_dsa_total ?? row.actual_dsa ?? row.estimated_dsa ?? 0);
}

export function TravelQueueTable({
  queue,
  title,
  subtitle,
  variant,
  emptyHint,
}: {
  queue: string;
  title: string;
  subtitle: string;
  variant: TravelQueueVariant;
  emptyHint?: string;
}) {
  const [rows, setRows] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await travelApi.list({ queue, per_page: 100 });
      setRows(unwrapList(res.data));
    } catch {
      setError("Failed to load this queue.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [queue]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.reference_number,
        row.purpose,
        row.destination_country,
        row.destination_city,
        row.requester?.name,
        row.status,
        row.finance_status,
        row.retirement_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `travel-queue-${queue}-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        reference: r.reference_number,
        purpose: r.purpose,
        destination: destinationOf(r),
        requester: r.requester?.name ?? "",
        status: r.status,
        finance_status: r.finance_status ?? "",
        estimated_dsa: r.estimated_dsa ?? "",
        finance_dsa_total: r.finance_dsa_total ?? r.actual_dsa ?? "",
        retirement_status: r.retirement_status ?? "",
        retirement_due_at: r.retirement_due_at ?? "",
        departure_date: r.departure_date ?? "",
        return_date: r.return_date ?? "",
      })),
      [
        { key: "reference", header: "Reference" },
        { key: "purpose", header: "Purpose" },
        { key: "destination", header: "Destination" },
        { key: "requester", header: "Requester" },
        { key: "status", header: "Status" },
        { key: "finance_status", header: "Finance status" },
        { key: "estimated_dsa", header: "Est. DSA" },
        { key: "finance_dsa_total", header: "Finance DSA" },
        { key: "retirement_status", header: "Retirement status" },
        { key: "retirement_due_at", header: "Retirement due" },
        { key: "departure_date", header: "Departure" },
        { key: "return_date", header: "Return" },
      ],
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Link href="/travel" className="transition-colors hover:text-neutral-700">
              Travel
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">{title}</span>
          </div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <Link href="/travel/register" className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
            Register
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">{error}</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "In queue", value: rows.length, icon: "inbox", color: "text-primary", bg: "bg-primary/10" },
            {
              label: "Matching filter",
              value: filtered.length,
              icon: "filter_alt",
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              label: "DSA total (shown)",
              value: formatCurrency(filtered.reduce((sum, r) => sum + dsaOf(r), 0)),
              icon: "payments",
              color: "text-green-600",
              bg: "bg-green-50",
            },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-500">{s.label}</p>
                  <p className="mt-0.5 text-lg font-bold text-neutral-900">{s.value}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg}`}>
                  <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-4">
        <div className="relative max-w-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[20px]">
            search
          </span>
          <input
            type="search"
            className="form-input pl-10"
            placeholder="Search reference, purpose, destination…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <span className="material-symbols-outlined mb-2 block text-[40px] text-neutral-300">inbox</span>
            <p className="text-sm font-semibold text-neutral-600">
              {rows.length === 0 ? "No items in this queue" : "No matches for your search"}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {emptyHint ?? (rows.length === 0 ? "Nothing awaiting action right now." : "Try a different search term.")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Purpose</th>
                  {(variant === "approval" || variant === "admin") && <th>Destination</th>}
                  {(variant === "approval" || variant === "admin") && <th>Requester</th>}
                  {variant === "finance" && <th>Est. DSA</th>}
                  {variant === "finance" && <th>Finance status</th>}
                  {variant === "director-finance" && <th>DSA total</th>}
                  {variant === "retirement" && <th>Retirement</th>}
                  {variant === "retirement" && <th>Due</th>}
                  {(variant === "approval" || variant === "admin" || variant === "director-finance") && (
                    <th>Status</th>
                  )}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const sc = STATUS_CONFIG[t.status] ?? { label: t.status, badge: "badge-muted" };
                  return (
                    <tr key={t.id}>
                      <td className="font-mono text-xs text-neutral-600">{t.reference_number}</td>
                      <td className="max-w-[220px] truncate font-medium text-neutral-900">{t.purpose}</td>
                      {(variant === "approval" || variant === "admin") && (
                        <td className="text-sm text-neutral-600">{destinationOf(t)}</td>
                      )}
                      {(variant === "approval" || variant === "admin") && (
                        <td className="text-sm text-neutral-600">{t.requester?.name ?? "—"}</td>
                      )}
                      {variant === "finance" && (
                        <td className="whitespace-nowrap text-sm">
                          {formatCurrency(Number(t.estimated_dsa ?? 0))} {t.currency ?? ""}
                        </td>
                      )}
                      {variant === "finance" && (
                        <td>
                          <span className="badge badge-warning text-xs capitalize">
                            {(t.finance_status ?? "awaiting").replace(/_/g, " ")}
                          </span>
                        </td>
                      )}
                      {variant === "director-finance" && (
                        <td className="whitespace-nowrap font-semibold text-sm">
                          {formatCurrency(dsaOf(t))}
                        </td>
                      )}
                      {variant === "retirement" && (
                        <td>
                          <span className="badge badge-warning text-xs capitalize">
                            {(t.retirement_status ?? "pending").replace(/_/g, " ")}
                          </span>
                        </td>
                      )}
                      {variant === "retirement" && (
                        <td className="text-xs text-neutral-500 whitespace-nowrap">
                          {t.retirement_due_at ? formatDateShort(t.retirement_due_at) : "—"}
                        </td>
                      )}
                      {(variant === "approval" || variant === "admin" || variant === "director-finance") && (
                        <td>
                          <span className={`badge text-xs ${sc.badge}`}>{sc.label}</span>
                        </td>
                      )}
                      <td>
                        <Link
                          href={`/travel/${t.id}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
