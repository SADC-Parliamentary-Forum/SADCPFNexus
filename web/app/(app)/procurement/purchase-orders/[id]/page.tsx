"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi, goodsReceiptsApi, purchaseOrderAttachmentsApi, PURCHASE_ORDER_DOC_TYPES, type PurchaseOrder, type ProcurementAttachment } from "@/lib/api";
import GenericDocumentsPanel from "@/components/ui/GenericDocumentsPanel";
import { readStoredUser } from "@/lib/session";
import { formatDateShort } from "@/lib/utils";
import { ProcurementPageHeader } from "@/components/procurement/ProcurementPageHeader";
import { TableEmpty } from "@/components/ui/EmptyState";
import { hasPermission, isSystemAdmin } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:              { label: "status.draft",   cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "edit_note"   },
  returned:           { label: "procurement.status.returned", cls: "text-amber-700 bg-amber-50 border-amber-200",        icon: "undo"        },
  awaiting_approval:  { label: "procurement.index.wb.awaitingApproval", cls: "text-amber-700 bg-amber-50 border-amber-200",    icon: "hourglass"   },
  approved:           { label: "status.approved", cls: "text-green-700 bg-green-50 border-green-200",        icon: "check"       },
  issued:             { label: "procurement.poStatus.issued", cls: "text-blue-700 bg-blue-50 border-blue-200",           icon: "send"        },
  partially_received: { label: "procurement.poStatus.partReceived", cls: "text-amber-700 bg-amber-50 border-amber-200",        icon: "inventory"   },
  received:           { label: "procurement.poStatus.received", cls: "text-green-700 bg-green-50 border-green-200",        icon: "inventory_2" },
  cancelled:          { label: "status.cancelled", cls: "text-red-700 bg-red-50 border-red-200",              icon: "cancel"      },
  void:               { label: "po.detailPage.status.void", cls: "text-red-700 bg-red-50 border-red-200",              icon: "block"       },
  rejected:           { label: "status.rejected", cls: "text-red-700 bg-red-50 border-red-200",              icon: "cancel"      },
  closed:             { label: "procurement.poStatus.closed", cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "check_circle"},
};

const PO_DOC_TYPE_LABEL_KEYS: Record<string, string> = {
  signed_po: "po.detailPage.docType.signedPo",
  vendor_acknowledgement: "po.detailPage.docType.vendorAck",
  delivery_schedule: "po.detailPage.docType.deliverySchedule",
  po_amendment: "po.detailPage.docType.poAmendment",
  other: "procurement.vendors.country.other",
};

function getStoredUser() {
  return readStoredUser();
}
function canManagePO() {
  const u = getStoredUser();
  return (u?.roles ?? []).some((r: string) => ["Procurement Officer","Finance Controller","System Admin","Secretary General","super-admin"].includes(r));
}
function canCustomReference() {
  const u = getStoredUser();
  return isSystemAdmin(u) || hasPermission(u, ["procurement.reference.custom", "procurement.admin"]);
}
function canManageSequence() {
  const u = getStoredUser();
  return isSystemAdmin(u) || hasPermission(u, ["procurement.sequence.manage", "procurement.admin"]);
}

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useI18n();
  const { id } = use(params);
  const poId = Number(id);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason]       = useState("");
  const [cancelError, setCancelError]         = useState<string | null>(null);
  const [activeTab, setActiveTab]             = useState<"details" | "documents">("details");
  const [attachments, setAttachments]         = useState<ProcurementAttachment[]>([]);
  const [uploading, setUploading]             = useState(false);
  const [customMode, setCustomMode]           = useState(false);
  const [customReference, setCustomReference] = useState("");
  const [customReason, setCustomReason]       = useState("");
  const [continueSequence, setContinueSequence] = useState(false);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] });
      toast.success(t("po.detailPage.issued"));
    },
    onError: (err: unknown) => {
      toast.error(t("po.detailPage.notIssued"), apiErrorMessage(err, t("po.detailPage.issueFailed")));
    },
  });
  const submitMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.submit(poId, customMode ? {
      reference_mode: "custom",
      custom_reference: customReference,
      custom_reason: customReason,
      continue_sequence: continueSequence,
    } : { reference_mode: "auto" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] });
      toast.success(t("po.detailPage.submitted"));
    },
    onError: (err: unknown) => {
      toast.error(t("po.detailPage.notSubmitted"), apiErrorMessage(err, t("po.detailPage.submitFailed")));
    },
  });
  const emailMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.emailSupplier(poId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] });
      toast.success(t("po.detailPage.emailed"));
    },
    onError: (err: unknown) => {
      toast.error(t("po.detailPage.notEmailed"), apiErrorMessage(err, t("po.detailPage.emailFailed")));
    },
  });
  const financeMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.financeHandover(poId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] });
      toast.success(t("po.detailPage.handedOver"));
    },
    onError: (err: unknown) => {
      toast.error(t("po.detailPage.notHandedOver"), apiErrorMessage(err, t("po.detailPage.handoverFailed")));
    },
  });
  const serviceMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.confirmService(poId, { delivered: "yes", satisfactory: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] });
      toast.success(t("po.detailPage.serviceConfirmed"));
    },
    onError: (err: unknown) => {
      toast.error(t("po.detailPage.serviceNotConfirmed"), apiErrorMessage(err, t("po.detailPage.serviceFailed")));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => purchaseOrdersApi.cancel(poId, cancelReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] });
      setShowCancelModal(false);
      toast.success(t("po.detailPage.cancelled"));
    },
    onError: (e: unknown) => {
      const message = apiErrorMessage(e, t("po.detailPage.cancelFailed"));
      setCancelError(message);
      toast.error(t("po.detailPage.notCancelled"), message);
    },
  });

  if (isLoading) return (
    <div className="w-full min-w-0 space-y-5 animate-pulse">
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="card p-6 space-y-3"><div className="h-6 w-64 bg-neutral-100 rounded" /><div className="h-4 w-40 bg-neutral-100 rounded" /></div>
    </div>
  );

  if (isError || !po) return (
    <div className="w-full min-w-0 card p-8 text-center space-y-3">
      <span className="material-symbols-outlined text-4xl text-neutral-300">error</span>
      <p className="text-sm text-neutral-500">{t("po.detailPage.notFound")}</p>
      <Link href="/procurement/purchase-orders" className="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-4">{t("common.back")}</Link>
    </div>
  );

  const s = statusConfig[po.status] ?? statusConfig.draft;
  const items = po.items ?? [];

  return (
    <div className="w-full min-w-0 space-y-5">
      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(["details", "documents"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}>
            {tab === "documents" ? (attachments.length > 0 ? t("procurement.tab.documentsCount", { count: attachments.length }) : t("procurement.tab.documents")) : t("procurement.tab.details")}
          </button>
        ))}
      </div>

      {activeTab === "documents" && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-neutral-800 mb-5">{t("po.detailPage.documentsTitle")}</h2>
          <GenericDocumentsPanel
            documents={attachments}
            documentTypes={PURCHASE_ORDER_DOC_TYPES.map((dt) => ({ value: dt.value, icon: dt.icon, label: t(PO_DOC_TYPE_LABEL_KEYS[dt.value] ?? dt.label) }))}
            defaultType="signed_po"
            loading={false}
            uploading={uploading}
            onUpload={async (file, type) => {
              setUploading(true);
              try {
                const r = await purchaseOrderAttachmentsApi.upload(poId, file, type);
                setAttachments((p) => [r.data.data, ...p]);
                toast.success(t("procurement.doc.uploaded"));
              } catch (err) {
                toast.error(t("procurement.doc.notUploaded"), apiErrorMessage(err, t("procurement.doc.uploadFailed")));
              } finally { setUploading(false); }
            }}
            onDelete={async (id) => {
              try {
                await purchaseOrderAttachmentsApi.delete(poId, id);
                setAttachments((p) => p.filter((a) => a.id !== id));
                toast.success(t("procurement.doc.deleted"));
              } catch (err) {
                toast.error(t("procurement.doc.notDeleted"), apiErrorMessage(err, t("procurement.doc.deleteFailed")));
              }
            }}
            downloadUrl={(id) => purchaseOrderAttachmentsApi.downloadUrl(poId, id)}
          />
        </div>
      )}

      {activeTab === "details" && <>
      <ProcurementPageHeader
        title={po.title}
        subtitle={po.lpo_number ?? po.display_reference ?? po.reference_number}
        crumbs={[
          { label: "nav.procurement", href: "/procurement" },
          { label: "procurement.purchaseOrders.title", href: "/procurement/purchase-orders" },
          { label: po.reference_number },
        ]}
      />

      {/* Hero */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="font-mono text-xs text-neutral-400">{po.lpo_number ?? po.reference_number}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {t(s.label)}
            </span>
            {["draft", "returned"].includes(po.status) && canManagePO() && !po.lpo_number && (
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || (customMode && (!customReference.trim() || customReason.trim().length < 3))}
                className="btn-primary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
                data-testid="po-submit"
              >
                {submitMutation.isPending ? t("procurement.submitting") : t("po.detail.submit")}
              </button>
            )}
            {po.status === "approved" && canManagePO() && (
              <button
                onClick={() => issueMutation.mutate()}
                disabled={issueMutation.isPending}
                className="btn-primary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">send</span>
                {issueMutation.isPending ? t("payslips.desk.issuing") : t("po.detailPage.issuePo")}
              </button>
            )}
            {(po.status === "issued" || po.status === "approved") && canManagePO() && (
              <>
                <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={async () => {
                  const blob = await purchaseOrdersApi.downloadPdf(poId).then((r) => r.data as Blob);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `LPO_${(po.lpo_number ?? po.reference_number).replace(/\s+/g, "_")}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>{t("assets.labels.downloadPdf")}</button>
                <button type="button" className="btn-secondary text-xs px-3 py-1.5" disabled={emailMutation.isPending} onClick={() => emailMutation.mutate()}>
                  {emailMutation.isPending ? t("admin.weeklySummary.queuing") : t("po.detailPage.emailSupplier")}
                </button>
                <button type="button" className="btn-secondary text-xs px-3 py-1.5" disabled={serviceMutation.isPending} onClick={() => serviceMutation.mutate()}>
                  {t("po.detailPage.confirmService")}
                </button>
                <button type="button" className="btn-primary text-xs px-3 py-1.5" disabled={financeMutation.isPending} onClick={() => financeMutation.mutate()}>
                  {t("po.detailPage.sendToFinance")}
                </button>
              </>
            )}
            {!["closed","cancelled","received"].includes(po.status) && canManagePO() && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center gap-1 text-xs text-red-600 border border-red-200 rounded-full px-3 py-1 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[12px]">cancel</span>
                {t("po.detailPage.cancelPo")}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            { label: "procurement.col.vendor", icon: "storefront",      value: po.vendor?.name ?? "—"                                              },
            { label: "procurement.po.paymentTerms", icon: "schedule",        value: po.payment_terms?.replace("_", " ") ?? "—"                           },
            { label: "procurement.po.col.expectedDelivery", icon: "calendar_today",  value: po.expected_delivery_date ? formatDateShort(po.expected_delivery_date) : "—" },
            { label: "finance.budget.col.totalAmount", icon: "payments",        value: `${po.currency} ${(po.total_amount ?? 0).toLocaleString()}`           },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-[13px] text-neutral-300">{row.icon}</span>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t(row.label)}</p>
              </div>
              <p className="font-medium text-neutral-900">{row.value}</p>
            </div>
          ))}
          {(po.source_requisition || po.procurement_request) && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-[13px] text-neutral-300">description</span>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("po.detail.sourcePr")}</p>
              </div>
              <Link
                href={`/procurement/${po.source_requisition?.id ?? po.procurement_request?.id}`}
                className="font-semibold font-mono text-sm text-primary hover:opacity-80"
              >
                {po.source_requisition?.reference ?? po.procurement_request?.reference_number}
              </Link>
            </div>
          )}
        </div>

        {["draft", "returned"].includes(po.status) && canManagePO() && canCustomReference() && !po.lpo_number && (
          <div className="mt-4 pt-4 border-t border-neutral-50 space-y-2">
            <label htmlFor="po-detail-custom-ref" className="flex items-center gap-2 text-sm">
              <input id="po-detail-custom-ref" type="checkbox" checked={customMode} onChange={(e) => setCustomMode(e.target.checked)} />
              {t("po.detail.customRef")}
            </label>
            {customMode && (
              <>
                <input className="form-input" value={customReference} onChange={(e) => setCustomReference(e.target.value)} placeholder="GIZ/PO/2026/017" />
                <input className="form-input" value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder={t("po.detail.customReason")} />
                {canManageSequence() && (
                  <label htmlFor="po-detail-continue-sequence" className="flex items-center gap-2 text-xs">
                    <input id="po-detail-continue-sequence" type="checkbox" checked={continueSequence} onChange={(e) => setContinueSequence(e.target.checked)} />
                    {t("po.detail.continueSequence")}
                  </label>
                )}
              </>
            )}
          </div>
        )}

        {po.delivery_address && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[13px] text-neutral-300">location_on</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("procurement.po.deliveryAddress")}</p>
            </div>
            <p className="text-sm text-neutral-700">{po.delivery_address}</p>
          </div>
        )}
        {po.status === "issued" && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              {t("po.detailPage.issuedNotice")}
            </p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">list_alt</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("procurement.po.lineItems")}</h3>
          </div>
          <span className="text-sm font-bold text-primary">{po.currency} {(po.total_amount ?? 0).toLocaleString()}</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("procurement.detail.description")}</th>
              <th className="text-center">{t("procurement.po.qty")}</th>
              <th className="text-right">{t("procurement.po.unitPrice")}</th>
              <th className="text-right">{t("procurement.detail.total")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <TableEmpty colSpan={4} title="procurement.detail.noLineItems" />
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
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("procurement.receipts.title")}</h3>
          </div>
          {po.status === "issued" || po.status === "partially_received" ? (
            <Link href={`/procurement/receipts?po=${poId}`} className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">add</span>
              {t("procurement.receipts.record")}
            </Link>
          ) : null}
        </div>
        {(grns as { id: number; reference_number: string; received_date: string; status: string }[]).length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-400">{t("po.detailPage.noReceipts")}</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>{t("po.detailPage.grnRef")}</th><th>{t("procurement.receipts.receivedDate")}</th><th>{t("stock.common.status")}</th></tr></thead>
            <tbody>
              {(grns as { id: number; reference_number: string; received_date: string; status: string }[]).map((grn) => (
                <tr key={grn.id}>
                  <td><Link href={`/procurement/receipts/${grn.id}?po=${poId}`} className="btn-secondary font-mono text-xs">{grn.reference_number}</Link></td>
                  <td className="text-sm text-neutral-600">{grn.received_date ? formatDateShort(grn.received_date) : "—"}</td>
                  <td><span className={`badge ${grn.status === "accepted" ? "badge-success" : grn.status === "rejected" ? "badge-danger" : "badge-warning"}`}>{grn.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Link href="/procurement/purchase-orders" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        {t("po.detailPage.backToList")}
      </Link>
      </> /* end details tab */}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowCancelModal(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-neutral-900">{t("po.detailPage.cancelTitle")}</h2>
            {cancelError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cancelError}</div>}
            <textarea className="form-input w-full h-24 resize-none" placeholder={t("po.detailPage.cancelReason")} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowCancelModal(false)}>{t("common.back")}</button>
              <button
                disabled={cancelMutation.isPending || !cancelReason.trim()}
                onClick={() => cancelMutation.mutate()}
                className="flex-1 rounded-lg bg-red-600 text-white text-sm font-medium py-2 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {cancelMutation.isPending ? t("procurement.tenders.cancelling") : t("assignments.detail.confirmCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
