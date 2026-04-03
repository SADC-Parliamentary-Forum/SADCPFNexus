"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  financeApi,
  procurementApi,
  procurementRequestAttachmentsApi,
  type Budget,
  type BudgetLine,
} from "@/lib/api";

const STEPS = ["Item Details", "Vendor Quotes", "Review & Submit"];

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "USD";

const CREATE_DOC_TYPES = [
  { value: "quote_received",  label: "Quote / Quotation"      },
  { value: "rfq_document",    label: "RFQ / Tender Document"  },
  { value: "signed_po",       label: "Purchase Order (PO)"    },
  { value: "tax_invoice",     label: "Tax Invoice"            },
  { value: "bid_document",    label: "Bid Document"           },
  { value: "other",           label: "Other"                  },
] as const;

type CreateDocType = typeof CREATE_DOC_TYPES[number]["value"];

interface Item {
  id: number;
  description: string;
  quantity: string;
  unit: string;
  estimated_unit_price: string;
}

interface Quote {
  id: number;
  vendor_name: string;
  quoted_amount: string;
  is_recommended: boolean;
  notes: string;
}

interface StagedDoc {
  id: number;
  file: File;
  docType: CreateDocType;
}

interface FormData {
  title: string;
  description: string;
  category: string;
  procurement_method: string;
  budget_line: string;
  required_by_date: string;
  justification: string;
  items: Item[];
  quotes: Quote[];
}

function getListData<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

export default function ProcurementCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormData>({
    title: "", description: "", category: "goods",
    procurement_method: "quotation", budget_line: "",
    required_by_date: "", justification: "",
    items: [{ id: 1, description: "", quantity: "1", unit: "unit", estimated_unit_price: "" }],
    quotes: [
      { id: 1, vendor_name: "", quoted_amount: "", is_recommended: false, notes: "" },
      { id: 2, vendor_name: "", quoted_amount: "", is_recommended: false, notes: "" },
      { id: 3, vendor_name: "", quoted_amount: "", is_recommended: false, notes: "" },
    ],
  });

  // Budget lines
  const [budgetsWithLines, setBudgetsWithLines] = useState<Array<Budget & { lines: BudgetLine[] }>>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(true);

  // Staged documents
  const [stagedDocs, setStagedDocs] = useState<StagedDoc[]>([]);
  const [stagedIdSeq, setStagedIdSeq] = useState(1);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    financeApi
      .listBudgets({ per_page: 100 })
      .then(async (res) => {
        const list = getListData<Budget>(res.data);
        const withLines = await Promise.all(
          list.map(async (b) => {
            try {
              const detail = await financeApi.getBudget(b.id);
              const payload = detail.data;
              const d =
                payload && typeof payload === "object" && "data" in payload
                  ? (payload as { data: Budget }).data
                  : null;
              return { ...b, lines: d?.lines ?? [] };
            } catch {
              return { ...b, lines: [] };
            }
          })
        );
        setBudgetsWithLines(withLines);
      })
      .catch(() => {})
      .finally(() => setBudgetsLoading(false));
  }, []);

  const set = (f: keyof FormData, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const totalEstimated = form.items.reduce(
    (s, i) => s + (parseFloat(i.estimated_unit_price) || 0) * (parseInt(i.quantity) || 0),
    0
  );

  const addItem = () =>
    setForm((p) => ({
      ...p,
      items: [
        ...p.items,
        { id: Date.now(), description: "", quantity: "1", unit: "unit", estimated_unit_price: "" },
      ],
    }));
  const removeItem = (id: number) =>
    setForm((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));
  const updateItem = (id: number, field: keyof Item, value: string) =>
    setForm((p) => ({
      ...p,
      items: p.items.map((i) => (i.id === id ? { ...i, [field]: value } : i)),
    }));

  const updateQuote = (id: number, field: keyof Quote, value: string | boolean) =>
    setForm((p) => ({
      ...p,
      quotes: p.quotes.map((q) => (q.id === id ? { ...q, [field]: value } : q)),
    }));

  const setRecommended = (id: number) =>
    setForm((p) => ({
      ...p,
      quotes: p.quotes.map((q) => ({ ...q, is_recommended: q.id === id })),
    }));

  // Staged document helpers
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newDocs: StagedDoc[] = [];
    let seq = stagedIdSeq;
    Array.from(files).forEach((file) => {
      if (file.size > 25 * 1024 * 1024) return; // 25 MB limit
      newDocs.push({ id: seq++, file, docType: "quote_received" });
    });
    setStagedIdSeq(seq);
    setStagedDocs((prev) => [...prev, ...newDocs]);
  };

  const removeStagedDoc = (id: number) =>
    setStagedDocs((prev) => prev.filter((d) => d.id !== id));

  const updateStagedType = (id: number, docType: CreateDocType) =>
    setStagedDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, docType } : d))
    );

  const canNext = () => {
    if (step === 0)
      return (
        form.title && form.description && form.category && form.items.every((i) => i.description)
      );
    if (step === 1)
      return (
        form.procurement_method === "direct" ||
        form.quotes.filter((q) => q.vendor_name && q.quoted_amount).length >=
          (form.procurement_method === "quotation" ? 3 : 1)
      );
    return true;
  };

  const handleSubmit = async (asDraft: boolean) => {
    setSubmitting(true);
    try {
      const res = await procurementApi.create({
        title: form.title,
        description: form.description,
        category: form.category as "goods" | "services" | "works",
        procurement_method: form.procurement_method as "quotation" | "tender" | "direct",
        budget_line: form.budget_line || undefined,
        required_by_date: form.required_by_date || undefined,
        justification: form.justification || undefined,
        status: asDraft ? "draft" : "submitted",
        items: form.items.map((i) => ({
          description: i.description,
          quantity: parseInt(i.quantity) || 1,
          unit: i.unit,
          estimated_unit_price: parseFloat(i.estimated_unit_price) || 0,
        })) as never,
        quotes: form.quotes
          .filter((q) => q.vendor_name && q.quoted_amount)
          .map((q) => ({
            vendor_name: q.vendor_name,
            quoted_amount: parseFloat(q.quoted_amount),
            is_recommended: q.is_recommended,
            notes: q.notes || undefined,
          })) as never,
      });

      const created = res.data?.data;
      if (created?.id && stagedDocs.length > 0) {
        await Promise.allSettled(
          stagedDocs.map((d) =>
            procurementRequestAttachmentsApi.upload(created.id, d.file, d.docType)
          )
        );
      }

      router.push("/procurement");
    } catch {
      // If API fails fall back to route push so the user isn't stuck
      router.push("/procurement");
    } finally {
      setSubmitting(false);
    }
  };

  const filledQuotes = form.quotes.filter((q) => q.vendor_name && q.quoted_amount);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
          <Link href="/procurement" className="hover:text-primary transition-colors">
            Procurement
          </Link>
          <span>/</span>
          <span className="text-neutral-700 font-medium">New Requisition</span>
        </div>
        <h2 className="text-xl font-bold text-neutral-900">New Procurement Requisition</h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Submit a request to procure goods, services, or works.
        </p>
      </div>

      {/* Stepper */}
      <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-5">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    i <= step ? "bg-primary text-white" : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {i < step ? (
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    i === step ? "text-primary" : i < step ? "text-neutral-700" : "text-neutral-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${i < step ? "bg-primary" : "bg-neutral-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 0: Item Details */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-6 space-y-5">
            <h3 className="text-sm font-semibold text-neutral-900">Requisition Details</h3>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700">
                Requisition Title <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                placeholder="e.g. Office Furniture for Conference Room"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-700">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  <option value="goods">Goods</option>
                  <option value="services">Services</option>
                  <option value="works">Works</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-700">
                  Procurement Method
                </label>
                <select
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={form.procurement_method}
                  onChange={(e) => set("procurement_method", e.target.value)}
                >
                  <option value="quotation">Three Quotes</option>
                  <option value="tender">Open Tender</option>
                  <option value="direct">Direct Award</option>
                </select>
              </div>

              {/* Budget Line — dropdown from Finance module */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-700">Budget Line</label>
                {budgetsLoading ? (
                  <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-400">
                    Loading budgets…
                  </div>
                ) : (
                  <select
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    value={form.budget_line}
                    onChange={(e) => set("budget_line", e.target.value)}
                  >
                    <option value="">— Select budget line —</option>
                    {budgetsWithLines.map((budget) =>
                      budget.lines && budget.lines.length > 0 ? (
                        <optgroup
                          key={budget.id}
                          label={`${budget.name} (${budget.year})`}
                        >
                          {budget.lines.map((line) => (
                            <option
                              key={line.id}
                              value={line.account_code ?? `${budget.id}-${line.id}`}
                            >
                              {line.account_code ? `${line.account_code} — ` : ""}
                              {line.description ?? line.category}
                            </option>
                          ))}
                        </optgroup>
                      ) : (
                        <option key={budget.id} value={String(budget.id)}>
                          {budget.name} ({budget.year})
                        </option>
                      )
                    )}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-700">
                  Required By Date
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={form.required_by_date}
                  onChange={(e) => set("required_by_date", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                placeholder="Describe what is being procured and why it is needed..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700">Justification</label>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                placeholder="Provide business justification for this procurement..."
                value={form.justification}
                onChange={(e) => set("justification", e.target.value)}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Line Items</h3>
              <button
                onClick={addItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {form.items.map((item, i) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Item {i + 1}
                    </span>
                    {form.items.length > 1 && (
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-4 sm:col-span-2 space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-600">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <input
                        className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        placeholder="Item description"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-600">Qty</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-600">Unit</label>
                      <input
                        className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        placeholder="unit"
                        value={item.unit}
                        onChange={(e) => updateItem(item.id, "unit", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-600">
                        Unit Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full rounded-md border border-neutral-200 bg-white pl-5 pr-2.5 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          placeholder="0.00"
                          value={item.estimated_unit_price}
                          onChange={(e) =>
                            updateItem(item.id, "estimated_unit_price", e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-end justify-end">
                      <span className="text-xs font-semibold text-primary">
                        $
                        {(
                          (parseFloat(item.estimated_unit_price) || 0) *
                          (parseInt(item.quantity) || 0)
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center rounded-lg bg-primary/5 border border-primary/10 px-4 py-3">
              <span className="text-sm font-medium text-neutral-700">Total Estimated Value</span>
              <span className="text-base font-bold text-primary">
                {DEFAULT_CURRENCY} {totalEstimated.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Supporting Documents */}
          <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Supporting Documents</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Attach quotes, POs, invoices or other documents received externally.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">attach_file</span>
                Attach File
              </button>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-6 cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-neutral-200 hover:border-primary/40 hover:bg-neutral-50"
              }`}
            >
              <span className="material-symbols-outlined text-[28px] text-neutral-300 mb-1">
                cloud_upload
              </span>
              <p className="text-xs text-neutral-500">
                Drag &amp; drop files here or{" "}
                <span className="text-primary font-medium">click to browse</span>
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">
                PDF, Word, Excel, images — max 25 MB each
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />

            {stagedDocs.length > 0 && (
              <div className="space-y-2">
                {stagedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5"
                  >
                    <span className="material-symbols-outlined text-[18px] text-neutral-400 shrink-0">
                      attach_file
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-800 truncate">
                        {doc.file.name}
                      </p>
                      <p className="text-[11px] text-neutral-400">{formatBytes(doc.file.size)}</p>
                    </div>
                    <select
                      value={doc.docType}
                      onChange={(e) => updateStagedType(doc.id, e.target.value as CreateDocType)}
                      className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    >
                      {CREATE_DOC_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeStagedDoc(doc.id)}
                      className="text-neutral-400 hover:text-red-500 transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 1: Vendor Quotes */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Vendor Quotes</h3>
              {form.procurement_method === "quotation" && (
                <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  Minimum 3 quotes required
                </span>
              )}
              {form.procurement_method === "direct" && (
                <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">info</span>
                  Direct award — 1 vendor
                </span>
              )}
            </div>

            <div className="space-y-4">
              {form.quotes.map((quote, i) => (
                <div
                  key={quote.id}
                  className={`rounded-xl border p-4 space-y-3 transition-all ${
                    quote.is_recommended
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      Quote {i + 1}
                    </span>
                    {quote.is_recommended && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <span className="material-symbols-outlined text-[14px]">star</span>
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-600">
                        Vendor Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        placeholder="e.g. Office World Ltd"
                        value={quote.vendor_name}
                        onChange={(e) => updateQuote(quote.id, "vendor_name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-600">
                        Quoted Amount ({DEFAULT_CURRENCY}) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-full rounded-md border border-neutral-200 bg-white pl-5 pr-2.5 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                          placeholder="0.00"
                          value={quote.quoted_amount}
                          onChange={(e) => updateQuote(quote.id, "quoted_amount", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <label className="block text-[11px] font-medium text-neutral-600">Notes</label>
                      <input
                        className="w-full rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-sm placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        placeholder="Delivery time, warranty, payment terms..."
                        value={quote.notes}
                        onChange={(e) => updateQuote(quote.id, "notes", e.target.value)}
                      />
                    </div>
                  </div>
                  {quote.vendor_name && quote.quoted_amount && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => setRecommended(quote.id)}
                        className={`text-xs font-semibold rounded-full px-3 py-1 border transition-colors ${
                          quote.is_recommended
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-neutral-600 border-neutral-200 hover:border-primary hover:text-primary"
                        }`}
                      >
                        {quote.is_recommended ? "★ Recommended" : "Recommend This"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {filledQuotes.length >= 2 && (
              <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-4">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Quote Comparison
                </p>
                <div className="space-y-2">
                  {filledQuotes
                    .sort((a, b) => parseFloat(a.quoted_amount) - parseFloat(b.quoted_amount))
                    .map((q, i) => (
                      <div key={q.id} className="flex items-center justify-between text-sm">
                        <span className="text-neutral-700">
                          {i + 1}. {q.vendor_name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-900">
                            {DEFAULT_CURRENCY} {parseFloat(q.quoted_amount).toLocaleString()}
                          </span>
                          {i === 0 && (
                            <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                              Lowest
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-900">Review &amp; Submit</h3>
          <div className="space-y-2">
            {[
              { label: "Title",       value: form.title },
              { label: "Category",    value: form.category },
              { label: "Method",      value: form.procurement_method },
              { label: "Budget Line", value: form.budget_line || "—" },
              { label: "Items",       value: `${form.items.length} line item(s)` },
              { label: "Est. Value",  value: `${DEFAULT_CURRENCY} ${totalEstimated.toFixed(2)}` },
              { label: "Quotes",      value: `${filledQuotes.length} vendor quote(s)` },
              { label: "Documents",   value: `${stagedDocs.length} file(s) to upload` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2 border-b border-neutral-50">
                <span className="text-xs text-neutral-500 w-32">{label}</span>
                <span className="text-xs font-medium text-neutral-900">{value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">info</span>
            <p className="text-xs text-amber-700">
              This request will be routed through the procurement approval matrix based on the total
              value. Ensure all required quotes are attached before submitting.
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next Step
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Requisition"}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
