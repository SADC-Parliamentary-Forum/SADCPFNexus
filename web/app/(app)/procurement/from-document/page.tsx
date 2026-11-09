"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import {
  procurementIntakeApi,
  procurementWorkbenchApi,
  purchaseOrdersApi,
  supplierCategoriesApi,
  type ProcurementIntake,
  type PurchaseOrder,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Step = "upload" | "review" | "supplier" | "project" | "request" | "preview";

const STEPS: Step[] = ["upload", "review", "supplier", "project", "request", "preview"];

function needsNewSupplier(intake: ProcurementIntake | null | undefined) {
  if (!intake) return false;
  return !intake.vendor_id && intake.supplier_match_status === "unmatched";
}

function confidenceLabel(score: number | null | undefined) {
  const n = score ?? 0;
  if (n >= 90) return { key: "procurement.fromDoc.confidence.high", n, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (n >= 70) return { key: "procurement.fromDoc.confidence.review", n, cls: "text-amber-800 bg-amber-50 border-amber-200" };
  return { key: "procurement.fromDoc.confidence.attention", n, cls: "text-rose-800 bg-rose-50 border-rose-200" };
}

export default function CreateFromDocumentPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [intake, setIntake] = useState<ProcurementIntake | null>(null);
  const [projectId, setProjectId] = useState<number | "">("");
  const [exception, setException] = useState({
    reason: "",
    requesting_officer: "",
    request_date: "",
    service_or_goods_date: "",
    already_received: true,
    emergency: false,
    justification: "",
    project: "Forum",
  });
  const [acknowledgeBank, setAcknowledgeBank] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [sendInvitation, setSendInvitation] = useState(true);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    tax_number: "",
    registration_number: "",
    address: "",
    country: "Namibia",
    bank_name: "",
    bank_account: "",
    category_ids: [] as number[],
  });
  const searchParams = useSearchParams();
  const intakeParam = searchParams.get("intake");

  const projects = useQuery({
    queryKey: ["procurement", "projects"],
    queryFn: () => procurementWorkbenchApi.projects().then((r) => r.data.data),
  });

  const categories = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: () => supplierCategoriesApi.list().then((r) => r.data.data),
  });

  const existingIntake = useQuery({
    queryKey: ["procurement", "intake", intakeParam],
    queryFn: () => procurementIntakeApi.get(Number(intakeParam)).then((r) => r.data.data),
    enabled: !!intakeParam && !intake,
  });

  useEffect(() => {
    if (!existingIntake.data || intake) return;
    setIntake(existingIntake.data);
    setStep("review");
  }, [existingIntake.data, intake]);

  useEffect(() => {
    if (!intake || step !== "supplier") return;
    const bank = intake.bank_details_raw ?? {};
    setSupplierForm((current) => ({
      ...current,
      name: intake.vendor?.name ?? intake.supplier_name_raw ?? current.name,
      contact_email: intake.supplier_email_raw ?? current.contact_email,
      contact_phone: intake.supplier_phone_raw ?? current.contact_phone,
      tax_number: intake.supplier_tax_number_raw ?? current.tax_number,
      registration_number: intake.supplier_registration_raw ?? current.registration_number,
      bank_name: bank.bank ?? current.bank_name,
      bank_account: bank.account ?? current.bank_account,
    }));
  }, [intake, step]);

  const matches = useQuery({
    queryKey: ["procurement", "intake-matches", intake?.id],
    queryFn: () => procurementIntakeApi.matches(intake!.id).then((r) => r.data.data),
    enabled: !!intake?.id && step === "request",
  });

  const upload = useMutation({
    mutationFn: (f: File) => procurementIntakeApi.upload(f),
    onSuccess: (res) => {
      setIntake(res.data.data);
      setError(null);
      setStep("review");
      toast.success(t("procurement.doc.uploaded"));
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const message = e.response?.data?.message ?? t("procurement.fromDoc.uploadFailed");
      setError(message);
      toast.error(t("procurement.doc.notUploaded"), message);
    },
  });

  const confirm = useMutation({
    mutationFn: () =>
      procurementIntakeApi.confirm(intake!.id, {
        procurement_project_id: projectId || undefined,
        category: "services",
        use_supplier_master: true,
        acknowledge_bank_hold: acknowledgeBank || undefined,
        exception: intake?.document_type === "invoice" ? { ...exception, project: exception.project || "Forum" } : undefined,
      }),
    onSuccess: (res) => {
      setIntake(res.data.data);
      setStep("request");
      toast.success(t("procurement.fromDoc.confirmed"));
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const errors = e.response?.data?.errors;
      const message = errors ? Object.values(errors).flat().join(" ") : e.response?.data?.message ?? t("procurement.fromDoc.confirmFailed");
      setError(message);
      toast.error(t("procurement.fromDoc.confirmFailedTitle"), message);
    },
  });

  const createRequest = useMutation({
    mutationFn: () =>
      procurementIntakeApi.createRequest(intake!.id, {
        title: intake?.supplier_name_raw ? `Procurement — ${intake.supplier_name_raw}` : "Procurement from document",
        justification: exception.justification || exception.reason,
      }),
    onSuccess: async () => {
      const lpo = await procurementIntakeApi.generateLpo(intake!.id);
      setPo(lpo.data.data);
      setStep("preview");
      toast.success(t("procurement.fromDoc.requestCreated"));
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const message = e.response?.data?.message ?? t("procurement.fromDoc.requestCreateFailed");
      setError(message);
      toast.error(t("procurement.fromDoc.requestNotCreated"), message);
    },
  });

  const linkRequest = useMutation({
    mutationFn: (id: number) => procurementIntakeApi.linkRequest(intake!.id, id),
    onSuccess: async () => {
      const lpo = await procurementIntakeApi.generateLpo(intake!.id);
      setPo(lpo.data.data);
      setStep("preview");
      toast.success(t("procurement.fromDoc.requestLinked"));
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const message = e.response?.data?.message ?? t("procurement.fromDoc.requestLinkFailed");
      setError(message);
      toast.error(t("procurement.fromDoc.requestNotLinked"), message);
    },
  });

  const saveSupplier = useMutation({
    mutationFn: (payload: Record<string, unknown>) => procurementIntakeApi.createSupplier(intake!.id, payload),
    onSuccess: (res) => {
      setIntake(res.data.data);
      setError(null);
      const invitation = res.data.invitation;
      if (invitation?.sent) {
        setInviteNotice(
          t("procurement.fromDoc.invitationSent", { email: invitation.email ?? "", url: invitation.login_url ?? "" })
        );
      } else {
        setInviteNotice(t("procurement.fromDoc.supplierSavedNotice"));
      }
      setStep("project");
      toast.success(t("procurement.fromDoc.supplierSaved"));
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const errors = e.response?.data?.errors;
      const message = errors ? Object.values(errors).flat().join(" ") : e.response?.data?.message ?? t("procurement.fromDoc.supplierSaveFailed");
      setError(message);
      toast.error(t("procurement.fromDoc.supplierNotSaved"), message);
    },
  });

  const submitLpo = useMutation({
    mutationFn: () => purchaseOrdersApi.submit(po!.id),
    onSuccess: (res) => {
      setPo(res.data.data);
      toast.success(t("procurement.fromDoc.lpoSent"));
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      const message = e.response?.data?.message ?? t("procurement.fromDoc.lpoSendFailed");
      setError(message);
      toast.error(t("procurement.fromDoc.lpoNotSent"), message);
    },
  });

  const onDrop = (list: FileList | null) => {
    const next = list?.[0];
    if (!next) return;
    setFile(next);
  };

  const lines = intake?.lines ?? [];
  const band = confidenceLabel(intake?.extraction_confidence);

  const invoiceFirstNote = useMemo(() => {
    if (intake?.invoice_first_case === "existing_lpo") return t("procurement.fromDoc.note.existingLpo");
    if (intake?.invoice_first_case === "no_po_payment") return t("procurement.fromDoc.note.noPo");
    if (intake?.invoice_first_case === "retrospective") return t("procurement.fromDoc.note.retrospective");
    return null;
  }, [intake?.invoice_first_case, t]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("procurement.index.fromDocument")}
        subtitle={t("procurement.fromDoc.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("nav.procurement"), href: "/procurement" }, { label: t("procurement.fromDoc.crumb") }]} />}
      />

      <ol className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {STEPS.map((s) => (
          <li key={s} className={`rounded-full border px-3 py-1 ${step === s ? "border-primary bg-primary/10 text-primary" : "border-neutral-200"}`}>
            {t(`procurement.fromDoc.step.${s}`)}
          </li>
        ))}
      </ol>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {error}
        </div>
      )}
      {inviteNotice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          {inviteNotice}
        </div>
      )}

      {step === "upload" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onDrop(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed p-10 text-center ${drag ? "border-primary bg-primary/5" : "border-neutral-300 bg-white"}`}
        >
          <span className="material-symbols-outlined text-4xl text-primary">upload_file</span>
          <p className="mt-3 text-lg font-semibold text-neutral-800">{t("procurement.fromDoc.dropHere")}</p>
          <p className="text-sm text-neutral-500">{t("procurement.fromDoc.dropHint")}</p>
          {file && <p className="mt-4 text-sm text-neutral-700">{file.name}</p>}
          <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
            <label htmlFor="intake-file" className="btn-secondary cursor-pointer">
              <input
                id="intake-file"
                type="file"
                className="hidden"
                accept=".pdf,.docx,.jpg,.jpeg,.png,application/pdf"
                onChange={(e) => onDrop(e.target.files)}
              />
              {t("procurement.fromDoc.browse")}
            </label>
            <button
              type="button"
              className="btn-primary"
              disabled={!file || upload.isPending}
              onClick={() => file && upload.mutate(file)}
            >
              {upload.isPending ? t("procurement.fromDoc.extracting") : t("procurement.fromDoc.upload")}
            </button>
          </div>
        </div>
      )}

      {step === "review" && intake && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
            <p className="font-semibold text-neutral-800">{intake.original_filename}</p>
            <p className="mt-2 text-neutral-600">{t("procurement.fromDoc.evidence")}</p>
            <span className={`mt-3 inline-block rounded border px-2 py-0.5 text-xs ${band.cls}`}>{t(band.key, { n: band.n })}</span>
            {intake.needs_manual_classification && (
              <p className="mt-3 text-amber-800">{t("procurement.fromDoc.manualClassification")}</p>
            )}
            {intake.document_type === "purchase_order" && (
              <p className="mt-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-sky-900">
                {t("procurement.fromDoc.poFile", {
                  number: intake.document_number ?? t("procurement.fromDoc.numberNotRead"),
                  reuse: intake.document_number ?? t("procurement.fromDoc.numberOnFile"),
                })}
              </p>
            )}
            {(intake.text_method === "ocr_unconfigured" || intake.text_method === "pdf_no_text") && (
              <p className="mt-3 text-amber-900">{intake.extraction_message ?? t("procurement.fromDoc.noText")}</p>
            )}
          </div>
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="font-semibold">{t("procurement.rfqDetail.supplier")}</h2>
              <p>{intake.vendor?.name ?? intake.supplier_name_raw ?? t("procurement.fromDoc.unmatched")}</p>
              <p className="text-sm text-neutral-500">{intake.supplier_match_status}</p>
              {needsNewSupplier(intake) && (
                <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {t("procurement.fromDoc.notOnMaster")}
                </p>
              )}
              {(intake.supplier_differences ?? []).map((d) => (
                <p key={d.field} className="mt-2 text-sm text-amber-800">
                  {t("procurement.fromDoc.difference", { field: d.field, master: d.master ?? "", document: d.document ?? "" })}
                </p>
              ))}
              {intake.extraction_status === "duplicate_blocked" && (
              <p className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
                {t("procurement.fromDoc.duplicate", { number: (intake.duplicate_matches ?? [])[0]?.document_number ?? intake.document_number ?? "" })}
              </p>
            )}
            {intake.bank_mismatch && (
                <p className="mt-2 rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">
                  {t("procurement.fromDoc.bankMismatch")}
                </p>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-left">
                  <tr>
                    <th className="px-3 py-2">{t("procurement.po.qty")}</th>
                    <th className="px-3 py-2">{t("procurement.fromDoc.source")}</th>
                    <th className="px-3 py-2">{t("procurement.fromDoc.lpoText")}</th>
                    <th className="px-3 py-2 text-right">{t("procurement.invoices.kpi.total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-t">
                      <td className="px-3 py-2">{line.quantity}</td>
                      <td className="px-3 py-2">{line.source_description}</td>
                      <td className="px-3 py-2">{line.lpo_description}</td>
                      <td className="px-3 py-2 text-right">{line.line_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm">
              {t("procurement.fromDoc.subtotal", { subtotal: intake.subtotal ?? "", vat: intake.vat_warning ?? t("procurement.fromDoc.vatRecorded") })} <strong>{intake.currency === "NAD" ? "N$" : intake.currency} {intake.grand_total}</strong>
            </p>
            {intake.arithmetic && !intake.arithmetic.ok && (
              <p className="text-sm text-amber-800">{t("procurement.fromDoc.arithmetic", { issues: intake.arithmetic.issues.join(" ") })}</p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-secondary" onClick={() => setStep("upload")}>{t("procurement.fromDoc.startOver")}</button>
              <button
                type="button"
                className="btn-primary"
                disabled={intake.extraction_status === "duplicate_blocked"}
                onClick={() => setStep(needsNewSupplier(intake) ? "supplier" : "project")}
              >
                {needsNewSupplier(intake) ? t("procurement.fromDoc.createSupplierContinue") : t("procurement.fromDoc.confirmContinue")}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "supplier" && intake && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("procurement.fromDoc.newSupplier")}</p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-900">{t("procurement.fromDoc.createSupplierDetails")}</h2>
              <p className="mt-2 text-sm text-neutral-600">
                {t("procurement.fromDoc.prefilledHint")}
              </p>
            </div>
            {(intake.supplier_candidates ?? []).length > 0 && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm">
                <p className="font-semibold text-sky-950">{t("procurement.fromDoc.possibleSuppliers")}</p>
                <p className="mt-1 text-sky-900">{t("procurement.fromDoc.linkInstead")}</p>
                <ul className="mt-3 space-y-2">
                  {(intake.supplier_candidates ?? []).map((row) => (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-200 bg-white px-3 py-2">
                      <span>
                        <strong>{row.name}</strong>
                        <span className="block text-xs text-neutral-500">{t("procurement.fromDoc.candidateMeta", { email: row.contact_email ?? t("procurement.fromDoc.noEmail"), score: row.score ?? "" })}</span>
                      </span>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={saveSupplier.isPending}
                        onClick={() => saveSupplier.mutate({ vendor_id: row.id, send_invitation: false })}
                      >
                        {t("procurement.fromDoc.useSupplier")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <form
            className="lg:col-span-3 space-y-4 rounded-xl border border-neutral-200 bg-white p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (!supplierForm.name.trim()) {
                setError(t("procurement.fromDoc.err.name"));
                return;
              }
              if (supplierForm.category_ids.length < 1) {
                setError(t("procurement.fromDoc.err.category"));
                return;
              }
              if (sendInvitation && !supplierForm.contact_email.trim()) {
                setError(t("procurement.fromDoc.err.email"));
                return;
              }
              saveSupplier.mutate({
                name: supplierForm.name.trim(),
                contact_name: supplierForm.contact_name.trim() || undefined,
                contact_email: supplierForm.contact_email.trim() || undefined,
                contact_phone: supplierForm.contact_phone.trim() || undefined,
                tax_number: supplierForm.tax_number.trim() || undefined,
                registration_number: supplierForm.registration_number.trim() || undefined,
                address: supplierForm.address.trim() || undefined,
                country: supplierForm.country.trim() || undefined,
                bank_name: supplierForm.bank_name.trim() || undefined,
                bank_account: supplierForm.bank_account.trim() || undefined,
                category_ids: supplierForm.category_ids,
                send_invitation: sendInvitation,
              });
            }}
          >
            <div>
              <label htmlFor="intake-supplier-name" className="block text-sm font-medium text-neutral-800">
                {t("procurement.fromDoc.field.name")}
              </label>
              <input
                id="intake-supplier-name"
                className="form-input mt-1"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="intake-supplier-contact" className="block text-sm font-medium text-neutral-800">
                  {t("procurement.fromDoc.field.contact")}
                </label>
                <input
                  id="intake-supplier-contact"
                  className="form-input mt-1"
                  value={supplierForm.contact_name}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, contact_name: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="intake-supplier-phone" className="block text-sm font-medium text-neutral-800">
                  {t("procurement.fromDoc.field.phone")}
                </label>
                <input
                  id="intake-supplier-phone"
                  className="form-input mt-1"
                  value={supplierForm.contact_phone}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, contact_phone: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label htmlFor="intake-supplier-email" className="block text-sm font-medium text-neutral-800">
                {t("procurement.fromDoc.field.email")}
              </label>
              <input
                id="intake-supplier-email"
                type="email"
                className="form-input mt-1"
                value={supplierForm.contact_email}
                onChange={(e) => setSupplierForm((f) => ({ ...f, contact_email: e.target.value }))}
              />
              <p className="mt-1 text-xs text-neutral-500">{t("procurement.fromDoc.field.emailHint")}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="intake-supplier-reg" className="block text-sm font-medium text-neutral-800">
                  {t("procurement.fromDoc.field.registration")}
                </label>
                <input
                  id="intake-supplier-reg"
                  className="form-input mt-1"
                  value={supplierForm.registration_number}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, registration_number: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="intake-supplier-tax" className="block text-sm font-medium text-neutral-800">
                  {t("procurement.fromDoc.field.tax")}
                </label>
                <input
                  id="intake-supplier-tax"
                  className="form-input mt-1"
                  value={supplierForm.tax_number}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, tax_number: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label htmlFor="intake-supplier-address" className="block text-sm font-medium text-neutral-800">
                {t("procurement.fromDoc.field.address")}
              </label>
              <textarea
                id="intake-supplier-address"
                className="form-input mt-1"
                rows={2}
                value={supplierForm.address}
                onChange={(e) => setSupplierForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="intake-supplier-country" className="block text-sm font-medium text-neutral-800">
                {t("procurement.fromDoc.field.country")}
              </label>
              <input
                id="intake-supplier-country"
                className="form-input mt-1"
                value={supplierForm.country}
                onChange={(e) => setSupplierForm((f) => ({ ...f, country: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="intake-supplier-bank" className="block text-sm font-medium text-neutral-800">
                  {t("procurement.fromDoc.field.bankName")}
                </label>
                <input
                  id="intake-supplier-bank"
                  className="form-input mt-1"
                  value={supplierForm.bank_name}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, bank_name: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="intake-supplier-account" className="block text-sm font-medium text-neutral-800">
                  {t("procurement.fromDoc.field.bankAccount")}
                </label>
                <input
                  id="intake-supplier-account"
                  className="form-input mt-1"
                  value={supplierForm.bank_account}
                  onChange={(e) => setSupplierForm((f) => ({ ...f, bank_account: e.target.value }))}
                />
              </div>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-neutral-800">{t("procurement.fromDoc.field.categories")}</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(categories.data ?? []).map((category) => {
                  const id = `intake-supplier-cat-${category.id}`;
                  const checked = supplierForm.category_ids.includes(category.id);
                  return (
                    <div key={category.id} className={`rounded-lg border px-3 py-2 ${checked ? "border-primary bg-primary/5" : "border-neutral-200"}`}>
                      <label htmlFor={id} className="flex items-start gap-2 text-sm">
                        <input
                          id={id}
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          onChange={() =>
                            setSupplierForm((current) => ({
                              ...current,
                              category_ids: checked
                                ? current.category_ids.filter((item) => item !== category.id)
                                : [...current.category_ids, category.id],
                            }))
                          }
                        />
                        {category.name}
                      </label>
                    </div>
                  );
                })}
              </div>
            </fieldset>
            <label htmlFor="intake-supplier-invite" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
              <input
                id="intake-supplier-invite"
                type="checkbox"
                className="mt-1"
                checked={sendInvitation}
                onChange={(e) => setSendInvitation(e.target.checked)}
              />
              <span>
                {t("procurement.fromDoc.inviteLabel")}
                <strong className="block font-semibold">{t("procurement.fromDoc.neverEmailsPassword")}</strong>
              </span>
            </label>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setStep("review")}>{t("common.back")}</button>
              <button type="submit" className="btn-primary" disabled={saveSupplier.isPending}>
                {saveSupplier.isPending ? t("procurement.fromDoc.savingSupplier") : sendInvitation ? t("procurement.fromDoc.createAndInvite") : t("procurement.fromDoc.createWithoutInvite")}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === "project" && intake && (
        <div className="max-w-xl space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
          <div>
            <label htmlFor="intake-project" className="block text-sm font-medium text-neutral-800">
              {t("procurement.fromDoc.project")}
            </label>
            <select
              id="intake-project"
              className="form-input mt-1"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">{t("procurement.fromDoc.selectProject")}</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          {intake.document_type === "invoice" && (
            <div className="space-y-3 rounded border border-amber-200 bg-amber-50 p-4 text-sm">
              <p className="font-semibold">{t("procurement.fromDoc.invoiceFirst")}</p>
              <p>{t("procurement.fromDoc.invoiceFirstHint", { date: intake.document_date ?? "" })}</p>
              <div>
                <label htmlFor="intake-exception-reason" className="block text-sm font-medium text-neutral-800">
                  {t("procurement.fromDoc.exception.reason")}
                </label>
                <input id="intake-exception-reason" className="form-input mt-1" value={exception.reason} onChange={(e) => setException({ ...exception, reason: e.target.value })} />
              </div>
              <div>
                <label htmlFor="intake-exception-officer" className="block text-sm font-medium text-neutral-800">
                  {t("procurement.fromDoc.exception.officer")}
                </label>
                <input id="intake-exception-officer" className="form-input mt-1" value={exception.requesting_officer} onChange={(e) => setException({ ...exception, requesting_officer: e.target.value })} />
              </div>
              <div>
                <label htmlFor="intake-exception-request-date" className="block text-sm font-medium text-neutral-800">
                  {t("procurement.fromDoc.exception.requestDate")}
                </label>
                <input id="intake-exception-request-date" className="form-input mt-1" type="date" value={exception.request_date} onChange={(e) => setException({ ...exception, request_date: e.target.value })} />
              </div>
              <div>
                <label htmlFor="intake-exception-service-date" className="block text-sm font-medium text-neutral-800">
                  {t("procurement.fromDoc.exception.serviceDate")}
                </label>
                <input id="intake-exception-service-date" className="form-input mt-1" type="date" value={exception.service_or_goods_date} onChange={(e) => setException({ ...exception, service_or_goods_date: e.target.value })} />
              </div>
              <div>
                <label htmlFor="intake-exception-justification" className="block text-sm font-medium text-neutral-800">
                  {t("procurement.fromDoc.exception.justification")}
                </label>
                <textarea id="intake-exception-justification" className="form-input mt-1" rows={3} value={exception.justification} onChange={(e) => setException({ ...exception, justification: e.target.value })} />
              </div>
            </div>
          )}
          {intake.bank_mismatch && (
            <label htmlFor="intake-ack-bank" className="flex items-start gap-2 text-sm">
              <input id="intake-ack-bank" type="checkbox" className="mt-1" checked={acknowledgeBank} onChange={(e) => setAcknowledgeBank(e.target.checked)} />
              {t("procurement.fromDoc.ackBank")}
            </label>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setStep("review")}>{t("common.back")}</button>
            <button type="button" className="btn-primary" disabled={!projectId || confirm.isPending || (intake.bank_mismatch && !acknowledgeBank)} onClick={() => confirm.mutate()}>
              {confirm.isPending ? t("procurement.fromDoc.checkingPolicy") : t("procurement.fromDoc.applyPolicy")}
            </button>
          </div>
        </div>
      )}

      {step === "request" && intake && (
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
          {invoiceFirstNote && <p className="rounded border border-sky-200 bg-sky-50 p-3 text-sm">{invoiceFirstNote}</p>}
          {intake.policy_result && (
            <div className="text-sm">
              <p><strong>{t("procurement.fromDoc.route")}</strong> {String(intake.policy_result.procurement_method ?? "")}</p>
              <p>{t("procurement.fromDoc.minQuotations", { count: String(intake.policy_result.minimum_quotations ?? "") })}</p>
            </div>
          )}
          {intake.invoice_first_case === "existing_lpo" ? (
            <Link href={`/procurement/purchase-orders/${intake.purchase_order_id}`} className="btn-primary inline-flex">{t("procurement.fromDoc.openExistingLpo")}</Link>
          ) : (
            <>
              {(matches.data ?? []).length > 0 && (
                <div className="rounded border border-sky-200 bg-sky-50 p-3 text-sm">
                  <p className="font-semibold">{t("procurement.fromDoc.possibleRequest")}</p>
                  {(matches.data ?? []).slice(0, 3).map((row) => (
                    <div key={row.id} className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <span>{row.reference_number} · {row.title} · {row.estimated_value}</span>
                      <button type="button" className="btn-secondary text-xs" disabled={linkRequest.isPending} onClick={() => linkRequest.mutate(row.id)}>{t("procurement.fromDoc.link")}</button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="btn-primary" disabled={createRequest.isPending} onClick={() => createRequest.mutate()}>
                {createRequest.isPending ? t("procurement.fromDoc.preparingLpo") : t("procurement.fromDoc.createRequest")}
              </button>
            </>
          )}
        </div>
      )}

      {step === "preview" && po && (
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">{t("procurement.fromDoc.lpoPreview")}</h2>
          <p>{t("procurement.fromDoc.previewNumber", { number: po.lpo_number ?? po.reference_number ?? "" })}</p>
          <p>{t("procurement.fromDoc.previewProject", { name: po.project?.name ?? "Forum" })}</p>
          <p>{t("procurement.fromDoc.previewSupplier", { name: po.vendor?.name ?? "" })}</p>
          <p>{t("procurement.po.total", { amount: `${po.currency === "NAD" ? "N$" : po.currency} ${po.total_amount}` })}</p>
          {po.retrospective && <p className="text-amber-800">{t("procurement.fromDoc.retrospective")}</p>}
          {submitLpo.isSuccess && <p className="text-emerald-800">{t("procurement.fromDoc.sentForApproval", { number: po.lpo_number ?? "" })}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={submitLpo.isPending || po.status === "awaiting_approval"}
              onClick={() => submitLpo.mutate()}
            >
              {submitLpo.isPending ? t("procurement.fromDoc.sending") : t("procurement.fromDoc.sendForApproval")}
            </button>
            <Link href={`/procurement/purchase-orders/${po.id}`} className="btn-secondary">{t("procurement.fromDoc.openLpo")}</Link>
            <Link href="/procurement" className="btn-secondary">{t("procurement.fromDoc.workbench")}</Link>
          </div>
        </div>
      )}
    </div>
  );
}
