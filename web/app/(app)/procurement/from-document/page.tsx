"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import {
  procurementIntakeApi,
  procurementWorkbenchApi,
  purchaseOrdersApi,
  type ProcurementIntake,
  type PurchaseOrder,
} from "@/lib/api";

type Step = "upload" | "review" | "project" | "request" | "preview";

function confidenceLabel(score: number | null | undefined) {
  const n = score ?? 0;
  if (n >= 90) return { text: `${n}% ✓`, cls: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (n >= 70) return { text: `${n}% Review`, cls: "text-amber-800 bg-amber-50 border-amber-200" };
  return { text: `${n}% Attention required`, cls: "text-rose-800 bg-rose-50 border-rose-200" };
}

export default function CreateFromDocumentPage() {
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

  const projects = useQuery({
    queryKey: ["procurement", "projects"],
    queryFn: () => procurementWorkbenchApi.projects().then((r) => r.data.data),
  });

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
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setError(e.response?.data?.message ?? "Upload failed.");
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
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const errors = e.response?.data?.errors;
      setError(errors ? Object.values(errors).flat().join(" ") : e.response?.data?.message ?? "Confirm failed.");
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
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setError(e.response?.data?.message ?? "Could not create the procurement request.");
    },
  });

  const linkRequest = useMutation({
    mutationFn: (id: number) => procurementIntakeApi.linkRequest(intake!.id, id),
    onSuccess: async () => {
      const lpo = await procurementIntakeApi.generateLpo(intake!.id);
      setPo(lpo.data.data);
      setStep("preview");
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setError(e.response?.data?.message ?? "Could not link the procurement request.");
    },
  });

  const submitLpo = useMutation({
    mutationFn: () => purchaseOrdersApi.submit(po!.id),
    onSuccess: (res) => {
      setPo(res.data.data);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      setError(e.response?.data?.message ?? "Could not send for approval.");
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
    if (intake?.invoice_first_case === "existing_lpo") return "Existing LPO found — match this invoice instead of creating another LPO.";
    if (intake?.invoice_first_case === "no_po_payment") return "Routed as a configured no-PO payment. An LPO will not be manufactured.";
    if (intake?.invoice_first_case === "retrospective") return "Invoice-first transaction. Official LPO date will be today, not the supplier invoice date.";
    return null;
  }, [intake?.invoice_first_case]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="Create from Invoice / Quote"
        subtitle="Upload a supplier document. Nexus extracts, matches and prepares the LPO. You review exceptions."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Procurement", href: "/procurement" }, { label: "From document" }]} />}
      />

      <ol className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {(["upload", "review", "project", "request", "preview"] as Step[]).map((s) => (
          <li key={s} className={`rounded-full border px-3 py-1 ${step === s ? "border-primary bg-primary/10 text-primary" : "border-neutral-200"}`}>
            {s}
          </li>
        ))}
      </ol>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {error}
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
          <p className="mt-3 text-lg font-semibold text-neutral-800">Drop supplier document here</p>
          <p className="text-sm text-neutral-500">PDF or Word (DOCX) with selectable text is the live extraction path. Image OCR is not configured — scans need manual classification. IMAP is not configured.</p>
          <label className="btn-primary mt-4 inline-flex cursor-pointer items-center gap-1.5">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,.jpg,.jpeg,.png,application/pdf"
              onChange={(e) => onDrop(e.target.files)}
            />
            Browse files
          </label>
          {file && <p className="mt-3 text-sm text-neutral-700">{file.name}</p>}
          <button
            type="button"
            className="btn-primary mt-4"
            disabled={!file || upload.isPending}
            onClick={() => file && upload.mutate(file)}
          >
            {upload.isPending ? "Extracting…" : "Upload Invoice / Quote"}
          </button>
        </div>
      )}

      {step === "review" && intake && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
            <p className="font-semibold text-neutral-800">{intake.original_filename}</p>
            <p className="mt-2 text-neutral-600">Original document remains the evidence. Corrections are stored separately.</p>
            <span className={`mt-3 inline-block rounded border px-2 py-0.5 text-xs ${band.cls}`}>{band.text}</span>
            {intake.needs_manual_classification && (
              <p className="mt-3 text-amber-800">Needs manual classification — confidence is too low to guess silently.</p>
            )}
            {(intake.text_method === "ocr_unconfigured" || intake.ocr_available === false) && (
              <p className="mt-3 text-amber-900">{intake.extraction_message ?? "Image OCR is not configured. Upload a PDF or DOCX, or enter fields manually."}</p>
            )}
          </div>
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-neutral-200 bg-white p-4">
              <h2 className="font-semibold">Supplier</h2>
              <p>{intake.vendor?.name ?? intake.supplier_name_raw ?? "Unmatched"}</p>
              <p className="text-sm text-neutral-500">{intake.supplier_match_status}</p>
              {(intake.supplier_differences ?? []).map((d) => (
                <p key={d.field} className="mt-2 text-sm text-amber-800">
                  {d.field}: Master {d.master} vs document {d.document}
                </p>
              ))}
              {intake.extraction_status === "duplicate_blocked" && (
              <p className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
                Possible duplicate invoice {(intake.duplicate_matches ?? [])[0]?.document_number ?? intake.document_number}. Open the existing record instead of creating another case.
              </p>
            )}
            {intake.bank_mismatch && (
                <p className="mt-2 rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">
                  HIGH-RISK SUPPLIER CHANGE — bank details differ from Supplier Master. Transaction is on HOLD.
                </p>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-left">
                  <tr>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">LPO text</th>
                    <th className="px-3 py-2 text-right">Total</th>
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
              Subtotal {intake.subtotal} · {intake.vat_warning ?? "VAT recorded"} · Total <strong>{intake.currency === "NAD" ? "N$" : intake.currency} {intake.grand_total}</strong>
            </p>
            {intake.arithmetic && !intake.arithmetic.ok && (
              <p className="text-sm text-amber-800">Arithmetic does not reconcile: {intake.arithmetic.issues.join(" ")}</p>
            )}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={() => setStep("upload")}>Reject / start over</button>
              <button
                type="button"
                className="btn-primary"
                disabled={intake.extraction_status === "duplicate_blocked"}
                onClick={() => setStep("project")}
              >
                Confirm & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "project" && intake && (
        <div className="max-w-xl space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
          <label className="block text-sm font-medium">
            Project
            <select
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select project</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </label>
          {intake.document_type === "invoice" && (
            <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-semibold">Invoice-first control</p>
              <p>The official LPO date will be today. The supplier invoice date {intake.document_date} is stored as source evidence only.</p>
              <input className="w-full rounded border px-2 py-1" placeholder="Why did procurement precede the LPO?" value={exception.reason} onChange={(e) => setException({ ...exception, reason: e.target.value })} />
              <input className="w-full rounded border px-2 py-1" placeholder="Requesting officer" value={exception.requesting_officer} onChange={(e) => setException({ ...exception, requesting_officer: e.target.value })} />
              <input className="w-full rounded border px-2 py-1" type="date" value={exception.request_date} onChange={(e) => setException({ ...exception, request_date: e.target.value })} />
              <input className="w-full rounded border px-2 py-1" type="date" value={exception.service_or_goods_date} onChange={(e) => setException({ ...exception, service_or_goods_date: e.target.value })} />
              <textarea className="w-full rounded border px-2 py-1" placeholder="Supplier justification" value={exception.justification} onChange={(e) => setException({ ...exception, justification: e.target.value })} />
            </div>
          )}
          {intake.bank_mismatch && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={acknowledgeBank} onChange={(e) => setAcknowledgeBank(e.target.checked)} />
              I acknowledge the bank-detail hold. Supplier Master will not be overwritten from this invoice.
            </label>
          )}
          <button type="button" className="btn-primary" disabled={!projectId || confirm.isPending || (intake.bank_mismatch && !acknowledgeBank)} onClick={() => confirm.mutate()}>
            {confirm.isPending ? "Checking policy…" : "Apply project & policy"}
          </button>
        </div>
      )}

      {step === "request" && intake && (
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
          {invoiceFirstNote && <p className="rounded border border-sky-200 bg-sky-50 p-3 text-sm">{invoiceFirstNote}</p>}
          {intake.policy_result && (
            <div className="text-sm">
              <p><strong>Route:</strong> {String(intake.policy_result.procurement_method ?? "")}</p>
              <p>Minimum quotations: {String(intake.policy_result.minimum_quotations ?? "")}</p>
            </div>
          )}
          {intake.invoice_first_case === "existing_lpo" ? (
            <Link href={`/procurement/purchase-orders/${intake.purchase_order_id}`} className="btn-primary inline-flex">Open existing LPO</Link>
          ) : (
            <>
              {(matches.data ?? []).length > 0 && (
                <div className="rounded border border-sky-200 bg-sky-50 p-3 text-sm">
                  <p className="font-semibold">Possible procurement request found</p>
                  {(matches.data ?? []).slice(0, 3).map((row) => (
                    <div key={row.id} className="mt-2 flex items-center justify-between gap-2">
                      <span>{row.reference_number} · {row.title} · {row.estimated_value}</span>
                      <button type="button" className="btn-secondary text-xs" disabled={linkRequest.isPending} onClick={() => linkRequest.mutate(row.id)}>Link</button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="btn-primary" disabled={createRequest.isPending} onClick={() => createRequest.mutate()}>
                {createRequest.isPending ? "Preparing LPO…" : "Create Procurement Request from Document"}
              </button>
            </>
          )}
        </div>
      )}

      {step === "preview" && po && (
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="text-lg font-semibold">LPO PREVIEW</h2>
          <p>No. {po.lpo_number ?? po.reference_number} (official number is allocated when you send for approval)</p>
          <p>Project: {po.project?.name ?? "Forum"}</p>
          <p>Supplier: {po.vendor?.name}</p>
          <p>Total: {po.currency === "NAD" ? "N$" : po.currency} {po.total_amount}</p>
          {po.retrospective && <p className="text-amber-800">Retrospective invoice path — not backdated.</p>}
          {submitLpo.isSuccess && <p className="text-emerald-800">Sent for sequential approval. Official number: {po.lpo_number}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={submitLpo.isPending || po.status === "awaiting_approval"}
              onClick={() => submitLpo.mutate()}
            >
              {submitLpo.isPending ? "Sending…" : "Send for Approval"}
            </button>
            <Link href={`/procurement/purchase-orders/${po.id}`} className="btn-secondary">Open LPO</Link>
            <Link href="/procurement" className="btn-secondary">Workbench</Link>
          </div>
        </div>
      )}
    </div>
  );
}
