"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi, goodsReceiptsApi, purchaseOrderAttachmentsApi, PURCHASE_ORDER_DOC_TYPES, type PurchaseOrder, type ProcurementAttachment } from "@/lib/api";
import GenericDocumentsPanel from "@/components/ui/GenericDocumentsPanel";
import { formatDateShort } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:              { label: "Draft",          cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "edit_note"   },
  issued:             { label: "Issued",         cls: "text-blue-700 bg-blue-50 border-blue-200",           icon: "send"        },
  partially_received: { label: "Part. Received", cls: "text-amber-700 bg-amber-50 border-amber-200",        icon: "inventory"   },
  received:           { label: "Received",       cls: "text-green-700 bg-green-50 border-green-200",        icon: "inventory_2" },
  cancelled:          { label: "Cancelled",      cls: "text-red-700 bg-red-50 border-red-200",              icon: "cancel"      },
  closed:             { label: "Closed",         cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "check_circle"},
};

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("sadcpf_user") ?? "null"); } catch { return null; }
}
function canManagePO() {
  const u = getStoredUser();
  return (u?.roles ?? []).some((r: string) => ["Procurement Officer","Finance Controller","System Admin","Secretary General","super-admin"].includes(r));
}

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const poId = Number(id);
  const queryClient = useQueryClient();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason]       = useState("");
  const [cancelError, setCancelError]         = useState<string | null>(null);
  const [activeTab, setActiveTab]             = useState<"details" | "documents">("details");
  const [attachments, setAttachments]         = useState<ProcurementAttachment[]>([]);
  const [uploading, setUploading]             = useState(false);

  const { data: po, isLoading, isError } = useQuery({
    queryKey: ["purchase-order", poId],
    queryFn:  () => purchaseOrdersApi.get(poId).then((r) => r.data.data),
    enabled:  !!poId,
  });

  useEffect(() => {
    if (poId) purchaseOrderAttachmentsApi.list(poId).then((r) => setAttachments(r.data.data ?? [])).catch(() => {});
  }, [poId]);

  const { data: grns = [] } = useQuery({
    queryKey: ["grns", poId],
    queryFn:  () => goodsReceiptsApi.list(poId).then((r) => r.data.data),
    enabled:  !!poId,
  });

  const issueMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.issue(poId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.cancel(poId, cancelReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] });
      setShowCancelModal(false);
    },
    onError: (e: unknown) => {
      setCancelError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to cancel.");
    },
  });

  if (isLoading) return (
    <div className="max-w-3xl mx-auto space-y-5 animate-pulse">
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="card p-6 space-y-3"><div className="h-6 w-64 bg-neutral-100 rounded" /><div className="h-4 w-40 bg-neutral-100 rounded" /></div>
    </div>
  );

  if (isError || !po) return (
    <div className="max-w-3xl mx-auto card p-8 text-center space-y-3">
      <span className="material-symbols-outlined text-4xl text-neutral-300">error</span>
      <p className="text-sm text-neutral-500">Purchase order not found.</p>
      <Link href="/procurement/purchase-orders" className="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-4">Back</Link>
    </div>
  );

  const s = statusConfig[po.status] ?? statusConfig.draft;
  const items = po.items ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(["details", "documents"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}>
            {tab === "documents" ? `Documents${attachments.length > 0 ? ` (${attachments.length})` : ""}` : "Details"}
          </button>
        ))}
      </div>

      {activeTab === "documents" && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-neutral-800 mb-5">Purchase Order Documents</h2>
          <GenericDocumentsPanel
            documents={attachments}
            documentTypes={PURCHASE_ORDER_DOC_TYPES as unknown as { value: string; label: string; icon: string }[]}
            defaultType="signed_po"
            loading={false}
            uploading={uploading}
            onUpload={async (file, type) => {
              setUploading(true);
              try { const r = await purchaseOrderAttachmentsApi.upload(poId, file, type); setAttachments((p) => [r.data.data, ...p]); }
              finally { setUploading(false); }
            }}
            onDelete={async (id) => { await purchaseOrderAttachmentsApi.delete(poId, id); setAttachments((p) => p.filter((a) => a.id !== id)); }}
            downloadUrl={(id) => purchaseOrderAttachmentsApi.downloadUrl(poId, id)}
          />
        </div>
      )}

      {activeTab === "details" && <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Link href="/procurement" className="hover:text-primary transition-colors">Procurement</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/procurement/purchase-orders" className="hover:text-primary transition-colors">Purchase Orders</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="font-mono text-neutral-600">{po.reference_number}</span>
      </nav>

      {/* Hero */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{po.title}</h1>
            <p className="font-mono text-xs text-neutral-400 mt-0.5">{po.reference_number}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {s.label}
            </span>
            {po.status === "draft" && canManagePO() && (
              <button
                onClick={() => issueMutation.mutate()}
                disabled={issueMutation.isPending}
                className="btn-primary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">send</span>
                {issueMutation.isPending ? "Issuing…" : "Issue PO"}
              </button>
            )}
            {!["closed","cancelled","received"].includes(po.status) && canManagePO() && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center gap-1 text-xs text-red-600 border border-red-200 rounded-full px-3 py-1 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[12px]">cancel</span>
                Cancel PO
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            { label: "Vendor",             icon: "storefront",      value: po.vendor?.name ?? "—"                                              },
            { label: "Payment Terms",      icon: "schedule",        value: po.payment_terms?.replace("_", " ") ?? "—"                           },
            { label: "Expected Delivery",  icon: "calendar_today",  value: po.expected_delivery_date ? formatDateShort(po.expected_delivery_date) : "—" },
            { label: "Total Amount",       icon: "payments",        value: `${po.currency} ${(po.total_amount ?? 0).toLocaleString()}`           },
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

        {po.delivery_address && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[13px] text-neutral-300">location_on</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Delivery Address</p>
            </div>
            <p className="text-sm text-neutral-700">{po.delivery_address}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">list_alt</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Line Items</h3>
          </div>
          <span className="text-sm font-bold text-primary">{po.currency} {(po.total_amount ?? 0).toLocaleString()}</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="text-center">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-neutral-400 py-8 text-sm">No line items.</td></tr>
            ) : items.map((item) => (
              <tr key={item.id}>
                <td><p className="font-medium text-neutral-900">{item.description}</p><p className="text-xs text-neutral-400">{item.unit}</p></td>
                <td className="text-center text-neutral-700">{item.quantity}</td>
                <td className="text-right text-neutral-600 text-sm">{po.currency} {item.unit_price.toLocaleString()}</td>
                <td className="text-right font-bold text-neutral-900">{po.currency} {item.total_price.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Goods Receipts */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-green-600">inventory_2</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Goods Receipts</h3>
          </div>
          {po.status === "issued" || po.status === "partially_received" ? (
            <Link href={`/procurement/receipts?po=${poId}`} className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">add</span>
              Record Receipt
            </Link>
          ) : null}
        </div>
        {(grns as { id: number; reference_number: string; received_date: string; status: string }[]).length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-400">No receipts recorded yet.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>GRN Ref</th><th>Received Date</th><th>Status</th></tr></thead>
            <tbody>
              {(grns as { id: number; reference_number: string; received_date: string; status: string }[]).map((grn) => (
                <tr key={grn.id}>
                  <td><Link href={`/procurement/receipts/${grn.id}?po=${poId}`} className="font-mono text-xs text-primary hover:underline">{grn.reference_number}</Link></td>
                  <td className="text-sm text-neutral-600">{grn.received_date ? formatDateShort(grn.received_date) : "—"}</td>
                  <td><span className={`badge ${grn.status === "accepted" ? "badge-success" : grn.status === "rejected" ? "badge-danger" : "badge-warning"}`}>{grn.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Link href="/procurement/purchase-orders" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Purchase Orders
      </Link>
      </> /* end details tab */}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowCancelModal(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-neutral-900">Cancel Purchase Order</h2>
            {cancelError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cancelError}</div>}
            <textarea className="form-input w-full h-24 resize-none" placeholder="Reason for cancellation…" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowCancelModal(false)}>Back</button>
              <button
                disabled={cancelMutation.isPending || !cancelReason.trim()}
                onClick={() => cancelMutation.mutate()}
                className="flex-1 rounded-lg bg-red-600 text-white text-sm font-medium py-2 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {cancelMutation.isPending ? "Cancelling…" : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
