"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { purchaseOrdersApi, vendorsApi, procurementApi, type PurchaseOrder, type Vendor, type ProcurementRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:              { label: "Draft",             cls: "badge-muted",    icon: "edit_note"      },
  issued:             { label: "Issued",            cls: "badge-primary",  icon: "send"           },
  partially_received: { label: "Part. Received",    cls: "badge-warning",  icon: "inventory"      },
  received:           { label: "Received",          cls: "badge-success",  icon: "inventory_2"    },
  invoiced:           { label: "Invoiced",          cls: "badge-primary",  icon: "request_quote"  },
  closed:             { label: "Closed",            cls: "badge-muted",    icon: "check_circle"   },
  cancelled:          { label: "Cancelled",         cls: "badge-danger",   icon: "cancel"         },
};

const FILTERS = ["all", "draft", "issued", "partially_received", "received", "closed", "cancelled"];

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

interface PoItemRow {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
}

export default function PurchaseOrdersPage() {
  const queryClient  = useQueryClient();
  const searchParams = useSearchParams();
  const requestParam = searchParams.get("request");

  const [statusFilter, setStatusFilter] = useState("all");
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
    queryFn: () => vendorsApi.list({ status: "approved" }).then((r) => r.data),
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
      window.location.href = `/procurement/purchase-orders/${res.data.data.id}`;
    },
    onError: (e: unknown) => {
      setSubmitError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to create purchase order."
      );
    },
  });

  const canSubmit = !!selectedRequestId && !!selectedVendorId && !!title.trim() && poItems.some((r) => r.description.trim());

  const items: PurchaseOrder[] = (data as { data?: PurchaseOrder[] })?.data ?? [];
  const total   = items.length;
  const issued  = items.filter((p) => p.status === "issued").length;
  const received = items.filter((p) => p.status === "received").length;
  const pending = items.filter((p) => ["draft", "issued", "partially_received"].includes(p.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-subtitle">Track issued POs, deliveries, and fulfilment</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openModal}
            className="btn-primary inline-flex items-center gap-1.5 text-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Purchase Order
          </button>
          <Link href="/procurement" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Requests
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total POs",   value: total,    icon: "receipt_long",  color: "text-primary",    bg: "bg-primary/10"   },
          { label: "Issued",      value: issued,   icon: "send",          color: "text-blue-600",   bg: "bg-blue-50"      },
          { label: "Received",    value: received, icon: "inventory_2",   color: "text-green-600",  bg: "bg-green-50"     },
          { label: "Pending",     value: pending,  icon: "pending",       color: "text-amber-600",  bg: "bg-amber-50"     },
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
            {f === "all" ? "All" : f.replace("_", " ")}
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
        <div className="card p-6 text-center text-sm text-red-600">Failed to load purchase orders.</div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-neutral-300">receipt_long</span>
          <p className="text-sm text-neutral-500">No purchase orders found.</p>
          <p className="text-xs text-neutral-400">Click "New Purchase Order" above to create one against an awarded request.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>PO Reference</th>
                <th>Vendor</th>
                <th>Linked Request</th>
                <th className="text-right">Total</th>
                <th>Expected Delivery</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((po) => {
                const s = statusConfig[po.status] ?? statusConfig.draft;
                return (
                  <tr key={po.id}>
                    <td>
                      <Link href={`/procurement/purchase-orders/${po.id}`} className="font-mono text-xs text-primary hover:underline">
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
              <h2 className="text-base font-bold text-neutral-900">New Purchase Order</h2>
            </div>

            {submitError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</div>
            )}

            <div className="space-y-4">
              {/* Procurement Request (required) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">
                  Procurement Request <span className="text-red-500">*</span>
                </label>
                <select
                  className="form-input"
                  value={selectedRequestId}
                  onChange={(e) => {
                    setSelectedRequestId(e.target.value ? Number(e.target.value) : "");
                    // Reset items when switching request
                    setPoItems([{ description: "", quantity: "1", unit: "unit", unit_price: "" }]);
                  }}
                >
                  <option value="">Select awarded request…</option>
                  {awardedRequests.map((r) => (
                    <option key={r.id} value={r.id}>{r.reference_number} — {r.title}</option>
                  ))}
                </select>
                {awardedRequests.length === 0 && (
                  <p className="text-xs text-amber-600">No awarded requests found. Award a procurement request first.</p>
                )}
              </div>

              {/* Vendor (required) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">
                  Vendor <span className="text-red-500">*</span>
                </label>
                <select
                  className="form-input"
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value ? Number(e.target.value) : "")}
                >
                  <option value="">Select vendor…</option>
                  {availableVendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                {availableVendors.length === 0 && (
                  <p className="text-xs text-amber-600">No approved vendors. <Link href="/procurement/vendors" className="underline">Register a vendor</Link> first.</p>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">PO Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Office Supplies Q2 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Payment Terms</label>
                  <select className="form-input" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
                    <option value="net_30">Net 30 days</option>
                    <option value="net_60">Net 60 days</option>
                    <option value="on_delivery">On Delivery</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Expected Delivery Date</label>
                  <input type="date" className="form-input" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Delivery Address</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Delivery location…"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">Line Items</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {poItems.map((row, idx) => (
                    <div key={idx} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-4 space-y-1">
                        <label className="text-[10px] font-semibold uppercase text-neutral-400">Description</label>
                        <input
                          type="text"
                          className="form-input text-sm"
                          placeholder="Item description…"
                          value={row.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-semibold uppercase text-neutral-400">Qty</label>
                        <input
                          type="number"
                          min="1"
                          className="form-input text-sm"
                          value={row.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-[10px] font-semibold uppercase text-neutral-400">Unit</label>
                        <input
                          type="text"
                          className="form-input text-sm"
                          placeholder="unit"
                          value={row.unit}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                        />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <label className="text-[10px] font-semibold uppercase text-neutral-400">Unit Price</label>
                        <input
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
                    Total: {currency} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
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
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                )}
                {createMutation.isPending ? "Creating…" : "Create Purchase Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
