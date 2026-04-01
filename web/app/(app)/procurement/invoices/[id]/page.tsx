"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoicesApi, type Invoice } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  received: { label: "Received", cls: "text-amber-700 bg-amber-50 border-amber-200",    icon: "inbox"        },
  matched:  { label: "Matched",  cls: "text-blue-700 bg-blue-50 border-blue-200",        icon: "link"         },
  approved: { label: "Approved", cls: "text-green-700 bg-green-50 border-green-200",     icon: "check_circle" },
  rejected: { label: "Rejected", cls: "text-red-700 bg-red-50 border-red-200",           icon: "cancel"       },
  paid:     { label: "Paid",     cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "payments"  },
};

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("sadcpf_user") ?? "null"); } catch { return null; }
}
function canApproveInvoice() {
  const u = getStoredUser();
  return (u?.roles ?? []).some((r: string) =>
    ["Finance Controller", "System Admin", "Secretary General"].includes(r)
  );
}

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const invId       = Number(params.id);
  const queryClient = useQueryClient();

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason]       = useState("");
  const [rejectError, setRejectError]         = useState<string | null>(null);

  const { data: inv, isLoading, isError } = useQuery({
    queryKey: ["invoice", invId],
    queryFn:  () => invoicesApi.get(invId).then((r) => r.data.data),
    enabled:  !!invId,
  });

  const approveMutation = useMutation({
    mutationFn: () => invoicesApi.approve(invId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["invoice", invId] }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => invoicesApi.reject(invId, rejectReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", invId] });
      setShowRejectModal(false);
    },
    onError: (e: unknown) => {
      setRejectError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to reject.");
    },
  });

  if (isLoading) return (
    <div className="max-w-3xl mx-auto space-y-5 animate-pulse">
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="card p-6 space-y-3">
        <div className="h-6 w-64 bg-neutral-100 rounded" />
        <div className="h-4 w-40 bg-neutral-100 rounded" />
      </div>
    </div>
  );

  if (isError || !inv) return (
    <div className="max-w-3xl mx-auto card p-8 text-center space-y-3">
      <span className="material-symbols-outlined text-4xl text-neutral-300">error</span>
      <p className="text-sm text-neutral-500">Invoice not found.</p>
      <Link href="/procurement/invoices" className="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-4">Back</Link>
    </div>
  );

  const s       = statusConfig[inv.status] ?? statusConfig.received;
  const canAct  = canApproveInvoice() && (inv.status === "received" || inv.status === "matched");
  const matchPO = inv.purchase_order?.total_amount ? Number(inv.purchase_order.total_amount) : null;

  const matchIndicator = {
    pending:  { label: "Pending",        icon: "hourglass_empty", bg: "bg-neutral-50",  text: "text-neutral-500",  border: "border-neutral-200" },
    matched:  { label: "Match Passed",   icon: "check_circle",    bg: "bg-green-50",    text: "text-green-700",    border: "border-green-200"   },
    variance: { label: "Variance Found", icon: "warning",         bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200"   },
  }[inv.match_status] ?? { label: "Unknown", icon: "help", bg: "bg-neutral-50", text: "text-neutral-500", border: "border-neutral-200" };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Link href="/procurement" className="hover:text-primary transition-colors">Procurement</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/procurement/invoices" className="hover:text-primary transition-colors">Invoices</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="font-mono text-neutral-600">{inv.reference_number}</span>
      </nav>

      {/* Hero */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Invoice</h1>
            <p className="font-mono text-xs text-neutral-400 mt-0.5">{inv.reference_number}</p>
            <p className="text-xs text-neutral-400 mt-0.5">Vendor ref: <span className="font-mono">{inv.vendor_invoice_number}</span></p>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {s.label}
            </span>
            {canAct && (
              <>
                <button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  className="btn-primary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
                >
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  {approveMutation.isPending ? "Approving…" : "Approve"}
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="inline-flex items-center gap-1 text-xs text-red-600 border border-red-200 rounded-full px-3 py-1 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[12px]">cancel</span>
                  Reject
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            { label: "Vendor",        icon: "storefront",      value: inv.vendor?.name ?? "—"                            },
            { label: "Currency",      icon: "currency_exchange",value: inv.currency                                       },
            { label: "Invoice Date",  icon: "calendar_today",  value: inv.invoice_date ? formatDateShort(inv.invoice_date) : "—" },
            { label: "Due Date",      icon: "event",           value: inv.due_date     ? formatDateShort(inv.due_date)     : "—" },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-[13px] text-neutral-300">{row.icon}</span>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{row.label}</p>
              </div>
              <p className="font-medium text-neutral-900">{row.value}</p>
            </div>
          ))}
        </div>

        {inv.rejection_reason && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[13px] text-red-400">cancel</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Rejection Reason</p>
            </div>
            <p className="text-sm text-red-700">{inv.rejection_reason}</p>
          </div>
        )}
      </div>

      {/* 3-Way Match summary */}
      <div className={`card p-5 border ${matchIndicator.border} ${matchIndicator.bg}`}>
        <div className="flex items-center gap-2 mb-4">
          <span className={`material-symbols-outlined text-[20px] ${matchIndicator.text}`}>{matchIndicator.icon}</span>
          <h3 className={`text-sm font-bold ${matchIndicator.text}`}>3-Way Match — {matchIndicator.label}</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "PO Total",      value: matchPO != null ? `${inv.purchase_order?.currency} ${matchPO.toLocaleString()}` : "—", icon: "receipt_long"  },
            { label: "Invoice Amount",value: `${inv.currency} ${Number(inv.amount).toLocaleString()}`,                               icon: "request_quote" },
            { label: "GRN Status",    value: inv.goods_receipt_note ? (inv.goods_receipt_note.status ?? "—") : "No GRN linked",      icon: "inventory_2"   },
          ].map((col) => (
            <div key={col.label} className="text-center">
              <span className={`material-symbols-outlined text-[20px] ${matchIndicator.text} mb-1 block`}>{col.icon}</span>
              <p className="text-xs text-neutral-500 mb-0.5">{col.label}</p>
              <p className="text-sm font-bold text-neutral-900">{col.value}</p>
            </div>
          ))}
        </div>
        {inv.match_notes && (
          <p className={`mt-4 text-xs ${matchIndicator.text} border-t border-current/20 pt-3`}>{inv.match_notes}</p>
        )}
      </div>

      {/* Linked documents */}
      <div className="card p-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Linked Documents</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* PO link */}
          <div className="rounded-lg border border-neutral-100 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-400">receipt_long</span>
              <p className="text-[11px] font-semibold uppercase text-neutral-400">Purchase Order</p>
            </div>
            {inv.purchase_order ? (
              <Link href={`/procurement/purchase-orders/${inv.purchase_order_id}`} className="font-mono text-xs text-primary hover:underline block">
                {inv.purchase_order.reference_number}
              </Link>
            ) : <span className="text-xs text-neutral-400">—</span>}
          </div>

          {/* GRN link */}
          <div className="rounded-lg border border-neutral-100 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-400">inventory_2</span>
              <p className="text-[11px] font-semibold uppercase text-neutral-400">Goods Receipt Note</p>
            </div>
            {inv.goods_receipt_note ? (
              <Link href={`/procurement/receipts/${inv.goods_receipt_note_id}?po=${inv.purchase_order_id}`} className="font-mono text-xs text-primary hover:underline block">
                {inv.goods_receipt_note.reference_number}
              </Link>
            ) : <span className="text-xs text-neutral-400">Not linked</span>}
          </div>
        </div>
      </div>

      {inv.reviewed_by && (
        <div className="text-xs text-neutral-400 text-right">
          Reviewed by {inv.reviewed_by.name}
          {inv.reviewed_at ? ` on ${formatDateShort(inv.reviewed_at)}` : ""}
        </div>
      )}

      <Link href="/procurement/invoices" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Invoices
      </Link>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowRejectModal(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-neutral-900">Reject Invoice</h2>
            {rejectError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{rejectError}</div>}
            <textarea
              className="form-input w-full h-24 resize-none"
              placeholder="Reason for rejection…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowRejectModal(false)}>Back</button>
              <button
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                onClick={() => rejectMutation.mutate()}
                className="flex-1 rounded-lg bg-red-600 text-white text-sm font-medium py-2 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {rejectMutation.isPending ? "Rejecting…" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
