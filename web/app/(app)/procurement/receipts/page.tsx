"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { goodsReceiptsApi, purchaseOrdersApi, type GoodsReceiptNote, type PurchaseOrderItem } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  pending:   { label: "Pending",   cls: "badge-warning", icon: "hourglass_empty" },
  inspected: { label: "Inspected", cls: "badge-primary", icon: "search"          },
  accepted:  { label: "Accepted",  cls: "badge-success", icon: "check_circle"    },
  rejected:  { label: "Rejected",  cls: "badge-danger",  icon: "cancel"          },
};

const FILTERS = ["all", "pending", "inspected", "accepted", "rejected"];

interface ItemRow {
  purchase_order_item_id: number;
  description: string;
  quantity_ordered: number;
  unit: string;
  quantity_received: string;
  quantity_accepted: string;
  condition_notes: string;
}

export default function ReceiptsPage() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const poIdParam     = searchParams.get("po");
  const poId          = poIdParam ? Number(poIdParam) : null;
  const queryClient   = useQueryClient();

  const [statusFilter, setStatusFilter]   = useState("all");
  const [showModal, setShowModal]         = useState(false);
  const [receivedDate, setReceivedDate]   = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes]                 = useState("");
  const [itemRows, setItemRows]           = useState<ItemRow[]>([]);
  const [submitError, setSubmitError]     = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["grns-all", statusFilter, poIdParam],
    queryFn: () =>
      goodsReceiptsApi.listAll({
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(poId ? { po_id: poId } : {}),
      }).then((r) => r.data),
  });

  // Fetch PO details (including items) when modal is opened
  const { data: poData, isLoading: poLoading } = useQuery({
    queryKey: ["purchase-order", poId],
    queryFn:  () => purchaseOrdersApi.get(poId!).then((r) => r.data.data),
    enabled:  !!poId && showModal,
  });

  const openModal = () => {
    setSubmitError(null);
    setReceivedDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setShowModal(true);
  };

  // Sync item rows when PO data loads
  const handleModalOpen = () => {
    openModal();
  };

  // When PO data changes while modal is open, populate item rows
  const syncRows = (items: PurchaseOrderItem[]) => {
    if (itemRows.length === 0) {
      setItemRows(items.map((item) => ({
        purchase_order_item_id: item.id,
        description: item.description,
        quantity_ordered: item.quantity,
        unit: item.unit,
        quantity_received: String(item.quantity),
        quantity_accepted: String(item.quantity),
        condition_notes: "",
      })));
    }
  };

  if (poData?.items && showModal && itemRows.length === 0) {
    syncRows(poData.items);
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const payload = {
        received_date: receivedDate,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        items: itemRows.map((r) => ({
          purchase_order_item_id: r.purchase_order_item_id,
          quantity_received: Number(r.quantity_received) || 0,
          quantity_accepted: Number(r.quantity_accepted) || 0,
        })),
      };
      return goodsReceiptsApi.create(poId!, payload);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["grns-all"] });
      setShowModal(false);
      setItemRows([]);
      router.push(`/procurement/receipts/${res.data.data.id}?po=${poId}`);
    },
    onError: (e: unknown) => {
      setSubmitError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to record receipt."
      );
    },
  });

  const items: GoodsReceiptNote[] = (data as { data?: GoodsReceiptNote[] })?.data ?? [];
  const total    = items.length;
  const pending  = items.filter((g) => g.status === "pending").length;
  const accepted = items.filter((g) => g.status === "accepted").length;
  const rejected = items.filter((g) => g.status === "rejected").length;

  const canSubmit = itemRows.length > 0 && itemRows.every((r) => Number(r.quantity_received) >= 0);

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
          {poId && (
            <>
              <button
                onClick={handleModalOpen}
                className="btn-primary inline-flex items-center gap-1.5 text-sm"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Record Receipt
              </button>
              <Link href={`/procurement/purchase-orders/${poId}`} className="btn-secondary inline-flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Back to PO
              </Link>
            </>
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
          <p className="text-xs text-neutral-400">
            {poId ? 'Click \u201cRecord Receipt\u201d above to log a new delivery.' : "Record a receipt against an issued purchase order."}
          </p>
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

      {/* Record Receipt Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => { setShowModal(false); setItemRows([]); }}
        >
          <div
            className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50">
                <span className="material-symbols-outlined text-[20px] text-green-600">inventory_2</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">Record Goods Receipt</h2>
                {poData && <p className="text-xs text-neutral-400 font-mono">{poData.reference_number} — {poData.vendor?.name}</p>}
              </div>
            </div>

            {submitError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Received Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional notes…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">Items Received</h3>
              {poLoading ? (
                <div className="text-center py-6 text-sm text-neutral-400 animate-pulse">Loading PO items…</div>
              ) : itemRows.length === 0 ? (
                <div className="text-center py-6 text-sm text-neutral-400">No line items on this purchase order.</div>
              ) : (
                <div className="space-y-3">
                  {itemRows.map((row, idx) => (
                    <div key={row.purchase_order_item_id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">{row.description}</p>
                          <p className="text-xs text-neutral-400">{row.unit} · Ordered: {row.quantity_ordered}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase text-neutral-400">Qty Received</label>
                          <input
                            type="number"
                            min="0"
                            max={row.quantity_ordered}
                            className="form-input text-sm"
                            value={row.quantity_received}
                            onChange={(e) => {
                              const updated = [...itemRows];
                              updated[idx] = { ...updated[idx], quantity_received: e.target.value, quantity_accepted: e.target.value };
                              setItemRows(updated);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase text-neutral-400">Qty Accepted</label>
                          <input
                            type="number"
                            min="0"
                            max={row.quantity_received}
                            className="form-input text-sm"
                            value={row.quantity_accepted}
                            onChange={(e) => {
                              const updated = [...itemRows];
                              updated[idx] = { ...updated[idx], quantity_accepted: e.target.value };
                              setItemRows(updated);
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase text-neutral-400">Condition Notes</label>
                          <input
                            type="text"
                            className="form-input text-sm"
                            placeholder="Optional…"
                            value={row.condition_notes}
                            onChange={(e) => {
                              const updated = [...itemRows];
                              updated[idx] = { ...updated[idx], condition_notes: e.target.value };
                              setItemRows(updated);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                className="btn-secondary flex-1"
                onClick={() => { setShowModal(false); setItemRows([]); }}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1 disabled:opacity-60"
                disabled={!canSubmit || !receivedDate || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                )}
                {createMutation.isPending ? "Recording…" : "Record Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
