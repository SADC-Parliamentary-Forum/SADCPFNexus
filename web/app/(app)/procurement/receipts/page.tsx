"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { goodsReceiptsApi, type GoodsReceiptNote } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  pending:   { label: "Pending",   cls: "badge-warning", icon: "hourglass_empty" },
  inspected: { label: "Inspected", cls: "badge-primary", icon: "search"          },
  accepted:  { label: "Accepted",  cls: "badge-success", icon: "check_circle"    },
  rejected:  { label: "Rejected",  cls: "badge-danger",  icon: "cancel"          },
};

const FILTERS = ["all", "pending", "inspected", "accepted", "rejected"];

export default function ReceiptsPage() {
  const searchParams  = useSearchParams();
  const poIdParam     = searchParams.get("po");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["grns-all", statusFilter, poIdParam],
    queryFn: () =>
      goodsReceiptsApi.listAll({
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(poIdParam ? { po_id: Number(poIdParam) } : {}),
      }).then((r) => r.data),
  });

  const items: GoodsReceiptNote[] = (data as { data?: GoodsReceiptNote[] })?.data ?? [];
  const total    = items.length;
  const pending  = items.filter((g) => g.status === "pending").length;
  const accepted = items.filter((g) => g.status === "accepted").length;
  const rejected = items.filter((g) => g.status === "rejected").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Goods Receipts</h1>
          <p className="page-subtitle">
            {poIdParam ? `Receipts for PO #${poIdParam}` : "Track deliveries against purchase orders"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {poIdParam && (
            <Link href={`/procurement/purchase-orders/${poIdParam}`} className="btn-secondary inline-flex items-center gap-1.5 text-sm">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to PO
            </Link>
          )}
          <Link href="/procurement/purchase-orders" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            Purchase Orders
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total GRNs",  value: total,    icon: "inventory_2",   color: "text-primary",   bg: "bg-primary/10"  },
          { label: "Pending",     value: pending,  icon: "hourglass_empty",color: "text-amber-600", bg: "bg-amber-50"    },
          { label: "Accepted",    value: accepted, icon: "check_circle",  color: "text-green-600", bg: "bg-green-50"    },
          { label: "Rejected",    value: rejected, icon: "cancel",        color: "text-red-600",   bg: "bg-red-50"      },
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
        <div className="card p-6 text-center text-sm text-red-600">Failed to load goods receipts.</div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-neutral-300">inventory_2</span>
          <p className="text-sm text-neutral-500">No goods receipts found.</p>
          <p className="text-xs text-neutral-400">Record a receipt against an issued purchase order.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>GRN Reference</th>
                <th>Purchase Order</th>
                <th>Vendor</th>
                <th>Received Date</th>
                <th>Received By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((grn) => {
                const s = statusConfig[grn.status] ?? statusConfig.pending;
                return (
                  <tr key={grn.id}>
                    <td>
                      <Link
                        href={`/procurement/receipts/${grn.id}?po=${grn.purchase_order_id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {grn.reference_number}
                      </Link>
                    </td>
                    <td>
                      {grn.purchase_order ? (
                        <Link
                          href={`/procurement/purchase-orders/${grn.purchase_order_id}`}
                          className="font-mono text-xs text-neutral-500 hover:text-primary"
                        >
                          {grn.purchase_order.reference_number}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-neutral-400">PO-{grn.purchase_order_id}</span>
                      )}
                    </td>
                    <td className="text-sm text-neutral-700">
                      {grn.purchase_order?.vendor?.name ?? "—"}
                    </td>
                    <td className="text-sm text-neutral-500">
                      {grn.received_date ? formatDateShort(grn.received_date) : "—"}
                    </td>
                    <td className="text-sm text-neutral-600">
                      {grn.received_by?.name ?? "—"}
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
