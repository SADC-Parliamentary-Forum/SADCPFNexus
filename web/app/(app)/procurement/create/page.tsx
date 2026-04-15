"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  financeApi,
  procurementApi,
  procurementRequestAttachmentsApi,
  type Budget,
  type BudgetLine,
} from "@/lib/api";

const STEPS = ["Requisition Details", "Review & Submit"];

const CREATE_DOC_TYPES = [
  { value: "rfq_document", label: "Requisition Supporting Document" },
  { value: "bid_document", label: "Specification / Scope Document" },
  { value: "other", label: "Other" },
] as const;

type CreateDocType = typeof CREATE_DOC_TYPES[number]["value"];

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
    title: "",
    description: "",
    category: "goods",
    procurement_method: "quotation",
    budget_line: "",
    required_by_date: "",
    justification: "",
  });

  const [budgetsWithLines, setBudgetsWithLines] = useState<Array<Budget & { lines: BudgetLine[] }>>([]);
  const [budgetsLoading, setBudgetsLoading] = useState(true);
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

  const addFiles = (files: FileList | null) => {
    if (!files) return;

    const newDocs: StagedDoc[] = [];
    let seq = stagedIdSeq;

    Array.from(files).forEach((file) => {
      if (file.size > 25 * 1024 * 1024) return;
      newDocs.push({ id: seq++, file, docType: "rfq_document" });
    });

    setStagedIdSeq(seq);
    setStagedDocs((prev) => [...prev, ...newDocs]);
  };

  const removeStagedDoc = (id: number) => setStagedDocs((prev) => prev.filter((doc) => doc.id !== id));

  const updateStagedType = (id: number, docType: CreateDocType) =>
    setStagedDocs((prev) => prev.map((doc) => (doc.id === id ? { ...doc, docType } : doc)));

  const canNext = () =>
    !!form.title &&
    !!form.description &&
    !!form.category;

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
      });

      const created = res.data?.data;
      if (created?.id && stagedDocs.length > 0) {
        await Promise.allSettled(
          stagedDocs.map((doc) => procurementRequestAttachmentsApi.upload(created.id, doc.file, doc.docType))
        );
      }

      router.push("/procurement");
    } catch {
      router.push("/procurement");
    } finally {
      setSubmitting(false);
    }
  };

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
          Submit the requisition first. Specific items, pricing, and supplier quotations can be finalized later in the procurement process.
        </p>
      </div>

      <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-5">
        <div className="flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    index <= step ? "bg-primary text-white" : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {index < step ? <span className="material-symbols-outlined text-[14px]">check</span> : index + 1}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    index === step ? "text-primary" : index < step ? "text-neutral-700" : "text-neutral-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${index < step ? "bg-primary" : "bg-neutral-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

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
                <label className="block text-xs font-medium text-neutral-700">Procurement Method</label>
                <select
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={form.procurement_method}
                  onChange={(e) => set("procurement_method", e.target.value)}
                >
                  <option value="quotation">Request for Quotation</option>
                  <option value="tender">Open Tender</option>
                  <option value="direct">Direct Procurement</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-700">Budget Line</label>
                {budgetsLoading ? (
                  <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-400">
                    Loading budgets...
                  </div>
                ) : (
                  <select
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    value={form.budget_line}
                    onChange={(e) => set("budget_line", e.target.value)}
                  >
                    <option value="">Select budget line</option>
                    {budgetsWithLines.map((budget) =>
                      budget.lines && budget.lines.length > 0 ? (
                        <optgroup key={budget.id} label={`${budget.name} (${budget.year})`}>
                          {budget.lines.map((line) => (
                            <option key={line.id} value={line.account_code ?? `${budget.id}-${line.id}`}>
                              {line.account_code ? `${line.account_code} - ` : ""}
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
                <label className="block text-xs font-medium text-neutral-700">Required By Date</label>
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
                placeholder="Provide the business justification and expected outcome..."
                value={form.justification}
                onChange={(e) => set("justification", e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Supporting Documents</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Attach specifications, scopes of work, approval memos, or any other requisition support documents.
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

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-6 cursor-pointer transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-neutral-200 hover:border-primary/40 hover:bg-neutral-50"
              }`}
            >
              <span className="material-symbols-outlined text-[28px] text-neutral-300 mb-1">cloud_upload</span>
              <p className="text-xs text-neutral-500">
                Drag &amp; drop files here or <span className="text-primary font-medium">click to browse</span>
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">PDF, Word, Excel, images - max 25 MB each</p>
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
                  <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5">
                    <span className="material-symbols-outlined text-[18px] text-neutral-400 shrink-0">attach_file</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-800 truncate">{doc.file.name}</p>
                      <p className="text-[11px] text-neutral-400">{formatBytes(doc.file.size)}</p>
                    </div>
                    <select
                      value={doc.docType}
                      onChange={(e) => updateStagedType(doc.id, e.target.value as CreateDocType)}
                      className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    >
                      {CREATE_DOC_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
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

      {step === 1 && (
        <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-900">Review &amp; Submit</h3>
          <div className="space-y-2">
            {[
              { label: "Title", value: form.title },
              { label: "Category", value: form.category },
              { label: "Method", value: form.procurement_method },
              { label: "Budget Line", value: form.budget_line || "-" },
              { label: "Documents", value: `${stagedDocs.length} file(s) to upload` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2 border-b border-neutral-50">
                <span className="text-xs text-neutral-500 w-32">{label}</span>
                <span className="text-xs font-medium text-neutral-900 text-right">{value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">info</span>
            <p className="text-xs text-amber-700">
              This submission creates the procurement requisition only. Specific items and supplier quotations can be captured later after approval.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div>
          {step > 0 && (
            <button
              onClick={() => setStep((current) => current - 1)}
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
              onClick={() => setStep((current) => current + 1)}
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
              {submitting ? "Submitting..." : "Submit Requisition"}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
