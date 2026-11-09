"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  financeApi,
  procurementApi,
  procurementRequestAttachmentsApi,
  type Budget,
  type BudgetLine,
} from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useFormDraft } from "@/lib/useFormDraft";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STEPS = ["procurement.create.step.details", "procurement.create.step.review"];

const CREATE_DOC_TYPES = [
  { value: "rfq_document", label: "procurement.create.docType.rfq" },
  { value: "bid_document", label: "procurement.create.docType.bid" },
  { value: "other", label: "stock.movementModal.reason.other" },
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
  const toast = useToast();
  const { t, localeTag } = useI18n();
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [splitWarning, setSplitWarning] = useState<string | null>(null);
  const [splitJustification, setSplitJustification] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autosave the text fields locally (staged files cannot be persisted). Once
  // created, a retry updates and submits the same requisition and does not
  // re-upload documents that were already attached.
  const draft = useFormDraft("procurement.create", form);
  const createdIdRef = useRef<number | null>(null);
  const uploadedDocIds = useRef<Set<number>>(new Set());
  const restoreDraft = () => {
    const v = draft.restore();
    if (v) setForm((p) => ({ ...p, ...v }));
  };

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
    setSubmitError(null);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category as "goods" | "services" | "works",
        procurement_method: form.procurement_method as "quotation" | "tender" | "direct",
        budget_line: form.budget_line || undefined,
        required_by_date: form.required_by_date || undefined,
        justification: form.justification || undefined,
      };
      const existingId = createdIdRef.current;
      const res = existingId
        ? await procurementApi.update(existingId, payload)
        : await procurementApi.create(payload, `${draft.operationKey}:create`);

      const created = res.data?.data;
      if (created?.id) {
        createdIdRef.current = created.id;
        draft.clear();
      }
      const pendingDocs = stagedDocs.filter((doc) => !uploadedDocIds.current.has(doc.id));
      if (created?.id && pendingDocs.length > 0) {
        const results = await Promise.allSettled(
          pendingDocs.map((doc) => procurementRequestAttachmentsApi.upload(created.id, doc.file, doc.docType))
        );
        results.forEach((r, i) => {
          if (r.status === "fulfilled") uploadedDocIds.current.add(pendingDocs[i].id);
        });
      }

      if (!asDraft && created?.id) {
        try {
          await procurementApi.submit(created.id, splitJustification.trim() ? { split_justification: splitJustification.trim() } : undefined);
        } catch (err: unknown) {
          const axiosErr = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
          const splitMsg = axiosErr.response?.data?.errors?.split_justification?.[0];
          if (splitMsg) {
            setSplitWarning(splitMsg);
            setSubmitError(t("procurement.create.splitDetected"));
            toast.warning(t("procurement.create.savedNotSubmitted"), splitMsg);
            router.push(`/procurement/${created.id}`);
            return;
          }
          throw err;
        }
      }

      toast.success(asDraft ? t("procurement.create.savedDraft") : t("procurement.create.submitted"));
      router.push(created?.id ? `/procurement/${created.id}` : "/procurement");
    } catch (err) {
      const message = apiErrorMessage(err, t("procurement.create.createFailed"));
      setSubmitError(message);
      toast.error(asDraft ? t("procurement.create.notSaved") : t("procurement.create.notSubmitted"), message);
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
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("procurement.create.title")}
        subtitle={t("procurement.create.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("nav.procurement"), href: "/procurement" }, { label: t("procurement.index.newRequisition") }]} />}
      />

      {draft.restorable && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800" role="status">
          <span className="material-symbols-outlined text-[16px]">history</span>
          <span className="flex-1">
            {t("procurement.create.draftFound", { date: new Date(draft.restorable.savedAt).toLocaleString(localeTag) })}
          </span>
          <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={restoreDraft}>{t("procurement.create.restore")}</button>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={draft.discard}>{t("procurement.create.discard")}</button>
        </div>
      )}

      <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 shadow-card p-5">
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
                  {t(label)}
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
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 shadow-card p-6 space-y-5">
            <h3 className="text-sm font-semibold text-neutral-900">{t("procurement.create.step.details")}</h3>

            <div className="space-y-1.5">
              <label htmlFor="procurement-create-requisition-title" className="block text-xs font-medium text-neutral-700">
                {t("procurement.create.titleLabel")} <span className="text-red-500">*</span>
              </label>
              <input id="procurement-create-requisition-title"
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                placeholder={t("procurement.create.titlePlaceholder")}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="procurement-create-category" className="block text-xs font-medium text-neutral-700">
                  {t("procurement.certificate.category")} <span className="text-red-500">*</span>
                </label>
                <select id="procurement-create-category"
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  <option value="goods">{t("procurement.category.goods")}</option>
                  <option value="services">{t("procurement.category.services")}</option>
                  <option value="works">{t("procurement.category.works")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="procurement-create-procurement-method" className="block text-xs font-medium text-neutral-700">{t("procurement.create.method")}</label>
                <select id="procurement-create-procurement-method"
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={form.procurement_method}
                  onChange={(e) => set("procurement_method", e.target.value)}
                >
                  <option value="quotation">{t("procurement.method.quotation")}</option>
                  <option value="tender">{t("procurement.method.tender")}</option>
                  <option value="direct">{t("procurement.method.direct")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="procurement-create-budget-line" className="block text-xs font-medium text-neutral-700">{t("procurement.budgetLine")}</label>
                {budgetsLoading ? (
                  <div className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-400">
                    {t("procurement.create.loadingBudgets")}
                  </div>
                ) : (
                  <select
                    id="procurement-create-budget-line"
                    className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    value={form.budget_line}
                    onChange={(e) => set("budget_line", e.target.value)}
                  >
                    <option value="">{t("procurement.create.selectBudgetLine")}</option>
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
                <label htmlFor="procurement-create-required-by-date" className="block text-xs font-medium text-neutral-700">{t("procurement.create.requiredBy")}</label>
                <input id="procurement-create-required-by-date"
                  type="date"
                  className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  value={form.required_by_date}
                  onChange={(e) => set("required_by_date", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="procurement-create-description" className="block text-xs font-medium text-neutral-700">
                {t("procurement.create.description")} <span className="text-red-500">*</span>
              </label>
              <textarea id="procurement-create-description"
                rows={3}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                placeholder={t("procurement.create.descriptionPlaceholder")}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="procurement-create-justification" className="block text-xs font-medium text-neutral-700">{t("procurement.create.justification")}</label>
              <textarea id="procurement-create-justification"
                rows={2}
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                placeholder={t("procurement.create.justificationPlaceholder")}
                value={form.justification}
                onChange={(e) => set("justification", e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">{t("procurement.create.supportingDocs")}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {t("procurement.create.supportingDocsHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[15px]">attach_file</span>
                {t("procurement.create.attachFile")}
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
                {t("procurement.create.dropHint")} <span className="text-primary font-medium">{t("procurement.create.browse")}</span>
              </p>
              <p className="text-[11px] text-neutral-400 mt-1">{t("procurement.create.fileTypes")}</p>
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
                      className="rounded-md border border-neutral-200 bg-white dark:bg-neutral-900 px-2 py-1 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    >
                      {CREATE_DOC_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {t(type.label)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeStagedDoc(doc.id)}
                      aria-label={t("procurement.create.removeItem")}
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
        <div className="rounded-xl bg-white dark:bg-neutral-900 border border-neutral-100 shadow-card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-900">{t("procurement.create.step.review")}</h3>
          {submitError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{submitError}</div>
          )}
          {splitWarning && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-3 space-y-2">
              <p className="text-sm text-amber-800">{splitWarning}</p>
              <label htmlFor="procurement-create-split-justification" className="block text-xs font-semibold text-amber-900">{t("procurement.create.splitJustification")}</label>
              <textarea id="procurement-create-split-justification"
                className="form-input w-full h-20 resize-none text-sm"
                placeholder={t("procurement.create.splitPlaceholder")}
                value={splitJustification}
                onChange={(e) => setSplitJustification(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            {[
              { label: t("procurement.col.title"), value: form.title },
              { label: t("procurement.certificate.category"), value: form.category },
              { label: t("procurement.col.method"), value: form.procurement_method },
              { label: t("procurement.budgetLine"), value: form.budget_line || "-" },
              { label: t("procurement.tab.documents"), value: t("procurement.create.filesToUpload", { count: stagedDocs.length }) },
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
              {t("procurement.create.reviewNote")}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div>
          {step > 0 && (
            <button
              onClick={() => setStep((current) => current - 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              {t("common.back")}
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="rounded-lg border border-neutral-200 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            {t("procurement.create.saveDraft")}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((current) => current + 1)}
              disabled={!canNext()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("procurement.create.nextStep")}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? t("procurement.submitting") : t("procurement.create.submit")}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
