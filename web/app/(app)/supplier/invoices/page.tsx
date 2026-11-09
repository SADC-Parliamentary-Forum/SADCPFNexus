"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ChangeEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  invoiceAttachmentsApi,
  supplierPortalApi,
  type Invoice,
  type PurchaseOrder,
} from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { TableEmpty } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type ModalState =
  | { mode: "proforma"; purchaseOrder: PurchaseOrder }
  | { mode: "final"; invoice: Invoice }
  | null;

const STATUS_KEYS: Record<string, string> = {
  proforma_submitted: "supplier.invoices.status.proforma_submitted",
  approved_for_payment: "supplier.invoices.status.approved_for_payment",
  final_invoice_submitted: "supplier.invoices.status.final_invoice_submitted",
  paid: "supplier.invoices.status.paid",
  rejected: "supplier.invoices.status.rejected",
  received: "supplier.invoices.status.received",
  matched: "supplier.invoices.status.matched",
  approved: "supplier.invoices.status.approved",
};

const statusConfig: Record<string, string> = {
  proforma_submitted: "badge-primary",
  approved_for_payment: "badge-warning",
  final_invoice_submitted: "badge-success",
  paid: "badge-muted",
  rejected: "badge-danger",
  received: "badge-warning",
  matched: "badge-primary",
  approved: "badge-success",
};

export default function SupplierInvoicesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const [modal, setModal] = useState<ModalState>(null);
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NAD");
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const invoicesQuery = useQuery({
    queryKey: ["supplier-invoices"],
    queryFn: () => supplierPortalApi.invoices().then((response) => response.data.data),
  });

  const purchaseOrdersQuery = useQuery({
    queryKey: ["supplier-purchase-orders"],
    queryFn: () => supplierPortalApi.purchaseOrders().then((response) => response.data.data),
  });

  const invoices = invoicesQuery.data ?? [];
  const purchaseOrders = purchaseOrdersQuery.data ?? [];

  const pendingProforma = useMemo(
    () =>
      purchaseOrders.filter((po) => {
        if (po.status !== "issued") return false;
        return !invoices.some((invoice) => invoice.purchase_order_id === po.id && invoice.status !== "rejected");
      }),
    [invoices, purchaseOrders]
  );

  const openProforma = (purchaseOrder: PurchaseOrder) => {
    setError(null);
    setVendorInvoiceNumber("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setAmount(String(purchaseOrder.total_amount ?? ""));
    setCurrency(purchaseOrder.currency ?? "NAD");
    setInvoiceFiles([]);
    setProofFiles([]);
    setModal({ mode: "proforma", purchaseOrder });
  };

  const openFinal = (invoice: Invoice) => {
    setError(null);
    setVendorInvoiceNumber(invoice.vendor_invoice_number ?? "");
    setInvoiceDate(invoice.invoice_date ? invoice.invoice_date.split("T")[0] : new Date().toISOString().split("T")[0]);
    setDueDate(invoice.due_date ? invoice.due_date.split("T")[0] : "");
    setAmount(String(invoice.amount ?? ""));
    setCurrency(invoice.currency ?? "NAD");
    setInvoiceFiles([]);
    setProofFiles([]);
    setModal({ mode: "final", invoice });
  };

  const resetModal = () => {
    setModal(null);
    setError(null);
  };

  const uploadFiles = async (invoiceId: number) => {
    const tasks = [
      ...invoiceFiles.map((file) =>
        invoiceAttachmentsApi.upload(invoiceId, file, modal?.mode === "proforma" ? "proforma_invoice" : "final_invoice")
      ),
      ...proofFiles.map((file) => invoiceAttachmentsApi.upload(invoiceId, file, "proof_of_payment")),
    ];
    if (tasks.length > 0) {
      await Promise.allSettled(tasks);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!modal) throw new Error("No target selected.");

      if (modal.mode === "proforma") {
        const response = await supplierPortalApi.submitProformaInvoice(modal.purchaseOrder.id, {
          vendor_invoice_number: vendorInvoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate,
          amount: Number(amount),
          currency,
        });
        await uploadFiles(response.data.data.id);
        return response;
      }

      const response = await supplierPortalApi.submitFinalInvoice(modal.invoice.id, {
        vendor_invoice_number: vendorInvoiceNumber || undefined,
        invoice_date: invoiceDate || undefined,
        due_date: dueDate || undefined,
        amount: amount ? Number(amount) : undefined,
        currency: currency || undefined,
      });
      await uploadFiles(response.data.data.id);
      return response;
    },
    onSuccess: async () => {
      const submittedMessage = modal?.mode === "proforma" ? t("supplier.invoices.toast.proformaSubmitted") : t("supplier.invoices.toast.finalSubmitted");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["supplier-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["supplier-purchase-orders"] }),
      ]);
      resetModal();
      toast.success(submittedMessage);
    },
    onError: (mutationError: unknown) => {
      const message = apiErrorMessage(mutationError, t("supplier.invoices.submitFailed"));
      setError(message);
      toast.error(t("supplier.invoices.toast.notSubmitted"), message);
    },
  });

  const handleFiles = (setter: (files: File[]) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    setter(Array.from(event.target.files ?? []));
  };

  if (invoicesQuery.isLoading || purchaseOrdersQuery.isLoading) return <div className="card p-6">{t("supplier.invoices.loading")}</div>;
  if (invoicesQuery.isError || purchaseOrdersQuery.isError) return <div className="card p-6">{t("supplier.invoices.loadFailed")}</div>;

  return (
    <div className="space-y-5">
      <ModulePageHeader
        title={t("supplier.dashboard.invoices")}
        subtitle={t("supplier.invoices.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("supplier.dashboard.invoices") }]} />}
      />

      {pendingProforma.length > 0 && (
        <div className="card p-5 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-800">{t("supplier.invoices.actionRequired")}</h2>
            <p className="text-xs text-neutral-400">{t("supplier.invoices.actionHint")}</p>
          </div>
          <div className="space-y-3">
            {pendingProforma.map((purchaseOrder) => (
              <div key={purchaseOrder.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-900">{purchaseOrder.reference_number}</p>
                  <p className="text-xs text-neutral-500">
                    {purchaseOrder.currency} {(purchaseOrder.total_amount ?? 0).toLocaleString()} | {t("supplier.invoices.issuedOn", { date: purchaseOrder.issued_at ? formatDateShort(purchaseOrder.issued_at) : "-" })}
                  </p>
                </div>
                <button className="btn-primary text-xs px-3 py-1.5" onClick={() => openProforma(purchaseOrder)}>
                  {t("supplier.invoices.submitProforma")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>{t("leave.certifyQueue.col.reference")}</th>
              <th>{t("supplier.invoices.col.vendorInvoice")}</th>
              <th>{t("supplier.invoices.col.amount")}</th>
              <th>{t("assignments.handover.colStatus")}</th>
              <th>{t("assignments.create.dueDate")}</th>
              <th>{t("supplier.rfqs.col.action")}</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <TableEmpty colSpan={6} title={t("supplier.invoices.empty")} />
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="font-mono text-xs text-neutral-600">{invoice.reference_number}</td>
                  <td>{invoice.vendor_invoice_number}</td>
                  <td>{invoice.currency} {(invoice.amount ?? 0).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${statusConfig[invoice.status] ?? "badge-muted"}`}>{STATUS_KEYS[invoice.status] ? t(STATUS_KEYS[invoice.status]) : invoice.status.replaceAll("_", " ")}</span>
                  </td>
                  <td>{invoice.due_date ? formatDateShort(invoice.due_date) : "-"}</td>
                  <td>
                    {invoice.status === "paid" ? (
                      <button className="btn-primary text-xs px-3 py-1.5" onClick={() => openFinal(invoice)}>
                        {t("supplier.invoices.submitFinal")}
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-400">{t("supplier.invoices.noAction")}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={resetModal}>
          <div className="card w-full max-w-lg p-6 space-y-4" onClick={(event) => event.stopPropagation()}>
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                {modal.mode === "proforma" ? t("supplier.invoices.submitProforma") : t("supplier.invoices.submitFinalTitle")}
              </h2>
              <p className="text-xs text-neutral-500">
                {modal.mode === "proforma"
                  ? t("supplier.invoices.poRef", { ref: modal.purchaseOrder.reference_number })
                  : t("supplier.invoices.invoiceRef", { ref: modal.invoice.reference_number })}
              </p>
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div>
              <label htmlFor="invoice-vendor-number" className="mb-1 block text-xs font-semibold text-neutral-700">{t("supplier.invoices.vendorNumber")}</label>
              <input
                id="invoice-vendor-number"
                className="form-input w-full"
                placeholder={t("supplier.invoices.vendorNumber")}
                value={vendorInvoiceNumber}
                onChange={(event) => setVendorInvoiceNumber(event.target.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="invoice-date" className="mb-1 block text-xs font-semibold text-neutral-700">{t("supplier.invoices.invoiceDate")}</label>
                <input id="invoice-date" type="date" className="form-input w-full" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
              </div>
              <div>
                <label htmlFor="invoice-due-date" className="mb-1 block text-xs font-semibold text-neutral-700">{t("risk.mitigation.dueDate")}</label>
                <input id="invoice-due-date" type="date" className="form-input w-full" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                placeholder={t("supplier.invoices.col.amount")} aria-label={t("supplier.invoices.col.amount")}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <input className="form-input" aria-label={t("settings.hr.allowance.currency")} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
            </div>

            <div className="space-y-2">
              <label htmlFor="supplier-invoices-field" className="block text-xs font-semibold text-neutral-700">
                {modal.mode === "proforma" ? t("supplier.invoices.proformaFiles") : t("supplier.invoices.finalFiles")}
              </label>
              <input id="supplier-invoices-field" type="file" multiple onChange={handleFiles(setInvoiceFiles)} />
            </div>

            {modal.mode === "final" && (
              <div className="space-y-2">
                <label htmlFor="supplier-invoices-proof" className="block text-xs font-semibold text-neutral-700">{t("supplier.invoices.proofFiles")}</label>
                <input id="supplier-invoices-proof" type="file" multiple onChange={handleFiles(setProofFiles)} />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={resetModal}>{t("common.cancel")}</button>
              <button
                className="btn-primary flex-1"
                disabled={
                  submitMutation.isPending ||
                  !vendorInvoiceNumber.trim() ||
                  !invoiceDate ||
                  !amount ||
                  (modal.mode === "proforma" && !dueDate)
                }
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? t("supplier.submitting") : modal.mode === "proforma" ? t("supplier.invoices.submitProformaShort") : t("supplier.invoices.submitFinalPackage")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
