"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { invoicesApi, type Invoice } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  received: { label: "Received", cls: "badge-warning",  icon: "inbox"         },
  matched:  { label: "Matched",  cls: "badge-primary",  icon: "link"          },
  approved: { label: "Approved", cls: "badge-success",  icon: "check_circle"  },
  rejected: { label: "Rejected", cls: "badge-danger",   icon: "cancel"        },
  paid:     { label: "Paid",     cls: "badge-muted",    icon: "payments"      },
};

const matchConfig: Record<string, { label: string; cls: string; icon: string }> = {
  pending:  { label: "Pending",  cls: "text-neutral-400", icon: "hourglass_empty" },
  matched:  { label: "Matched",  cls: "text-green-600",   icon: "check_circle"    },
  variance: { label: "Variance", cls: "text-amber-600",   icon: "warning"         },
};

const FILTERS = ["all", "received", "matched", "approved", "rejected", "paid"];

export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () =>
      invoicesApi.list(statusFilter !== "all" ? { status: statusFilter } : undefined)
        .then((r) => r.data),
  });

  const items: Invoice[] = (data as { data?: Invoice[] })?.data ?? [];
  const total    = items.length;
  const pending  = items.filter((i) => i.match_status === "pending").length;
  const matched  = items.filter((i) => i.match_status === "matched").length;
  const approved = items.filter((i) => i.status === "approved" || i.status === "paid").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">3-way matching and invoice approval workflow</p>
        </div>
        <Link href="/procurement" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Procurement
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total",        value: total,    icon: "request_quote", color: "text-primary",   bg: "bg-primary/10"  },
          { label: "Pending Match",value: pending,  icon: "hourglass_empty",color: "text-amber-600", bg: "bg-amber-50"   },
          { label: "Matched",      value: matched,  icon: "link",          color: "text-blue-600",  bg: "bg-blue-50"     },
          { label: "Approved/Paid",value: approved, icon: "check_circle",  color: "text-green-600", bg: "bg-green-50"    },
        ].map((k) => (
          <div key={k.label} className="card p-4 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.bg} flex-shrink-0`}>
              <span className={`material-symbols-outlined text-[22px] ${k.color}`}>{k.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{k.value}</p>
              <p className="text-xs text-neutral-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`filter-tab capitalize ${statusFilter === f ? "active" : ""}`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-neutral-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-neutral-100 rounded" />
                <div className="h-4 w-56 bg-neutral-100 rounded" />
              </div>
              <div className="h-6 w-20 bg-neutral-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="card p-6 text-center text-sm text-red-600">Failed to load invoices.</div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-neutral-300">request_quote</span>
          <p className="text-sm text-neutral-500">No invoices found.</p>
          <p className="text-xs text-neutral-400">Record an invoice against a received purchase order.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>INV Reference</th>
                <th>Vendor</th>
                <th>Purchase Order</th>
                <th className="text-right">Amount</th>
                <th>Due Date</th>
                <th>Match</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((inv) => {
                const s = statusConfig[inv.status] ?? statusConfig.received;
                const m = matchConfig[inv.match_status] ?? matchConfig.pending;
                return (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/procurement/invoices/${inv.id}`} className="font-mono text-xs text-primary hover:underline">
                        {inv.reference_number}
                      </Link>
                      <p className="text-[11px] text-neutral-400 font-mono">{inv.vendor_invoice_number}</p>
                    </td>
                    <td className="text-sm font-medium text-neutral-800">{inv.vendor?.name ?? "—"}</td>
                    <td>
                      {inv.purchase_order ? (
                        <Link href={`/procurement/purchase-orders/${inv.purchase_order_id}`} className="text-xs text-neutral-500 hover:text-primary font-mono">
                          {inv.purchase_order.reference_number}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="text-right font-semibold text-neutral-900 text-sm">
                      {inv.currency} {Number(inv.amount).toLocaleString()}
                    </td>
                    <td className="text-sm text-neutral-500">
                      {inv.due_date ? formatDateShort(inv.due_date) : "—"}
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${m.cls}`}>
                        <span className="material-symbols-outlined text-[13px]">{m.icon}</span>
                        {m.label}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${s.cls} inline-flex items-center gap-1`}>
                        <span className="material-symbols-outlined text-[11px]">{s.icon}</span>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
