"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  invoiceAttachmentsApi,
  supplierPortalApi,
  type Invoice,
  type PurchaseOrder,
} from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

type ModalState =
  | { mode: "proforma"; purchaseOrder: PurchaseOrder }
  | { mode: "final"; invoice: Invoice }
  | null;

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["supplier-invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["supplier-purchase-orders"] }),
      ]);
      resetModal();
    },
    onError: (mutationError: unknown) => {
      setError(
        (mutationError as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to submit invoice."
      );
    },
  });

  const handleFiles = (setter: (files: File[]) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    setter(Array.from(event.target.files ?? []));
  };

  if (invoicesQuery.isLoading || purchaseOrdersQuery.isLoading) return <div className="card p-6">Loading invoices...</div>;
  if (invoicesQuery.isError || purchaseOrdersQuery.isError) return <div className="card p-6">Failed to load invoices.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Invoices</h1>
        <p className="page-subtitle">Submit proforma invoices after PO issue, then upload the final invoice and proof of payment after finance pays.</p>
      </div>

      {pendingProforma.length > 0 && (
        <div className="card p-5 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-800">Action Required</h2>
            <p className="text-xs text-neutral-400">These issued purchase orders are waiting for your proforma invoice.</p>
          </div>
          <div className="space-y-3">
            {pendingProforma.map((purchaseOrder) => (
              <div key={purchaseOrder.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-neutral-900">{purchaseOrder.reference_number}</p>
                  <p className="text-xs text-neutral-500">
                    {purchaseOrder.currency} {(purchaseOrder.total_amount ?? 0).toLocaleString()} | Issued {purchaseOrder.issued_at ? formatDateShort(purchaseOrder.issued_at) : "-"}
                  </p>
                </div>
                <button className="btn-primary text-xs px-3 py-1.5" onClick={() => openProforma(purchaseOrder)}>
                  Submit Proforma Invoice
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
              <th>Reference</th>
              <th>Vendor Invoice</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-neutral-500">No invoices submitted yet.</td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="font-mono text-xs text-neutral-600">{invoice.reference_number}</td>
                  <td>{invoice.vendor_invoice_number}</td>
                  <td>{invoice.currency} {(invoice.amount ?? 0).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${statusConfig[invoice.status] ?? "badge-muted"}`}>{invoice.status.replaceAll("_", " ")}</span>
                  </td>
                  <td>{invoice.due_date ? formatDateShort(invoice.due_date) : "-"}</td>
                  <td>
                    {invoice.status === "paid" ? (
                      <button className="btn-primary text-xs px-3 py-1.5" onClick={() => openFinal(invoice)}>
                        Submit Final Invoice
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-400">No action</span>
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
                {modal.mode === "proforma" ? "Submit Proforma Invoice" : "Submit Final Invoice and Proof of Payment"}
              </h2>
              <p className="text-xs text-neutral-500">
                {modal.mode === "proforma"
                  ? `Purchase Order ${modal.purchaseOrder.reference_number}`
                  : `Invoice ${modal.invoice.reference_number}`}
              </p>
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <input
              className="form-input"
              placeholder="Supplier invoice number"
              value={vendorInvoiceNumber}
              onChange={(event) => setVendorInvoiceNumber(event.target.value)}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input type="date" className="form-input" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
              <input type="date" className="form-input" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                placeholder="Amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <input className="form-input" value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-700">
                {modal.mode === "proforma" ? "Proforma invoice file(s)" : "Final invoice file(s)"}
              </label>
              <input type="file" multiple onChange={handleFiles(setInvoiceFiles)} />
            </div>

            {modal.mode === "final" && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-neutral-700">Proof of payment supporting file(s)</label>
                <input type="file" multiple onChange={handleFiles(setProofFiles)} />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={resetModal}>Cancel</button>
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
                {submitMutation.isPending ? "Submitting..." : modal.mode === "proforma" ? "Submit Proforma" : "Submit Final Package"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
