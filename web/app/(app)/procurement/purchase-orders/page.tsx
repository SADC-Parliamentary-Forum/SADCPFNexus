"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi, vendorsApi, procurementApi, type PurchaseOrder, type Vendor, type ProcurementRequest } from "@/lib/api";
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
  draft:              { label: "status.draft", cls: "badge-muted",    icon: "edit_note"      },
  issued:             { label: "procurement.poStatus.issued", cls: "badge-primary",  icon: "send"           },
  partially_received: { label: "procurement.poStatus.partReceived", cls: "badge-warning",  icon: "inventory"      },
  received:           { label: "procurement.poStatus.received", cls: "badge-success",  icon: "inventory_2"    },
  invoiced:           { label: "procurement.poStatus.invoiced", cls: "badge-primary",  icon: "request_quote"  },
  closed:             { label: "procurement.poStatus.closed", cls: "badge-muted",    icon: "check_circle"   },
  cancelled:          { label: "status.cancelled", cls: "badge-danger",   icon: "cancel"         },
};

const FILTERS = ["all", "draft", "issued", "partially_received", "received", "closed", "cancelled"];
const FILTER_LABEL_KEYS: Record<string, string> = {
  all: "procurement.filter.all",
  draft: "status.draft",
  issued: "procurement.poStatus.issued",
  partially_received: "procurement.poFilter.partiallyReceived",
  received: "procurement.poStatus.received",
  closed: "procurement.poStatus.closed",
  cancelled: "status.cancelled",
};

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

interface PoItemRow {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
}

function PurchaseOrdersPageInner() {
  const queryClient  = useQueryClient();
  const router       = useRouter();
  const toast        = useToast();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const requestParam = searchParams.get("request");

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal]       = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);

  // Form state
  const [selectedRequestId, setSelectedRequestId] = useState<number | "">(requestParam ? Number(requestParam) : "");
  const [selectedVendorId, setSelectedVendorId]   = useState<number | "">("");
  const [title, setTitle]                         = useState("");
  const [currency, setCurrency]                   = useState(DEFAULT_CURRENCY);
  const [expectedDelivery, setExpectedDelivery]   = useState("");
  const [paymentTerms, setPaymentTerms]           = useState("net_30");
  const [deliveryAddress, setDeliveryAddress]     = useState("");
  const [poItems, setPoItems]                     = useState<PoItemRow[]>([{ description: "", quantity: "1", unit: "unit", unit_price: "" }]);

  // Auto-open modal when navigated from awarded request
  useEffect(() => {
    if (requestParam) setShowModal(true);
  }, []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["purchase-orders", statusFilter],
    queryFn: () =>
      purchaseOrdersApi.list(statusFilter !== "all" ? { status: statusFilter } : undefined)
        .then((r) => r.data),
  });

  // Load approved vendors for selector
  const { data: vendorData } = useQuery({
    queryKey: ["vendors-approved"],
    queryFn: () => vendorsApi.list({ status: "approved", per_page: 100 }).then((r) => r.data),
    enabled: showModal,
  });

  const availableVendors: Vendor[] = (vendorData as { data?: Vendor[] })?.data ?? [];

  // Load awarded procurement requests
  const { data: requestData } = useQuery({
    queryKey: ["procurement-awarded"],
    queryFn: () => procurementApi.list({ status: "awarded", per_page: 100 }).then((r) => r.data),
    enabled: showModal,
  });

  const awardedRequests: ProcurementRequest[] = ((requestData as { data?: ProcurementRequest[] })?.data ?? []);

  // Fetch full request details (with items) when request is selected
  const { data: requestDetail } = useQuery({
    queryKey: ["procurement-request-detail", selectedRequestId],
    queryFn: () => procurementApi.get(Number(selectedRequestId)).then((r) => r.data),
    enabled: showModal && !!selectedRequestId,
  });

  // Pre-fill title and items from selected request
  useEffect(() => {
    if (requestDetail) {
      setTitle((requestDetail as ProcurementRequest).title ?? "");
      const reqItems = (requestDetail as ProcurementRequest).items ?? [];
      if (reqItems.length > 0) {
        setPoItems(reqItems.map((item) => ({
          description: item.description,
          quantity: String(item.quantity),
          unit: item.unit ?? "unit",
          unit_price: String(item.estimated_unit_price ?? ""),
        })));
      }
    }
  }, [requestDetail]);

  const openModal = () => {
    setSelectedRequestId("");
    setSelectedVendorId("");
    setTitle("");
    setCurrency(DEFAULT_CURRENCY);
    setExpectedDelivery("");
    setPaymentTerms("net_30");
    setDeliveryAddress("");
    setPoItems([{ description: "", quantity: "1", unit: "unit", unit_price: "" }]);
    setSubmitError(null);
    setShowModal(true);
  };

  const addItem = () => setPoItems((p) => [...p, { description: "", quantity: "1", unit: "unit", unit_price: "" }]);
  const removeItem = (idx: number) => setPoItems((p) => p.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof PoItemRow, value: string) => {
    setPoItems((p) => p.map((row, i) => i === idx ? { ...row, [field]: value } : row));
  };

  const totalAmount = poItems.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unit_price) || 0), 0);

  const createMutation = useMutation({
    mutationFn: () =>
      purchaseOrdersApi.create({
        procurement_request_id: Number(selectedRequestId),
        vendor_id: Number(selectedVendorId),
        title: title.trim(),
        currency,
        ...(expectedDelivery ? { expected_delivery_date: expectedDelivery } : {}),
        ...(paymentTerms ? { payment_terms: paymentTerms } : {}),
        ...(deliveryAddress.trim() ? { delivery_address: deliveryAddress.trim() } : {}),
        items: (poItems
          .filter((row) => row.description.trim())
          .map((row) => ({
            description: row.description.trim(),
            quantity: Number(row.quantity) || 1,
            unit: row.unit || "unit",
            unit_price: Number(row.unit_price) || 0,
          })) as unknown as import("@/lib/api").PurchaseOrderItem[]),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setShowModal(false);
      toast.success(t("procurement.po.created"));
      router.push(`/procurement/purchase-orders/${res.data.data.id}`);
    },
    onError: (e: unknown) => {
      const message = apiErrorMessage(e, t("procurement.po.createFailed"));
      setSubmitError(message);
      toast.error(t("procurement.po.notCreated"), message);
    },
  });

  const canSubmit = !!selectedRequestId && !!selectedVendorId && !!title.trim() && poItems.some((r) => r.description.trim());

  const items: PurchaseOrder[] = (data as { data?: PurchaseOrder[] })?.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (!q) return true;
      const hay = [p.reference_number, p.title, p.status, p.vendor?.name].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [items, search]);
  const lastPage = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const paged = useMemo(
    () => slicePage(filtered, Math.min(page, lastPage), DEFAULT_PAGE_SIZE),
    [filtered, page, lastPage],
  );
  const total   = items.length;
  const issued  = items.filter((p) => p.status === "issued").length;
  const received = items.filter((p) => p.status === "received").length;
  const pending = items.filter((p) => ["draft", "issued", "partially_received"].includes(p.status)).length;

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((p) => ({
        reference: p.reference_number,
        title: p.title,
        vendor: p.vendor?.name ?? "",
        status: p.status,
        amount: p.total_amount,
        currency: p.currency,
        issued_at: p.issued_at ?? "",
      })),
      [
        { key: "reference", header: t("procurement.col.reference") },
        { key: "title", header: t("procurement.col.title") },
        { key: "vendor", header: t("procurement.col.vendor") },
        { key: "status", header: t("procurement.col.status") },
        { key: "amount", header: t("procurement.col.amount") },
        { key: "currency", header: t("procurement.col.currency") },
        { key: "issued_at", header: t("procurement.poStatus.issued") },
      ],
    );
  };

  return (
    <div className="space-y-6">
      <ProcurementPageHeader
        title={t("procurement.purchaseOrders.title")}
        subtitle={t("procurement.po.subtitle")}
        crumbs={[
          { label: "nav.procurement", href: "/procurement" },
          { label: t("procurement.purchaseOrders.title") },
        ]}
        actions={
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            {t("procurement.exportCsv")}
          </button>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t("procurement.po.kpi.total"), value: total,    icon: "receipt_long",  color: "text-primary",    bg: "bg-primary/10"   },
          { label: t("procurement.poStatus.issued"), value: issued,   icon: "send",          color: "text-blue-600",   bg: "bg-blue-50"      },
          { label: t("procurement.poStatus.received"), value: received, icon: "inventory_2",   color: "text-green-600",  bg: "bg-green-50"     },
          { label: t("status.pending"), value: pending,  icon: "pending",       color: "text-amber-600",  bg: "bg-amber-50"     },
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
              placeholder={t("procurement.po.searchPlaceholder")}
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
        <div className="card p-6 text-center text-sm text-red-600">{t("procurement.po.loadError")}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="receipt_long"
          title={t("procurement.po.empty")}
          description={search.trim() ? t("procurement.po.emptySearch") : t("procurement.po.emptyHint")}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("procurement.po.col.reference")}</th>
                <th>{t("procurement.col.vendor")}</th>
                <th>{t("procurement.po.col.linkedRequest")}</th>
                <th className="text-right">{t("procurement.invoices.kpi.total")}</th>
                <th>{t("procurement.po.col.expectedDelivery")}</th>
                <th>{t("procurement.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((po) => {
                const s = statusConfig[po.status] ?? statusConfig.draft;
                return (
                  <tr key={po.id}>
                    <td>
                      <Link href={`/procurement/purchase-orders/${po.id}`} className="btn-secondary font-mono text-xs">
                        {po.reference_number}
                      </Link>
                    </td>
                    <td className="text-sm font-medium text-neutral-800">{po.vendor?.name ?? "—"}</td>
                    <td>
                      {po.procurement_request ? (
                        <Link href={`/procurement/${po.procurement_request.id}`} className="text-xs text-neutral-500 hover:text-primary font-mono">
                          {po.procurement_request.reference_number}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="text-right font-semibold text-neutral-900 text-sm">
                      {po.currency} {(po.total_amount ?? 0).toLocaleString()}
                    </td>
                    <td className="text-sm text-neutral-500">
                      {po.expected_delivery_date ? formatDateShort(po.expected_delivery_date) : "—"}
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
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* New Purchase Order Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-hide p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <span className="material-symbols-outlined text-[20px] text-primary">receipt_long</span>
              </div>
              <h2 className="text-base font-bold text-neutral-900">{t("procurement.po.modalTitle")}</h2>
            </div>

            {submitError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>
            )}

            <div className="space-y-4">
              {/* Procurement Request (required) */}
              <div className="space-y-1">
                <label htmlFor="procurement-purchase-orders-procurement-request" className="text-xs font-semibold text-neutral-600">
                  {t("travel.proc.select")} <span className="text-red-500">*</span>
                </label>
                <select id="procurement-purchase-orders-procurement-request"
                  className="form-input"
                  value={selectedRequestId}
                  onChange={(e) => {
                    setSelectedRequestId(e.target.value ? Number(e.target.value) : "");
                    // Reset items when switching request
                    setPoItems([{ description: "", quantity: "1", unit: "unit", unit_price: "" }]);
                  }}
                >
                  <option value="">{t("procurement.po.selectRequest")}</option>
                  {awardedRequests.map((r) => (
                    <option key={r.id} value={r.id}>{r.reference_number} — {r.title}</option>
                  ))}
                </select>
                {awardedRequests.length === 0 && (
                  <p className="text-xs text-amber-600">{t("procurement.po.noAwarded")}</p>
                )}
              </div>

              {/* Vendor (required) */}
              <div className="space-y-1">
                <label htmlFor="procurement-purchase-orders-vendor" className="text-xs font-semibold text-neutral-600">
                  {t("procurement.col.vendor")} <span className="text-red-500">*</span>
                </label>
                <select id="procurement-purchase-orders-vendor"
                  className="form-input"
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">{t("procurement.po.selectVendor")}</option>
                  {availableVendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                {availableVendors.length === 0 && (
                  <p className="text-xs text-amber-600">{t("procurement.po.noVendorsBefore")} <Link href="/procurement/vendors" className="btn-secondary text-xs py-0.5 px-2 inline-flex">{t("procurement.po.registerVendor")}</Link> {t("procurement.po.noVendorsAfter")}</p>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label htmlFor="procurement-purchase-orders-po-title" className="text-xs font-semibold text-neutral-600">{t("procurement.po.titleLabel")} <span className="text-red-500">*</span></label>
                <input id="procurement-purchase-orders-po-title"
                  type="text"
                  className="form-input"
                  placeholder={t("procurement.po.titlePlaceholder")}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="procurement-purchase-orders-currency" className="text-xs font-semibold text-neutral-600">{t("procurement.col.currency")}</label>
                  <input id="procurement-purchase-orders-currency"
                    type="text"
                    className="form-input"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="procurement-purchase-orders-payment-terms" className="text-xs font-semibold text-neutral-600">{t("procurement.po.paymentTerms")}</label>
                  <select id="procurement-purchase-orders-payment-terms" className="form-input" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
                    <option value="net_30">{t("procurement.po.terms.net30")}</option>
                    <option value="net_60">{t("procurement.po.terms.net60")}</option>
                    <option value="on_delivery">{t("procurement.po.terms.onDelivery")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="procurement-purchase-orders-expected-delivery-date" className="text-xs font-semibold text-neutral-600">{t("procurement.po.expectedDeliveryDate")}</label>
                  <input id="procurement-purchase-orders-expected-delivery-date" type="date" className="form-input" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label htmlFor="procurement-purchase-orders-delivery-address" className="text-xs font-semibold text-neutral-600">{t("procurement.po.deliveryAddress")}</label>
                  <input id="procurement-purchase-orders-delivery-address"
                    type="text"
                    className="form-input"
                    placeholder={t("procurement.po.deliveryPlaceholder")}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("procurement.po.lineItems")}</p>
                  <button
                    type="button"
                    onClick={addItem}
                    className="btn-secondary text-xs inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    {t("procurement.po.addItem")}
                  </button>
                </div>
                <div className="space-y-2">
                  {poItems.map((row, idx) => (
                    <div key={idx} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-4 space-y-1">
                        <label htmlFor="procurement-purchase-orders-description" className="text-[10px] font-semibold uppercase text-neutral-400">{t("procurement.create.description")}</label>
                        <input id="procurement-purchase-orders-description"
                          type="text"
                          className="form-input text-sm"
                          placeholder={t("procurement.po.itemPlaceholder")}
                          value={row.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label htmlFor="procurement-purchase-orders-qty" className="text-[10px] font-semibold uppercase text-neutral-400">{t("procurement.po.qty")}</label>
                        <input id="procurement-purchase-orders-qty"
                          type="number"
                          min="1"
                          className="form-input text-sm"
                          value={row.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label htmlFor="procurement-purchase-orders-unit" className="text-[10px] font-semibold uppercase text-neutral-400">{t("procurement.col.unit")}</label>
                        <input id="procurement-purchase-orders-unit"
                          type="text"
                          className="form-input text-sm"
                          placeholder={t("procurement.po.unitPlaceholder")}
                          value={row.unit}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <label htmlFor="procurement-purchase-orders-unit-price" className="text-[10px] font-semibold uppercase text-neutral-400">{t("procurement.po.unitPrice")}</label>
                        <input id="procurement-purchase-orders-unit-price"
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-input text-sm"
                          placeholder="0.00"
                          value={row.unit_price}
                          onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                        />
                      </div>
                      <div className="col-span-1 flex items-end pb-1">
                        {poItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="flex items-center justify-center h-8 w-8 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 transition-colors"
                            aria-label={t("procurement.create.removeItem")}
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {totalAmount > 0 && (
                  <div className="mt-3 text-right text-sm font-bold text-neutral-800">
                    {t("procurement.po.total", { amount: `${currency} ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` })}
                  </div>
                )}
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
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                )}
                {createMutation.isPending ? t("procurement.creating") : t("procurement.po.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={null}>
      <PurchaseOrdersPageInner />
    </Suspense>
  );
}
