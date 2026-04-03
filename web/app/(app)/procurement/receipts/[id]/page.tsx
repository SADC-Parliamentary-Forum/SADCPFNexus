"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { goodsReceiptsApi, goodsReceiptAttachmentsApi, GOODS_RECEIPT_DOC_TYPES, type GoodsReceiptNote, type GoodsReceiptItem, type ProcurementAttachment } from "@/lib/api";
import GenericDocumentsPanel from "@/components/ui/GenericDocumentsPanel";
import { formatDateShort } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  pending:   { label: "Pending",   cls: "text-amber-700 bg-amber-50 border-amber-200",   icon: "hourglass_empty" },
  inspected: { label: "Inspected", cls: "text-blue-700 bg-blue-50 border-blue-200",       icon: "search"          },
  accepted:  { label: "Accepted",  cls: "text-green-700 bg-green-50 border-green-200",    icon: "check_circle"    },
  rejected:  { label: "Rejected",  cls: "text-red-700 bg-red-50 border-red-200",          icon: "cancel"          },
};

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("sadcpf_user") ?? "null"); } catch { return null; }
}
function canManageGRN() {
  const u = getStoredUser();
  return (u?.roles ?? []).some((r: string) =>
    ["Procurement Officer", "Finance Controller", "System Admin", "Secretary General"].includes(r)
  );
}

function GoodsReceiptDetailPageInner({ params }: { params: { id: string } }) {
  const grnId       = Number(params.id);
  const searchParams = useSearchParams();
  const poId        = Number(searchParams.get("po") ?? 0);
  const queryClient = useQueryClient();

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason]       = useState("");
  const [rejectError, setRejectError]         = useState<string | null>(null);
  const [activeTab, setActiveTab]             = useState<"details" | "documents">("details");
  const [attachments, setAttachments]         = useState<ProcurementAttachment[]>([]);
  const [uploading, setUploading]             = useState(false);

  useEffect(() => {
    if (grnId) goodsReceiptAttachmentsApi.list(grnId).then((r) => setAttachments(r.data.data ?? [])).catch(() => {});
  }, [grnId]);

  const { data: grn, isLoading, isError } = useQuery({
    queryKey: ["grn", poId, grnId],
    queryFn:  () => goodsReceiptsApi.get(poId, grnId).then((r) => r.data.data),
    enabled:  !!poId && !!grnId,
  });

  const acceptMutation = useMutation({
    mutationFn: () => goodsReceiptsApi.accept(poId, grnId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["grn", poId, grnId] }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => goodsReceiptsApi.reject(poId, grnId, rejectReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grn", poId, grnId] });
      setShowRejectModal(false);
    },
    onError: (e: unknown) => {
      setRejectError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to reject.");
    },
  });

  if (!poId) return (
    <div className="max-w-3xl mx-auto card p-8 text-center space-y-3">
      <span className="material-symbols-outlined text-4xl text-neutral-300">error</span>
      <p className="text-sm text-neutral-500">Missing purchase order reference.</p>
      <Link href="/procurement/receipts" className="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-4">Back to Receipts</Link>
    </div>
  );

  if (isLoading) return (
    <div className="max-w-3xl mx-auto space-y-5 animate-pulse">
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="card p-6 space-y-3">
        <div className="h-6 w-64 bg-neutral-100 rounded" />
        <div className="h-4 w-40 bg-neutral-100 rounded" />
      </div>
    </div>
  );

  if (isError || !grn) return (
    <div className="max-w-3xl mx-auto card p-8 text-center space-y-3">
      <span className="material-symbols-outlined text-4xl text-neutral-300">error</span>
      <p className="text-sm text-neutral-500">Goods receipt note not found.</p>
      <Link href="/procurement/receipts" className="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-4">Back</Link>
    </div>
  );

  const s     = statusConfig[grn.status] ?? statusConfig.pending;
  const items = (grn.items ?? []) as GoodsReceiptItem[];
  const canAct = canManageGRN() && (grn.status === "pending" || grn.status === "inspected");

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
          <h2 className="text-sm font-semibold text-neutral-800 mb-5">Goods Receipt Documents</h2>
          <GenericDocumentsPanel
            documents={attachments}
            documentTypes={GOODS_RECEIPT_DOC_TYPES as unknown as { value: string; label: string; icon: string }[]}
            defaultType="delivery_note"
            loading={false}
            uploading={uploading}
            onUpload={async (file, type) => {
              setUploading(true);
              try { const r = await goodsReceiptAttachmentsApi.upload(grnId, file, type); setAttachments((p) => [r.data.data, ...p]); }
              finally { setUploading(false); }
            }}
            onDelete={async (id) => { await goodsReceiptAttachmentsApi.delete(grnId, id); setAttachments((p) => p.filter((a) => a.id !== id)); }}
            downloadUrl={(id) => goodsReceiptAttachmentsApi.downloadUrl(grnId, id)}
          />
        </div>
      )}

      {activeTab === "details" && <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Link href="/procurement" className="hover:text-primary transition-colors">Procurement</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/procurement/receipts" className="hover:text-primary transition-colors">Receipts</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="font-mono text-neutral-600">{grn.reference_number}</span>
      </nav>

      {/* Hero */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Goods Receipt Note</h1>
            <p className="font-mono text-xs text-neutral-400 mt-0.5">{grn.reference_number}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {s.label}
            </span>
            {canAct && (
              <>
                <button
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                  className="btn-primary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
                >
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  {acceptMutation.isPending ? "Accepting…" : "Accept"}
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
            {
              label: "Purchase Order",
              icon: "receipt_long",
              value: grn.purchase_order ? (
                <Link href={`/procurement/purchase-orders/${grn.purchase_order_id}`} className="text-primary hover:underline font-mono text-xs">
                  {grn.purchase_order.reference_number}
                </Link>
              ) : <span className="font-mono text-xs text-neutral-400">PO-{grn.purchase_order_id}</span>,
            },
            {
              label: "Vendor",
              icon: "storefront",
              value: grn.purchase_order?.vendor?.name ?? "—",
            },
            {
              label: "Received Date",
              icon: "calendar_today",
              value: grn.received_date ? formatDateShort(grn.received_date) : "—",
            },
            {
              label: "Received By",
              icon: "person",
              value: grn.received_by?.name ?? "—",
            },
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

        {grn.delivery_note_number && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[13px] text-neutral-300">description</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Delivery Note Number</p>
            </div>
            <p className="text-sm font-mono text-neutral-700">{grn.delivery_note_number}</p>
          </div>
        )}

        {grn.notes && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[13px] text-neutral-300">notes</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Notes</p>
            </div>
            <p className="text-sm text-neutral-700">{grn.notes}</p>
          </div>
        )}
      </div>

      {/* Items received vs ordered */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">list_alt</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Items Received</h3>
          </div>
          <span className="text-xs text-neutral-400">{items.length} line item{items.length !== 1 ? "s" : ""}</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item Description</th>
              <th className="text-center">Ordered</th>
              <th className="text-center">Received</th>
              <th className="text-center">Accepted</th>
              <th>Condition Notes</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-neutral-400 py-8 text-sm">No items recorded.</td></tr>
            ) : items.map((item) => {
              const received  = item.quantity_received ?? 0;
              const accepted  = item.quantity_accepted ?? received;
              const ordered   = item.quantity_ordered ?? 0;
              const variance  = received < ordered;
              return (
                <tr key={item.id}>
                  <td>
                    <p className="font-medium text-neutral-900 text-sm">
                      {item.purchase_order_item?.description ?? `Item #${item.purchase_order_item_id}`}
                    </p>
                    {item.purchase_order_item?.unit && (
                      <p className="text-xs text-neutral-400">{item.purchase_order_item.unit}</p>
                    )}
                  </td>
                  <td className="text-center text-neutral-600">{ordered}</td>
                  <td className="text-center">
                    <span className={variance ? "text-amber-600 font-semibold" : "text-neutral-700"}>
                      {received}
                    </span>
                    {variance && (
                      <span className="ml-1 text-[10px] text-amber-500">(short)</span>
                    )}
                  </td>
                  <td className="text-center">
                    <span className={accepted < received ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                      {accepted}
                    </span>
                  </td>
                  <td className="text-xs text-neutral-500 max-w-xs">
                    {item.condition_notes ?? <span className="text-neutral-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Link href={`/procurement/receipts`} className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Receipts
      </Link>
      </> /* end details tab */}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowRejectModal(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-neutral-900">Reject Goods Receipt</h2>
            {rejectError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{rejectError}</div>}
            <textarea
              className="form-input w-full h-24 resize-none"
              placeholder="Reason for rejection (e.g. items damaged, wrong goods)…"
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

export default function GoodsReceiptDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <GoodsReceiptDetailPageInner params={params} />
    </Suspense>
  );
}
