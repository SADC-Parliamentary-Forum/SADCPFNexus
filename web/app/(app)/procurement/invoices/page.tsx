"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { invoicesApi, purchaseOrdersApi, goodsReceiptsApi, type Invoice, type PurchaseOrder, type GoodsReceiptNote } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";
import { ProcurementPageHeader } from "@/components/procurement/ProcurementPageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  received: { label: "procurement.invoiceStatus.received", cls: "badge-warning",  icon: "inbox"         },
  matched:  { label: "procurement.invoiceStatus.matched", cls: "badge-primary",  icon: "link"          },
  approved: { label: "status.approved", cls: "badge-success",  icon: "check_circle"  },
  approved_for_payment: { label: "status.approved", cls: "badge-success", icon: "check_circle" },
  proforma_submitted: { label: "procurement.invoiceStatus.proformaSubmitted", cls: "badge-primary", icon: "receipt_long" },
  final_invoice_submitted: { label: "procurement.invoiceStatus.finalSubmitted", cls: "badge-success", icon: "task_alt" },
  rejected: { label: "status.rejected", cls: "badge-danger",   icon: "cancel"        },
  paid:     { label: "procurement.invoiceStatus.paid", cls: "badge-muted",    icon: "payments"      },
};

const matchConfig: Record<string, { label: string; cls: string; icon: string }> = {
  pending:  { label: "status.pending", cls: "text-neutral-400", icon: "hourglass_empty" },
  matched:  { label: "procurement.invoiceStatus.matched", cls: "text-green-600",   icon: "check_circle"    },
  variance: { label: "procurement.invoices.variance", cls: "text-amber-600",   icon: "warning"         },
};

const FILTERS = ["all", "proforma_submitted", "received", "matched", "approved_for_payment", "rejected", "paid", "final_invoice_submitted"];

const FILTER_LABEL_KEYS: Record<string, string> = {
  all: "procurement.filter.all",
  proforma_submitted: "procurement.invoiceStatus.proformaSubmitted",
  received: "procurement.invoiceStatus.received",
  matched: "procurement.invoiceStatus.matched",
  approved_for_payment: "procurement.invoices.filter.approvedForPayment",
  rejected: "status.rejected",
  paid: "procurement.invoiceStatus.paid",
  final_invoice_submitted: "procurement.invoices.filter.finalInvoiceSubmitted",
};

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

export default function InvoicesPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
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
      toast.success(t("procurement.invoices.recorded"));
      router.push(`/procurement/invoices/${res.data.data.id}`);
    },
    onError: (e: unknown) => {
      const message = apiErrorMessage(e, t("procurement.invoices.recordFailed"));
      setSubmitError(message);
      toast.error(t("procurement.invoices.notRecorded"), message);
    },
  });

  const canSubmit = !!selectedPoId && !!selectedPO?.vendor?.id && !!vendorInvNumber.trim() && !!invoiceDate && !!dueDate && !!amount && Number(amount) > 0;

  const items: Invoice[] = (data as { data?: Invoice[] })?.data ?? [];
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const hay = [
        i.reference_number,
        i.vendor_invoice_number,
        i.status,
        i.vendor?.name,
        i.purchase_order?.reference_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);

  const lastPage = clientPageCount(filteredItems.length, DEFAULT_PAGE_SIZE);
  const pagedItems = useMemo(
    () => slicePage(filteredItems, Math.min(page, lastPage), DEFAULT_PAGE_SIZE),
    [filteredItems, page, lastPage],
  );

  const total    = items.length;
  const pending  = items.filter((i) => i.match_status === "pending").length;
  const matched  = items.filter((i) => i.match_status === "matched").length;
  const approved = items.filter((i) => ["approved", "approved_for_payment", "paid"].includes(i.status)).length;

  const handleExport = () => {
    if (filteredItems.length === 0) return;
    exportToCsv(
      `procurement-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredItems.map((i) => ({
        reference: i.reference_number,
        vendor_invoice: i.vendor_invoice_number,
        vendor: i.vendor?.name ?? "",
        status: i.status,
        match_status: i.match_status,
        amount: i.amount,
        currency: i.currency,
        invoice_date: i.invoice_date,
        due_date: i.due_date,
      })),
      [
        { key: "reference", header: t("procurement.col.reference") },
        { key: "vendor_invoice", header: t("procurement.invoices.csv.vendorInvoice") },
        { key: "vendor", header: t("procurement.col.vendor") },
        { key: "status", header: t("procurement.col.status") },
        { key: "match_status", header: t("procurement.invoices.match") },
        { key: "amount", header: t("procurement.col.amount") },
        { key: "currency", header: t("procurement.col.currency") },
        { key: "invoice_date", header: t("procurement.invoices.csv.invoiceDate") },
        { key: "due_date", header: t("procurement.invoices.csv.dueDate") },
      ],
    );
  };

  return (
    <div className="space-y-6">
      <ProcurementPageHeader
        title={t("procurement.invoices.title")}
        subtitle={t("procurement.invoices.subtitle")}
        crumbs={[
          { label: "nav.procurement", href: "/procurement" },
          { label: t("procurement.invoices.title") },
        ]}
        actions={
          <>
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
            disabled={filteredItems.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            {t("procurement.exportCsv")}
          </button>
          <button
            type="button"
            onClick={openModal}
            className="btn-primary inline-flex items-center gap-1.5 text-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            {t("procurement.invoices.record")}
          </button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t("procurement.invoices.kpi.total"), value: total,    icon: "request_quote", color: "text-primary",   bg: "bg-primary/10"  },
          { label: t("procurement.invoices.kpi.pendingMatch"), value: pending,  icon: "hourglass_empty",color: "text-amber-600", bg: "bg-amber-50"   },
          { label: t("procurement.invoiceStatus.matched"), value: matched,  icon: "link",          color: "text-blue-600",  bg: "bg-blue-50"     },
          { label: t("procurement.invoices.kpi.approvedPaid"), value: approved, icon: "check_circle",  color: "text-green-600", bg: "bg-green-50"    },
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
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder={t("procurement.invoices.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setStatusFilter(f);
                  setPage(1);
                }}
                className={`filter-tab capitalize ${statusFilter === f ? "active" : ""}`}
              >
                {FILTER_LABEL_KEYS[f] ? t(FILTER_LABEL_KEYS[f]) : f.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
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
        <div className="card p-6 text-center text-sm text-red-600">{t("procurement.invoices.loadError")}</div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon="request_quote"
          title={t("procurement.invoices.empty")}
          description={search.trim() ? t("procurement.invoices.emptySearch") : t("procurement.invoices.emptyHint")}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("procurement.invoices.col.reference")}</th>
                <th>{t("procurement.col.vendor")}</th>
                <th>{t("procurement.purchaseOrder")}</th>
                <th className="text-right">{t("procurement.col.amount")}</th>
                <th>{t("procurement.invoice.dueDate")}</th>
                <th>{t("procurement.invoices.match")}</th>
                <th>{t("procurement.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((inv) => {
                const s = statusConfig[inv.status] ?? statusConfig.received;
                const m = matchConfig[inv.match_status] ?? matchConfig.pending;
                return (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/procurement/invoices/${inv.id}`} className="btn-secondary font-mono text-xs">
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
                        {t(m.label)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${s.cls} inline-flex items-center gap-1`}>
                        <span className="material-symbols-outlined text-[11px]">{s.icon}</span>
                        {t(s.label)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ListPagination
            page={Math.min(page, lastPage)}
            lastPage={lastPage}
            total={filteredItems.length}
            onPageChange={setPage}
          />
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
              <h2 className="text-base font-bold text-neutral-900">{t("procurement.invoices.record")}</h2>
            </div>

            {submitError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>
            )}

            <div className="space-y-4">
              {/* PO selector */}
              <div className="space-y-1">
                <label htmlFor="procurement-invoices-purchase-order" className="text-xs font-semibold text-neutral-600">{t("procurement.purchaseOrder")} <span className="text-red-500">*</span></label>
                <select id="procurement-invoices-purchase-order"
                  className="form-input"
                  value={selectedPoId}
                  onChange={(e) => setSelectedPoId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">{t("procurement.invoices.selectPo")}</option>
                  {availablePOs.map((po) => (
                    <option key={po.id} value={po.id}>
                      {t("procurement.invoices.poOption", { ref: po.reference_number, vendor: po.vendor?.name ?? t("procurement.unknownVendor"), status: po.status })}
                    </option>
                  ))}
                </select>
              </div>

              {/* GRN selector (optional) */}
              {availableGRNs.length > 0 && (
                <div className="space-y-1">
                  <label htmlFor="procurement-invoices-goods-receipt-note-optional" className="text-xs font-semibold text-neutral-600">{t("procurement.invoices.grnOptional")}</label>
                  <select id="procurement-invoices-goods-receipt-note-optional"
                    className="form-input"
                    value={selectedGrnId}
                    onChange={(e) => setSelectedGrnId(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">{t("procurement.none")}</option>
                    {availableGRNs.map((g) => (
                      <option key={g.id} value={g.id}>{g.reference_number}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="procurement-invoices-vendor-invoice-number" className="text-xs font-semibold text-neutral-600">{t("procurement.invoices.vendorInvoiceNumber")} <span className="text-red-500">*</span></label>
                <input id="procurement-invoices-vendor-invoice-number"
                  type="text"
                  className="form-input"
                  placeholder={t("procurement.invoices.vendorInvoicePlaceholder")}
                  value={vendorInvNumber}
                  onChange={(e) => setVendorInvNumber(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="procurement-invoices-invoice-date" className="text-xs font-semibold text-neutral-600">{t("procurement.invoice.invoiceDate")} <span className="text-red-500">*</span></label>
                  <input id="procurement-invoices-invoice-date" type="date" className="form-input" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="procurement-invoices-due-date" className="text-xs font-semibold text-neutral-600">{t("procurement.invoice.dueDate")} <span className="text-red-500">*</span></label>
                  <input id="procurement-invoices-due-date" type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="procurement-invoices-amount" className="text-xs font-semibold text-neutral-600">{t("procurement.col.amount")} <span className="text-red-500">*</span></label>
                  <input id="procurement-invoices-amount"
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
                  <label htmlFor="procurement-invoices-currency" className="text-xs font-semibold text-neutral-600">{t("procurement.col.currency")}</label>
                  <input id="procurement-invoices-currency"
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
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>{t("common.cancel")}</button>
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
                {createMutation.isPending ? t("procurement.recording") : t("procurement.invoices.record")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
