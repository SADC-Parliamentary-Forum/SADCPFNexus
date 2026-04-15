"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoicesApi, purchaseOrdersApi, goodsReceiptsApi, type Invoice, type PurchaseOrder, type GoodsReceiptNote } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  received: { label: "Received", cls: "badge-warning",  icon: "inbox"         },
  matched:  { label: "Matched",  cls: "badge-primary",  icon: "link"          },
  approved: { label: "Approved", cls: "badge-success",  icon: "check_circle"  },
  approved_for_payment: { label: "Approved", cls: "badge-success", icon: "check_circle" },
  proforma_submitted: { label: "Proforma Submitted", cls: "badge-primary", icon: "receipt_long" },
  final_invoice_submitted: { label: "Final Submitted", cls: "badge-success", icon: "task_alt" },
  rejected: { label: "Rejected", cls: "badge-danger",   icon: "cancel"        },
  paid:     { label: "Paid",     cls: "badge-muted",    icon: "payments"      },
};

const matchConfig: Record<string, { label: string; cls: string; icon: string }> = {
  pending:  { label: "Pending",  cls: "text-neutral-400", icon: "hourglass_empty" },
  matched:  { label: "Matched",  cls: "text-green-600",   icon: "check_circle"    },
  variance: { label: "Variance", cls: "text-amber-600",   icon: "warning"         },
};

const FILTERS = ["all", "proforma_submitted", "received", "matched", "approved_for_payment", "rejected", "paid", "final_invoice_submitted"];

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [showModal, setShowModal]       = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);

  // Form state
  const [selectedPoId, setSelectedPoId]       = useState<number | "">("");
  const [selectedGrnId, setSelectedGrnId]     = useState<number | "">("");
  const [vendorInvNumber, setVendorInvNumber] = useState("");
  const [invoiceDate, setInvoiceDate]         = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate]                 = useState("");
  const [amount, setAmount]                   = useState("");
  const [currency, setCurrency]               = useState(DEFAULT_CURRENCY);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () =>
      invoicesApi.list(statusFilter !== "all" ? { status: statusFilter } : undefined)
        .then((r) => r.data),
  });

  // Load POs for selector (all non-cancelled, non-draft)
  const { data: posData } = useQuery({
    queryKey: ["purchase-orders-for-invoice"],
    queryFn: () => purchaseOrdersApi.list().then((r) => r.data),
    enabled: showModal,
  });

  const availablePOs: PurchaseOrder[] = (posData as { data?: PurchaseOrder[] })?.data?.filter(
    (p) => !["cancelled", "draft"].includes(p.status)
  ) ?? [];

  const selectedPO = availablePOs.find((p) => p.id === selectedPoId);

  // Load GRNs for the selected PO
  const { data: grnsData } = useQuery({
    queryKey: ["grns-for-po", selectedPoId],
    queryFn: () => goodsReceiptsApi.list(Number(selectedPoId)).then((r) => r.data),
    enabled: showModal && !!selectedPoId,
  });

  const availableGRNs: GoodsReceiptNote[] = (grnsData as { data?: GoodsReceiptNote[] })?.data?.filter(
    (g) => g.status === "accepted"
  ) ?? [];

  // Auto-fill currency from PO
  useEffect(() => {
    if (selectedPO) setCurrency(selectedPO.currency ?? DEFAULT_CURRENCY);
    setSelectedGrnId("");
  }, [selectedPoId]);

  const openModal = () => {
    setSelectedPoId("");
    setSelectedGrnId("");
    setVendorInvNumber("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setAmount("");
    setCurrency(DEFAULT_CURRENCY);
    setSubmitError(null);
    setShowModal(true);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      invoicesApi.create({
        purchase_order_id: Number(selectedPoId),
        vendor_id: selectedPO!.vendor!.id,
        ...(selectedGrnId ? { goods_receipt_note_id: Number(selectedGrnId) } : {}),
        vendor_invoice_number: vendorInvNumber.trim(),
        invoice_date: invoiceDate,
        due_date: dueDate,
        amount: Number(amount),
        currency,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setShowModal(false);
      window.location.href = `/procurement/invoices/${res.data.data.id}`;
    },
    onError: (e: unknown) => {
      setSubmitError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to record invoice."
      );
    },
  });

  const canSubmit = !!selectedPoId && !!selectedPO?.vendor?.id && !!vendorInvNumber.trim() && !!invoiceDate && !!dueDate && !!amount && Number(amount) > 0;

  const items: Invoice[] = (data as { data?: Invoice[] })?.data ?? [];
  const total    = items.length;
  const pending  = items.filter((i) => i.match_status === "pending").length;
  const matched  = items.filter((i) => i.match_status === "matched").length;
  const approved = items.filter((i) => ["approved", "approved_for_payment", "paid"].includes(i.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">3-way matching and invoice approval workflow</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openModal}
            className="btn-primary inline-flex items-center gap-1.5 text-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Record Invoice
          </button>
          <Link href="/procurement" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Procurement
          </Link>
        </div>
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
          <p className="text-xs text-neutral-400">Click "Record Invoice" above to log an invoice against a purchase order.</p>
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

      {/* Record Invoice Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <span className="material-symbols-outlined text-[20px] text-primary">request_quote</span>
              </div>
              <h2 className="text-base font-bold text-neutral-900">Record Invoice</h2>
            </div>

            {submitError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>
            )}

            <div className="space-y-4">
              {/* PO selector */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Purchase Order <span className="text-red-500">*</span></label>
                <select
                  className="form-input"
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select purchase order…</option>
                  {availablePOs.map((po) => (
                    <option key={po.id} value={po.id}>
                      {po.reference_number} — {po.vendor?.name ?? "Unknown vendor"} ({po.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* GRN selector (optional) */}
              {availableGRNs.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Goods Receipt Note (optional)</label>
                  <select
                    className="form-input"
                    value={selectedGrnId}
                    onChange={(e) => setSelectedGrnId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">None</option>
                    {availableGRNs.map((g) => (
                      <option key={g.id} value={g.id}>{g.reference_number}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Vendor Invoice Number <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. INV-2026-001"
                  value={vendorInvNumber}
                  onChange={(e) => setVendorInvNumber(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Invoice Date <span className="text-red-500">*</span></label>
                  <input type="date" className="form-input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Due Date <span className="text-red-500">*</span></label>
                  <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Amount <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Currency</label>
                  <input
                    type="text"
                    className="form-input"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="btn-primary flex-1 disabled:opacity-60"
                disabled={!canSubmit || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                )}
                {createMutation.isPending ? "Recording…" : "Record Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
