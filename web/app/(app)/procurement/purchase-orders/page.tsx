"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi, type PurchaseOrder } from "@/lib/api";
import { formatDateShort, formatCurrency } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:              { label: "Draft",             cls: "badge-muted",    icon: "edit_note"      },
  issued:             { label: "Issued",            cls: "badge-primary",  icon: "send"           },
  partially_received: { label: "Part. Received",    cls: "badge-warning",  icon: "inventory"      },
  received:           { label: "Received",          cls: "badge-success",  icon: "inventory_2"    },
  invoiced:           { label: "Invoiced",          cls: "badge-primary",  icon: "request_quote"  },
  closed:             { label: "Closed",            cls: "badge-muted",    icon: "check_circle"   },
  cancelled:          { label: "Cancelled",         cls: "badge-danger",   icon: "cancel"         },
};

const FILTERS = ["all", "draft", "issued", "partially_received", "received", "closed", "cancelled"];

export default function PurchaseOrdersPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["purchase-orders", statusFilter],
    queryFn: () =>
      purchaseOrdersApi.list(statusFilter !== "all" ? { status: statusFilter } : undefined)
        .then((r) => r.data),
  });

  const items: PurchaseOrder[] = (data as { data?: PurchaseOrder[] })?.data ?? [];
  const total   = items.length;
  const issued  = items.filter((p) => p.status === "issued").length;
  const received = items.filter((p) => p.status === "received").length;
  const pending = items.filter((p) => ["draft", "issued", "partially_received"].includes(p.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-subtitle">Track issued POs, deliveries, and fulfilment</p>
        </div>
        <Link href="/procurement" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Requests
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total POs",   value: total,    icon: "receipt_long",  color: "text-primary",    bg: "bg-primary/10"   },
          { label: "Issued",      value: issued,   icon: "send",          color: "text-blue-600",   bg: "bg-blue-50"      },
          { label: "Received",    value: received, icon: "inventory_2",   color: "text-green-600",  bg: "bg-green-50"     },
          { label: "Pending",     value: pending,  icon: "pending",       color: "text-amber-600",  bg: "bg-amber-50"     },
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
            {f === "all" ? "All" : f.replace("_", " ")}
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
        <div className="card p-6 text-center text-sm text-red-600">Failed to load purchase orders.</div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-neutral-300">receipt_long</span>
          <p className="text-sm text-neutral-500">No purchase orders found.</p>
          <p className="text-xs text-neutral-400">Award a procurement request to generate a PO.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>PO Reference</th>
                <th>Vendor</th>
                <th>Linked Request</th>
                <th className="text-right">Total</th>
                <th>Expected Delivery</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((po) => {
                const s = statusConfig[po.status] ?? statusConfig.draft;
                return (
                  <tr key={po.id}>
                    <td>
                      <Link href={`/procurement/purchase-orders/${po.id}`} className="font-mono text-xs text-primary hover:underline">
                        {po.reference_number}
                      </Link>
                    </td>
                    <td className="text-sm font-medium text-neutral-800">{po.vendor?.name ?? "—"}</td>
                    <td>
                      {po.procurement_request ? (
                        <Link href={`/procurement/${po.procurement_request.id}`} className="text-xs text-neutral-500 hover:text-primary font-mono">
                          {po.procurement_request.reference_number}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="text-right font-semibold text-neutral-900 text-sm">
                      {po.currency} {(po.total_amount ?? 0).toLocaleString()}
                    </td>
                    <td className="text-sm text-neutral-500">
                      {po.expected_delivery_date ? formatDateShort(po.expected_delivery_date) : "—"}
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
