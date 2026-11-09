"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { canIssueProcurementRfq, getStoredUser } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/apiError";
import { isBudgetConfirmed } from "@/lib/procurementBudget";
import {
  procurementApi,
  quoteAttachmentsApi,
  quotesApi,
  supplierCategoriesApi,
  vendorsApi,
  type CreateQuotePayload,
  type ProcurementAttachment,
  type ProcurementQuote,
  type ProcurementRequest,
  type Vendor,
} from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ProcurementPageHeader } from "@/components/procurement/ProcurementPageHeader";
import { NexusPicker } from "@/components/ui/NexusPicker";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

function canManage() {
  return canIssueProcurementRfq(getStoredUser());
}

type Assessment = "pending" | "pass" | "fail";

type QuoteForm = {
  vendor_name: string;
  vendor_id: number | null;
  quoted_amount: string;
  currency: string;
  quote_date: string;
  notes: string;
  compliance_passed: Assessment;
  compliance_notes: string;
  is_recommended: boolean;
};

const emptyQuoteForm = (currency: string): QuoteForm => ({
  vendor_name: "",
  vendor_id: null,
  quoted_amount: "",
  currency,
  quote_date: "",
  notes: "",
  compliance_passed: "pending",
  compliance_notes: "",
  is_recommended: false,
});

export default function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const reqId = Number(id);
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const quoteFileInputRef = useRef<HTMLInputElement>(null);
  const manager = canManage();
  const [showIssue, setShowIssue] = useState(false);
  const [rfqDeadline, setRfqDeadline] = useState("");
  const [rfqNotes, setRfqNotes] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [externalInvites, setExternalInvites] = useState([{ name: "", email: "" }]);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<ProcurementQuote | null>(null);
  const [quoteForm, setQuoteForm] = useState<QuoteForm>(emptyQuoteForm(DEFAULT_CURRENCY));
  const [quoteFiles, setQuoteFiles] = useState<File[]>([]);
  const [uploadTargetQuoteId, setUploadTargetQuoteId] = useState<number | null>(null);
  const [uploadingQuoteId, setUploadingQuoteId] = useState<number | null>(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<number | null>(null);
  const [showAward, setShowAward] = useState(false);
  const [awardQuoteId, setAwardQuoteId] = useState<number | "">("");
  const [awardNotes, setAwardNotes] = useState("");
  const [coiDeclared, setCoiDeclared] = useState(false);
  const [coiHasConflict, setCoiHasConflict] = useState(false);
  const [coiNotes, setCoiNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const requestQuery = useQuery({
    queryKey: ["rfq-request", reqId],
    queryFn: () => procurementApi.get(reqId).then((r) => r.data as unknown as ProcurementRequest),
    enabled: Number.isFinite(reqId),
  });
  const quotesQuery = useQuery({
    queryKey: ["rfq-quotes", reqId],
    queryFn: () => quotesApi.list(reqId).then((r) => r.data.data),
    enabled: Number.isFinite(reqId),
  });
  const categoriesQuery = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierCategoriesApi.list().then((r) => r.data.data),
    enabled: manager,
  });

  const req = requestQuery.data ?? null;
  const quotes = (quotesQuery.data ?? []) as ProcurementQuote[];
  const categories = categoriesQuery.data ?? [];
  const currency = req?.currency ?? DEFAULT_CURRENCY;

  useEffect(() => {
    if (!req) return;
    setRfqDeadline(req.rfq_deadline ? req.rfq_deadline.split("T")[0] : "");
    setRfqNotes(req.rfq_notes ?? "");
    setCategoryIds((req.supplierCategories ?? []).map((item) => item.id));
    setQuoteForm(emptyQuoteForm(req.currency ?? DEFAULT_CURRENCY));
  }, [req]);

  const eligibleQuotes = useMemo(
    () => quotes.filter((quote) => quote.assessed_at && quote.compliance_passed === true),
    [quotes]
  );
  const sortedQuotes = useMemo(
    () => [...quotes].sort((a, b) => (a.quoted_amount ?? 0) - (b.quoted_amount ?? 0)),
    [quotes]
  );

  const resetQuoteModal = () => {
    setShowQuoteModal(false);
    setEditingQuote(null);
    setQuoteForm(emptyQuoteForm(currency));
    setQuoteFiles([]);
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const downloadAttachment = async (attachment: ProcurementAttachment, url: string) => {
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = attachment.original_filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      setError(t("procurement.rfqDetail.downloadFailed"));
    }
  };

  const refreshQuotes = async () => {
    await quotesQuery.refetch();
    await queryClient.invalidateQueries({ queryKey: ["rfq-request", reqId] });
  };

  const uploadQuoteFiles = async (quoteId: number, files: File[]) => {
    if (files.length === 0) return false;

    setUploadingQuoteId(quoteId);

    try {
      const results = await Promise.allSettled(
        files.map((file) => quoteAttachmentsApi.upload(reqId, quoteId, file))
      );
      await refreshQuotes();
      return results.some((result) => result.status === "rejected");
    } finally {
      setUploadingQuoteId(null);
      setUploadTargetQuoteId(null);
      if (quoteFileInputRef.current) quoteFileInputRef.current.value = "";
    }
  };

  const deleteQuoteAttachment = async (quoteId: number, attachmentId: number) => {
    setDeletingAttachmentId(attachmentId);

    try {
      await quoteAttachmentsApi.delete(reqId, quoteId, attachmentId);
      await refreshQuotes();
      setError(null);
      toast.success(t("procurement.rfqDetail.attachmentDeleted"));
    } catch (err: unknown) {
      const message = apiErrorMessage(err, t("procurement.rfqDetail.attachmentDeleteFailed"));
      setError(message);
      toast.error(t("procurement.rfqDetail.attachmentNotDeleted"), message);
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const issueMutation = useMutation({
    mutationFn: () =>
      procurementApi.issueRfq(reqId, {
        rfq_deadline: rfqDeadline || undefined,
        rfq_notes: rfqNotes || undefined,
        category_ids: categoryIds,
        external_invites: externalInvites.filter((invite) => invite.email.trim()).map((invite) => ({
          name: invite.name.trim() || undefined,
          email: invite.email.trim(),
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-request", reqId] });
      setShowIssue(false);
      setError(null);
      toast.success(t("procurement.rfqDetail.issued"));
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, t("procurement.rfq.issueFailed"));
      setError(message);
      toast.error(t("procurement.rfqDetail.notIssued"), message);
    },
  });

  const saveQuoteMutation = useMutation({
    mutationFn: () => {
      const isAssessing = !!editingQuote;
      const payload: CreateQuotePayload & { coi_declared?: boolean; coi_has_conflict?: boolean; coi_notes?: string } = {
        vendor_name: quoteForm.vendor_name.trim(),
        vendor_id: quoteForm.vendor_id,
        quoted_amount: Number(quoteForm.quoted_amount),
        currency: quoteForm.currency || currency,
        quote_date: quoteForm.quote_date || undefined,
        notes: quoteForm.notes.trim() || undefined,
        compliance_passed: quoteForm.compliance_passed === "pending" ? null : quoteForm.compliance_passed === "pass",
        compliance_notes: quoteForm.compliance_notes.trim() || undefined,
        is_recommended: quoteForm.is_recommended,
      };
      if (isAssessing) {
        payload.coi_declared = coiDeclared;
        payload.coi_has_conflict = coiHasConflict;
        payload.coi_notes = coiNotes.trim() || undefined;
      }
      return editingQuote ? quotesApi.update(reqId, editingQuote.id, payload) : quotesApi.create(reqId, payload);
    },
    onSuccess: async (response) => {
      const savedQuote = response.data.data;
      const uploadFailed = await uploadQuoteFiles(savedQuote.id, quoteFiles);

      if (!quoteFiles.length) {
        await refreshQuotes();
      }

      resetQuoteModal();
      setError(uploadFailed ? t("procurement.rfqDetail.savedUploadFailed") : null);
      if (uploadFailed) {
        toast.warning(t("procurement.rfqDetail.quoteSaved"), t("procurement.rfqDetail.filesFailed"));
      } else {
        toast.success(t("procurement.rfqDetail.quoteSaved"));
      }
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, t("procurement.rfqDetail.saveFailed"));
      setError(message);
      toast.error(t("procurement.rfqDetail.quoteNotSaved"), message);
    },
  });

  const awardMutation = useMutation({
    mutationFn: () =>
      procurementApi.award(reqId, Number(awardQuoteId), {
        award_notes: awardNotes || undefined,
        coi_declared: coiDeclared,
        coi_has_conflict: coiHasConflict,
        coi_notes: coiNotes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-request", reqId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setShowAward(false);
      setAwardQuoteId("");
      setAwardNotes("");
      setCoiDeclared(false);
      setCoiHasConflict(false);
      setCoiNotes("");
      setError(null);
      toast.success(t("procurement.rfqDetail.awarded"));
    },
    onError: (err: unknown) => {
      const message = apiErrorMessage(err, t("procurement.rfqDetail.awardFailed"));
      setError(message);
      toast.error(t("procurement.rfqDetail.awardFailedTitle"), message);
    },
  });

  if (requestQuery.isLoading) return <div className="w-full min-w-0 card p-6">{t("procurement.rfqDetail.loading")}</div>;
  if (requestQuery.isError || !req) return <div className="w-full min-w-0 card p-6">{t("procurement.rfqDetail.notFound")}</div>;

  const budgetConfirmed = isBudgetConfirmed(req);
  const canIssueNow = budgetConfirmed;

  return (
    <div className="w-full min-w-0 space-y-5">
      <ProcurementPageHeader
        title={req.title}
        subtitle={req.reference_number}
        crumbs={[
          { label: "nav.procurement", href: "/procurement" },
          { label: t("procurement.rfqDetail.crumb"), href: "/procurement/rfq" },
          { label: req.reference_number },
        ]}
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-neutral-900">{req.title}</p>
            <p className="font-mono text-xs text-neutral-400">{req.reference_number}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-primary">{req.status}</span>
            {manager && req.status !== "awarded" && eligibleQuotes.length > 0 && (
              <button className="btn-primary text-xs px-3 py-1.5" onClick={() => setShowAward(true)}>{t("procurement.rfqDetail.awardContract")}</button>
            )}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4 text-sm">
          <div><p className="text-xs text-neutral-400">{t("procurement.certificate.category")}</p><p>{req.category}</p></div>
          <div><p className="text-xs text-neutral-400">{t("procurement.col.method")}</p><p>{req.procurement_method ?? "quotation"}</p></div>
          <div><p className="text-xs text-neutral-400">{t("procurement.rfqDetail.estimated")}</p><p>{currency} {(req.estimated_value ?? 0).toLocaleString()}</p></div>
          <div><p className="text-xs text-neutral-400">{t("procurement.rfqDetail.requiredBy")}</p><p>{req.required_by_date ? formatDateShort(req.required_by_date) : "-"}</p></div>
        </div>
        {req.description && <p className="text-sm text-neutral-600">{req.description}</p>}
      </div>

      {!budgetConfirmed && req.status !== "awarded" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("procurement.rfqDetail.budgetRequired")}{" "}
          <Link href="/procurement/budget" className="btn-secondary text-xs font-medium">
            {t("procurement.rfq.openBudget")}
          </Link>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-800">{t("procurement.rfqDetail.initiation")}</h2>
            <p className="text-xs text-neutral-400">
              {req.rfq_issued_at
                ? t("procurement.rfqDetail.issuedOn", { date: formatDateShort(req.rfq_issued_at) })
                : budgetConfirmed
                  ? t("procurement.rfqDetail.targetHint")
                  : t("procurement.rfqDetail.waitingBudget")}
            </p>
          </div>
          {manager && req.status !== "awarded" && canIssueNow && (
            <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => setShowIssue((v) => !v)}>
              {req.rfq_issued_at ? t("procurement.rfqDetail.update") : t("procurement.rfq.issue")}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(req.supplierCategories ?? []).map((category) => (
            <span key={category.id} className="badge badge-primary">{category.name}</span>
          ))}
          {(req.supplierCategories ?? []).length === 0 && <span className="text-xs text-neutral-400">{t("procurement.rfqDetail.noCategories")}</span>}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-xs text-neutral-400">{t("procurement.rfqDetail.portalSuppliers")}</p>
            <p className="text-2xl font-bold">{(req.rfqInvitations ?? []).filter((i) => i.invitation_type === "system").length}</p>
          </div>
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-xs text-neutral-400">{t("procurement.rfqDetail.emailInvitees")}</p>
            <p className="text-2xl font-bold">{(req.rfqInvitations ?? []).filter((i) => i.invitation_type === "email").length}</p>
          </div>
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-xs text-neutral-400">{t("procurement.col.deadline")}</p>
            <p className="text-sm font-semibold">{req.rfq_deadline ? formatDateShort(req.rfq_deadline) : t("procurement.rfqDetail.notSet")}</p>
          </div>
        </div>

        {showIssue && (
          <div className="space-y-4 border-t border-neutral-100 pt-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <div className="grid gap-2 md:grid-cols-2">
              {categories.map((category) => (
                <label htmlFor="procurement-rfq-detail-setcategoryids-current-current-includes-category" key={category.id} className={`rounded-xl border p-3 text-sm ${categoryIds.includes(category.id) ? "border-primary bg-primary/5" : "border-neutral-200"}`}>
                  <input id="procurement-rfq-detail-setcategoryids-current-current-includes-category"
                    type="checkbox"
                    className="mr-2"
                    checked={categoryIds.includes(category.id)}
                    onChange={() =>
                      setCategoryIds((current) =>
                        current.includes(category.id)
                          ? current.filter((id) => id !== category.id)
                          : [...current, category.id]
                      )
                    }
                  />
                  {category.name}
                </label>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <input type="date" className="form-input" value={rfqDeadline} onChange={(e) => setRfqDeadline(e.target.value)} />
              <textarea className="form-input h-[42px] resize-none" placeholder={t("procurement.rfqDetail.notesPlaceholder")} value={rfqNotes} onChange={(e) => setRfqNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              {externalInvites.map((invite, index) => (
                <div key={index} className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
                  <input className="form-input" placeholder={t("procurement.rfq.supplierName")} value={invite.name} onChange={(e) => setExternalInvites((current) => current.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} />
                  <input className="form-input" placeholder={t("procurement.rfq.emailPlaceholder")} value={invite.email} onChange={(e) => setExternalInvites((current) => current.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} />
                  <button className="btn-secondary" onClick={() => setExternalInvites((current) => current.length === 1 ? [{ name: "", email: "" }] : current.filter((_, i) => i !== index))}>{t("procurement.remove")}</button>
                </div>
              ))}
              <button className="text-xs text-primary" onClick={() => setExternalInvites((current) => [...current, { name: "", email: "" }])}>{t("procurement.rfqDetail.addInvite")}</button>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setShowIssue(false)}>{t("common.cancel")}</button>
              <button className="btn-primary disabled:opacity-60" disabled={issueMutation.isPending || categoryIds.length === 0 || !canIssueNow} onClick={() => issueMutation.mutate()}>
                {issueMutation.isPending ? t("procurement.rfqDetail.saving") : req.rfq_issued_at ? t("procurement.rfqDetail.update") : t("procurement.rfq.issue")}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-800">{t("procurement.rfqDetail.assessment")}</h2>
            <p className="text-xs text-neutral-400">{t("procurement.rfqDetail.assessmentHint")}</p>
          </div>
          {manager && req.status !== "awarded" && <button className="btn-primary text-xs px-3 py-1.5" onClick={() => { setEditingQuote(null); setQuoteForm(emptyQuoteForm(currency)); setQuoteFiles([]); setShowQuoteModal(true); }}>{t("procurement.rfqDetail.recordQuote")}</button>}
        </div>
        {sortedQuotes.length === 0 ? <p className="text-sm text-neutral-500">{t("procurement.rfqDetail.noQuotes")}</p> : (
          <div className="space-y-3">
            {sortedQuotes.map((quote, index) => (
              <div key={quote.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      <p className="font-semibold text-neutral-900">{quote.vendor_name}</p>
                      {index === 0 && <span className="badge badge-success">{t("procurement.rfqDetail.lowest")}</span>}
                      {quote.is_recommended && <span className="badge badge-primary">{t("procurement.rfqDetail.recommended")}</span>}
                      {quote.compliance_passed === true && <span className="badge badge-success">{t("procurement.rfqDetail.compliant")}</span>}
                      {quote.compliance_passed === false && <span className="badge badge-danger">{t("procurement.rfqDetail.nonCompliant")}</span>}
                    </div>
                    <p className="text-sm text-neutral-700">{quote.currency ?? currency} {(quote.quoted_amount ?? 0).toLocaleString()}</p>
                    <p className="text-xs text-neutral-500">
                      {quote.quote_date ? t("procurement.rfqDetail.quotedOn", { date: formatDateShort(quote.quote_date) }) : t("procurement.rfqDetail.noQuoteDate")}
                      {quote.assessed_at ? t("procurement.rfqDetail.assessedOn", { date: formatDateShort(quote.assessed_at) }) : ""}
                    </p>
                    {quote.notes && <p className="text-xs text-neutral-600">{quote.notes}</p>}
                    {quote.compliance_notes && <p className="text-xs text-neutral-600">{quote.compliance_notes}</p>}
                    {(quote.attachments?.length ?? 0) > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("procurement.rfqDetail.submittedFiles")}</p>
                        <div className="space-y-2">
                          {(quote.attachments ?? []).map((attachment) => (
                            <div key={attachment.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2">
                              <span className="material-symbols-outlined text-[16px] text-neutral-400">attach_file</span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-neutral-800">{attachment.original_filename}</p>
                                <p className="text-[11px] text-neutral-400">
                                  {formatBytes(attachment.size_bytes)}
                                  {attachment.uploader?.name ? ` · ${attachment.uploader.name}` : ""}
                                  {attachment.created_at ? ` · ${formatDateShort(attachment.created_at)}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => downloadAttachment(attachment, quoteAttachmentsApi.downloadUrl(reqId, quote.id, attachment.id))}
                                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                                >
                                  {t("common.download")}
                                </button>
                                {manager && req.status !== "awarded" && (
                                  <button
                                    type="button"
                                    onClick={() => deleteQuoteAttachment(quote.id, attachment.id)}
                                    disabled={deletingAttachmentId === attachment.id}
                                    className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                                  >
                                    {deletingAttachmentId === attachment.id ? t("procurement.rfqDetail.removing") : t("procurement.remove")}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-neutral-400">{t("procurement.rfqDetail.noSubmittedDocs")}</p>
                    )}
                  </div>
                  {manager && req.status !== "awarded" && (
                    <div className="flex flex-col items-end gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs px-3 py-1.5"
                        disabled={uploadingQuoteId === quote.id}
                        onClick={() => {
                          setUploadTargetQuoteId(quote.id);
                          quoteFileInputRef.current?.click();
                        }}
                      >
                        {uploadingQuoteId === quote.id ? t("procurement.rfqDetail.uploading") : t("procurement.rfqDetail.uploadSubmitted")}
                      </button>
                      <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => {
                        setEditingQuote(quote);
                        setQuoteForm({
                          vendor_name: quote.vendor_name,
                          vendor_id: quote.vendor_id ?? null,
                          quoted_amount: String(quote.quoted_amount),
                          currency: quote.currency ?? currency,
                          quote_date: quote.quote_date ? quote.quote_date.split("T")[0] : "",
                          notes: quote.notes ?? "",
                          compliance_passed: quote.compliance_passed === true ? "pass" : quote.compliance_passed === false ? "fail" : "pending",
                          compliance_notes: quote.compliance_notes ?? "",
                          is_recommended: quote.is_recommended,
                        });
                        setQuoteFiles([]);
                        setShowQuoteModal(true);
                      }}>{t("procurement.rfqDetail.assess")}</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(req.purchaseOrder || req.purchase_order || req.po_link) && (
        <div className="card p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-800">{t("procurement.purchaseOrder")}</h2>
            <p className="text-xs text-neutral-400 font-mono">
              {req.po_link?.display_reference ?? req.purchaseOrder?.lpo_number ?? req.purchase_order?.lpo_number ?? req.purchaseOrder?.reference_number ?? req.purchase_order?.reference_number}
              {req.converted_to_po ? t("procurement.rfqDetail.convertedToPo") : ""}
            </p>
          </div>
          <Link href={`/procurement/purchase-orders/${req.po_link?.id ?? req.purchaseOrder?.id ?? req.purchase_order?.id}`} className="btn-primary text-xs px-3 py-1.5">
            {t("procurement.rfqDetail.openPo")}
          </Link>
        </div>
      )}

      <Link href="/procurement/rfq" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        {t("procurement.rfqDetail.backToRfqs")}
      </Link>

      {manager && (
        <input
          ref={quoteFileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            if (!uploadTargetQuoteId || files.length === 0) return;

            const uploadFailed = await uploadQuoteFiles(uploadTargetQuoteId, files);
            setError(uploadFailed ? t("procurement.rfqDetail.quoteFilesFailed") : null);
            if (uploadFailed) {
              toast.error(t("procurement.rfqDetail.quoteFilesNotUploaded"), t("procurement.rfqDetail.quoteFilesFailed"));
            } else {
              toast.success(t("procurement.rfqDetail.quoteFilesUploaded"));
            }
          }}
        />
      )}

      {showQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={resetQuoteModal}>
          <div className="card w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold">{editingQuote ? t("procurement.rfqDetail.assessQuote") : t("procurement.rfqDetail.recordQuote")}</h2>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <NexusPicker<Vendor>
              id="quote-supplier-picker"
              label={t("procurement.rfqDetail.supplier")}
              value={quoteForm.vendor_id ? { id: quoteForm.vendor_id, name: quoteForm.vendor_name } as Vendor : null}
              onSelect={(vendor) =>
                setQuoteForm((current) => ({
                  ...current,
                  vendor_id: vendor?.id ?? null,
                  vendor_name: vendor ? vendor.name : current.vendor_name,
                }))
              }
              fetchOptions={async (search) => {
                const res = await vendorsApi.list({ search: search || undefined, per_page: 10 });
                return res.data.data ?? [];
              }}
              getId={(v) => v.id}
              getLabel={(v) => v.name}
              placeholder={t("procurement.rfqDetail.searchSuppliers")}
              hint={t("procurement.rfqDetail.supplierHint")}
            />
            <label htmlFor="quote-supplier-name" className="block text-xs font-semibold text-neutral-700">
              {t("procurement.rfq.supplierName")} {quoteForm.vendor_id ? t("procurement.rfqDetail.fromSelection") : t("procurement.rfqDetail.notRegistered")}
              <input
                id="quote-supplier-name"
                className="form-input mt-1.5"
                value={quoteForm.vendor_name}
                disabled={Boolean(quoteForm.vendor_id)}
                onChange={(e) => setQuoteForm((current) => ({ ...current, vendor_name: e.target.value }))}
              />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label htmlFor="quote-amount" className="block text-xs font-semibold text-neutral-700">
                {t("procurement.col.amount")}
                <input id="quote-amount" type="number" min="0.01" step="0.01" className="form-input mt-1.5" value={quoteForm.quoted_amount} onChange={(e) => setQuoteForm((current) => ({ ...current, quoted_amount: e.target.value }))} />
              </label>
              <label htmlFor="quote-currency" className="block text-xs font-semibold text-neutral-700">
                {t("procurement.col.currency")}
                <input id="quote-currency" className="form-input mt-1.5" value={quoteForm.currency} onChange={(e) => setQuoteForm((current) => ({ ...current, currency: e.target.value.toUpperCase() }))} />
              </label>
              <label htmlFor="quote-date" className="block text-xs font-semibold text-neutral-700">
                {t("procurement.rfqDetail.quoteDate")}
                <input id="quote-date" type="date" className="form-input mt-1.5" value={quoteForm.quote_date} onChange={(e) => setQuoteForm((current) => ({ ...current, quote_date: e.target.value }))} />
              </label>
            </div>
            <textarea className="form-input h-20 resize-none" placeholder={t("procurement.rfqDetail.commercialNotes")} value={quoteForm.notes} onChange={(e) => setQuoteForm((current) => ({ ...current, notes: e.target.value }))} />
            <select className="form-input" value={quoteForm.compliance_passed} onChange={(e) => setQuoteForm((current) => ({ ...current, compliance_passed: e.target.value as Assessment }))}>
              <option value="pending">{t("procurement.rfqDetail.pendingAssessment")}</option>
              <option value="pass">{t("procurement.rfqDetail.compliant")}</option>
              <option value="fail">{t("procurement.rfqDetail.nonCompliant")}</option>
            </select>
            <textarea className="form-input h-24 resize-none" placeholder={t("procurement.rfqDetail.assessmentNotes")} value={quoteForm.compliance_notes} onChange={(e) => setQuoteForm((current) => ({ ...current, compliance_notes: e.target.value }))} />
            <div className="space-y-2">
              <div>
                <label htmlFor="procurement-rfq-detail-submitted-quote-documents" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("procurement.rfqDetail.submittedDocs")}</label>
                <input id="procurement-rfq-detail-submitted-quote-documents"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  className="form-input"
                  onChange={(e) => setQuoteFiles(Array.from(e.target.files ?? []))}
                />
                <p className="mt-1 text-[11px] text-neutral-400">{t("procurement.rfqDetail.submittedDocsHint")}</p>
              </div>
              {quoteFiles.length > 0 && (
                <div className="space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  {quoteFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-neutral-800">{file.name}</p>
                        <p className="text-[11px] text-neutral-400">{formatBytes(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setQuoteFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                      >
                        {t("procurement.remove")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <label htmlFor="procurement-rfq-detail-setquoteform-current-recommend-this-quote-for-aw" className="flex items-center gap-2 text-sm">
              <input id="procurement-rfq-detail-setquoteform-current-recommend-this-quote-for-aw" type="checkbox" checked={quoteForm.is_recommended} onChange={(e) => setQuoteForm((current) => ({ ...current, is_recommended: e.target.checked }))} />
              {t("procurement.rfqDetail.recommend")}
            </label>
            {editingQuote && (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-neutral-700">{t("procurement.rfqDetail.coiTitle")}</p>
                <label htmlFor="procurement-rfq-detail-setcoideclared-e-target-checked-i-confirm-my-coi" className="flex items-start gap-2 text-sm">
                  <input id="procurement-rfq-detail-setcoideclared-e-target-checked-i-confirm-my-coi" type="checkbox" className="mt-0.5" checked={coiDeclared} onChange={(e) => setCoiDeclared(e.target.checked)} />
                  <span>{t("procurement.rfqDetail.coiConfirmAssess")}</span>
                </label>
                <label htmlFor="procurement-rfq-detail-setcoihasconflict-e-target-checked-i-have-a-conf" className="flex items-start gap-2 text-sm">
                  <input id="procurement-rfq-detail-setcoihasconflict-e-target-checked-i-have-a-conf" type="checkbox" className="mt-0.5" checked={coiHasConflict} onChange={(e) => setCoiHasConflict(e.target.checked)} />
                  <span>{t("procurement.rfqDetail.coiHasConflict")}</span>
                </label>
                {coiHasConflict && (
                  <textarea
                    className="form-input h-16 resize-none text-sm"
                    placeholder={t("procurement.rfqDetail.mitigationRecusal")}
                    value={coiNotes}
                    onChange={(e) => setCoiNotes(e.target.value)}
                  />
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={resetQuoteModal}>{t("common.cancel")}</button>
              <button
                className="btn-primary flex-1"
                disabled={
                  saveQuoteMutation.isPending ||
                  !quoteForm.vendor_name.trim() ||
                  !quoteForm.quoted_amount ||
                  Boolean(editingQuote && (!coiDeclared || (coiHasConflict && !coiNotes.trim())))
                }
                onClick={() => saveQuoteMutation.mutate()}
              >
                {saveQuoteMutation.isPending ? t("procurement.rfqDetail.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAward(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold">{t("procurement.rfqDetail.awardContract")}</h2>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <select className="form-input" value={awardQuoteId} onChange={(e) => setAwardQuoteId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">{t("procurement.rfqDetail.selectCompliant")}</option>
              {eligibleQuotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.vendor_name} - {quote.currency ?? currency} {(quote.quoted_amount ?? 0).toLocaleString()}</option>)}
            </select>
            <textarea className="form-input h-24 resize-none" placeholder={t("procurement.rfqDetail.awardNotes")} value={awardNotes} onChange={(e) => setAwardNotes(e.target.value)} />
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
              <label htmlFor="procurement-rfq-detail-setcoideclared-e-target-checked-i-confirm-my-coi-2" className="flex items-start gap-2 text-sm">
                <input id="procurement-rfq-detail-setcoideclared-e-target-checked-i-confirm-my-coi-2" type="checkbox" className="mt-0.5" checked={coiDeclared} onChange={(e) => setCoiDeclared(e.target.checked)} />
                <span>{t("procurement.rfqDetail.coiConfirmAward")}</span>
              </label>
              <label htmlFor="procurement-rfq-detail-setcoihasconflict-e-target-checked-i-have-a-conf-2" className="flex items-start gap-2 text-sm">
                <input id="procurement-rfq-detail-setcoihasconflict-e-target-checked-i-have-a-conf-2" type="checkbox" className="mt-0.5" checked={coiHasConflict} onChange={(e) => setCoiHasConflict(e.target.checked)} />
                <span>{t("procurement.rfqDetail.coiHasConflict")}</span>
              </label>
              {coiHasConflict && (
                <textarea className="form-input h-16 resize-none text-sm" placeholder={t("procurement.rfqDetail.mitigation")} value={coiNotes} onChange={(e) => setCoiNotes(e.target.value)} />
              )}
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setShowAward(false)}>{t("common.cancel")}</button>
              <button
                className="btn-primary flex-1"
                disabled={awardMutation.isPending || !awardQuoteId || !coiDeclared || (coiHasConflict && !coiNotes.trim())}
                onClick={() => awardMutation.mutate()}
              >
                {awardMutation.isPending ? t("procurement.rfqDetail.awarding") : t("procurement.rfqDetail.confirmAward")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
