"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import {
  contractsApi, vendorsApi, procurementApi,
  type ContractType, type Vendor,
} from "@/lib/api";

type Origin = "procurement" | "pif" | "framework" | "standalone" | "legacy";
type Party = "individual" | "organisation";

interface Deliverable { name: string; due_date?: string; responsible_party?: string }
interface Obligation { obligation: string; responsible_party: string }

const ORIGINS: { id: Origin; icon: string }[] = [
  { id: "procurement", icon: "shopping_cart" },
  { id: "pif", icon: "assignment" },
  { id: "framework", icon: "account_tree" },
  { id: "standalone", icon: "edit_note" },
  { id: "legacy", icon: "history" },
];

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

function ContractCreateInner() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const steps = [
    { label: t("contracts.create.step.origin") },
    { label: t("contracts.create.step.counterparty") },
    { label: t("contracts.create.step.details") },
    { label: t("contracts.create.step.financials") },
    { label: t("contracts.create.step.scope") },
    { label: t("contracts.create.step.review") },
  ];

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [origin, setOrigin] = useState<Origin>("standalone");
  const [originReference, setOriginReference] = useState("");
  const [procurementRequestId, setProcurementRequestId] = useState<number | "">("");
  const [awardReference, setAwardReference] = useState("");

  const [partyType, setPartyType] = useState<Party>("individual");
  const [vendorId, setVendorId] = useState<number | "">("");
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profession, setProfession] = useState("");

  const [typeId, setTypeId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [signatureDeadline, setSignatureDeadline] = useState("");

  const [rate, setRate] = useState("");
  const [units, setUnits] = useState("");
  const [flatValue, setFlatValue] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [budgetCurrency, setBudgetCurrency] = useState("");
  const [conversionReference, setConversionReference] = useState("");
  const [convertedValue, setConvertedValue] = useState("");
  const [ceiling, setCeiling] = useState("");
  const [isFramework, setIsFramework] = useState(false);
  const [frameworkCeiling, setFrameworkCeiling] = useState("");

  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);

  const [templateVersionId, setTemplateVersionId] = useState<number | "">("");

  const computedValue = useMemo(() => {
    if (rate && units) return Number(rate) * Number(units);
    if (flatValue) return Number(flatValue);
    return 0;
  }, [rate, units, flatValue]);

  const { data: typeData } = useQuery({
    queryKey: ["contract-types"],
    queryFn: () => contractsApi.types().then((r) => r.data.data),
  });
  const types: ContractType[] = typeData ?? [];

  const { data: currencyData } = useQuery({
    queryKey: ["contract-currencies"],
    queryFn: () => contractsApi.currencies().then((r) => r.data.data).catch(() => []),
  });
  const currencies = currencyData ?? [];

  const { data: vendorData } = useQuery({
    queryKey: ["vendors-approved"],
    queryFn: () => vendorsApi.list({ status: "approved", per_page: 100 }).then((r) => r.data),
    enabled: partyType === "organisation",
  });
  const vendors: Vendor[] = (vendorData as { data?: Vendor[] })?.data ?? [];

  const { data: awardedData } = useQuery({
    queryKey: ["procurement-awarded"],
    queryFn: () => procurementApi.list({ status: "awarded", per_page: 100 }).then((r) => r.data),
    enabled: origin === "procurement",
  });
  type AwardOpt = { id: number; reference_number: string; title: string };
  const awarded: AwardOpt[] = ((awardedData as { data?: AwardOpt[] })?.data ?? []);

  const { data: templateData } = useQuery({
    queryKey: ["contract-templates"],
    queryFn: () => contractsApi.listTemplates().then((r) => r.data.data).catch(() => []),
  });
  const templates = templateData ?? [];

  // Selectable active template versions.
  const templateOptions = useMemo(
    () => templates.flatMap((t) => (t.versions ?? []).filter((v) => v.status === "ACTIVE").map((v) => ({
      id: v.id, label: `${t.name} · ${v.version}`,
    }))),
    [templates],
  );

  useEffect(() => {
    const request = searchParams.get("request");
    if (!request) return;
    setOrigin("procurement");
    setProcurementRequestId(Number(request));
  }, [searchParams]);

  const prefillFromAward = async () => {
    if (!procurementRequestId) return;
    try {
      const { data } = await contractsApi.prefill("procurement", Number(procurementRequestId));
      const d = data.data as Record<string, unknown>;
      if (d.title) setTitle(String(d.title));
      if (d.award_reference) setAwardReference(String(d.award_reference));
      if (d.value) setFlatValue(String(d.value));
      if (d.currency) setCurrency(String(d.currency));
      if (d.vendor_id) { setPartyType("organisation"); setVendorId(Number(d.vendor_id)); }
      toast.success(t("contracts.origin.prefilled"));
    } catch {
      toast.error(t("contracts.origin.prefillFailed"));
    }
  };

  const canNext = (): boolean => {
    switch (step) {
      case 1:
        if (origin === "legacy") return false;
        if (origin === "standalone") return originReference.trim().length > 0;
        if (origin === "procurement") return !!procurementRequestId;
        return true;
      case 2: return partyType === "organisation" ? !!vendorId : (!!firstName.trim() && !!surname.trim());
      case 3: return !!title.trim() && !!typeId && !!startDate && !!endDate;
      case 4: return computedValue > 0;
      default: return true;
    }
  };

  const addDeliverable = () => setDeliverables((d) => [...d, { name: "" }]);
  const addObligation = () => setObligations((o) => [...o, { obligation: "", responsible_party: "counterparty" }]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        origin_type: origin,
        origin_reference: origin === "standalone" ? originReference : undefined,
        procurement_request_id: origin === "procurement" && procurementRequestId ? Number(procurementRequestId) : undefined,
        award_reference: awardReference || undefined,
        type_id: typeId ? Number(typeId) : undefined,
        counterparty_type: partyType,
        vendor_id: partyType === "organisation" && vendorId ? Number(vendorId) : undefined,
        counterparty: partyType === "individual" ? {
          first_name: firstName, surname, email: email || undefined, phone: phone || undefined, profession: profession || undefined,
        } : undefined,
        title: title.trim(),
        description: description || undefined,
        start_date: startDate,
        end_date: endDate,
        signature_deadline: signatureDeadline || undefined,
        rate: rate ? Number(rate) : undefined,
        units: units ? Number(units) : undefined,
        value: !rate || !units ? Number(flatValue || 0) : undefined,
        ceiling_value: ceiling ? Number(ceiling) : undefined,
        is_framework: isFramework || undefined,
        framework_ceiling: isFramework && frameworkCeiling ? Number(frameworkCeiling) : undefined,
        currency,
        budget_currency: budgetCurrency || undefined,
        conversion_reference: conversionReference || undefined,
        converted_value: convertedValue ? Number(convertedValue) : undefined,
        deliverables: deliverables.filter((d) => d.name.trim()).length ? deliverables.filter((d) => d.name.trim()) : undefined,
        obligations: obligations.filter((o) => o.obligation.trim()).length ? obligations.filter((o) => o.obligation.trim()) : undefined,
      };

      const res = await contractsApi.create(payload as never);
      const id = res.data.data.id;

      if (templateVersionId) {
        try { await contractsApi.generate(id, Number(templateVersionId)); }
        catch { toast.error(t("contracts.create.generateWarn")); }
      }

      toast.success(t("contracts.create.created"));
      router.push(`/contracts/${id}`);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.create.failed"));
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6 max-w-3xl">
      <ModulePageHeader
        title="contracts.createTitle"
        subtitle="contracts.createSubtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "contracts.title", href: "/contracts" }, { label: "contracts.new" }]} />}
      />

      <div className="card p-5 overflow-x-auto">
        <Stepper steps={steps} currentStep={step} onStepSelect={(i) => setStep(i + 1)} />
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="card p-6 space-y-5">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.create.originTitle")}</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ORIGINS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOrigin(o.id)}
                  className={`card p-4 text-left transition-shadow ${origin === o.id ? "ring-2 ring-primary border-primary" : "hover:border-primary/40"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary mt-0.5" aria-hidden="true">{o.icon}</span>
                    <span>
                      <span className="block text-sm font-semibold text-neutral-900">{t(`contracts.origin.${o.id}`)}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">{t(`contracts.origin.${o.id}Hint`)}</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {origin === "procurement" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600">{t("contracts.origin.selectAward")}</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select className="form-input w-full" value={procurementRequestId} onChange={(e) => setProcurementRequestId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">{t("contracts.origin.selectAwardPlaceholder")}</option>
                    {awarded.map((a) => (<option key={a.id} value={a.id}>{a.reference_number} — {a.title}</option>))}
                  </select>
                  <button type="button" className="btn-secondary whitespace-nowrap" disabled={!procurementRequestId} onClick={prefillFromAward}>{t("contracts.origin.prefill")}</button>
                </div>
              </div>
            )}
            {origin === "standalone" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">{t("contracts.origin.standaloneReason")} <span className="text-red-500">*</span></label>
                <textarea className="form-input h-20 resize-none w-full" value={originReference} onChange={(e) => setOriginReference(e.target.value)} />
              </div>
            )}
            {origin === "legacy" && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {t("contracts.origin.legacyCta")}{" "}
                <Link href="/contracts/register" className="underline">{t("contracts.importLegacy")}</Link>
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-800">Counterparty</h2>
            <div className="flex gap-2 flex-wrap">
              {(["individual", "organisation"] as Party[]).map((p) => (
                <button key={p} type="button" onClick={() => setPartyType(p)} className={`filter-tab ${partyType === p ? "active" : ""}`}>{t(`contracts.party.${p}`)}</button>
              ))}
            </div>
            {partyType === "organisation" ? (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Supplier <span className="text-red-500">*</span></label>
                <select className="form-input" value={vendorId} onChange={(e) => setVendorId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Select supplier…</option>
                  {vendors.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
                </select>
                <p className="text-xs text-neutral-400">Bank details are managed via the supplier record and require a separate verification workflow.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">First name <span className="text-red-500">*</span></label><input className="form-input w-full" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Surname <span className="text-red-500">*</span></label><input className="form-input w-full" value={surname} onChange={(e) => setSurname(e.target.value)} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Email</label><input className="form-input w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Phone</label><input className="form-input w-full" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="space-y-1 sm:col-span-2"><label className="text-xs font-semibold text-neutral-600">Profession</label><input className="form-input w-full" value={profession} onChange={(e) => setProfession(e.target.value)} /></div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-800">Details & dates</h2>
            <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Title <span className="text-red-500">*</span></label><input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Contract type <span className="text-red-500">*</span></label>
              <select className="form-input" value={typeId} onChange={(e) => setTypeId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select type…</option>
                {types.map((row) => (<option key={row.id} value={row.id}>{row.name}</option>))}
              </select>
            </div>
            <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Short description</label><textarea className="form-input h-20 resize-none" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Start date <span className="text-red-500">*</span></label><input type="date" className="form-input w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">End date <span className="text-red-500">*</span></label><input type="date" className="form-input w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Signature deadline</label><input type="date" className="form-input w-full" value={signatureDeadline} onChange={(e) => setSignatureDeadline(e.target.value)} /></div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-800">Financial structure</h2>
            <p className="text-xs text-neutral-500">Enter a rate and units and Nexus calculates the total, or enter a flat value.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Rate</label><input type="number" min="0" step="0.01" className="form-input w-full" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
              <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Units</label><input type="number" min="0" step="0.5" className="form-input w-full" value={units} onChange={(e) => setUnits(e.target.value)} /></div>
              <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">or Flat value</label><input type="number" min="0" step="0.01" className="form-input w-full" value={flatValue} disabled={!!(rate && units)} onChange={(e) => setFlatValue(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Currency</label>
                {currencies.length > 0 ? (
                  <select className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {currencies.map((c) => <option key={c.id} value={c.code}>{c.code} — {c.name}</option>)}
                  </select>
                ) : (
                  <input className="form-input" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                )}
              </div>
              <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Budget currency</label><input className="form-input" value={budgetCurrency} maxLength={3} onChange={(e) => setBudgetCurrency(e.target.value.toUpperCase())} placeholder="Optional" /></div>
              <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Conversion reference</label><input className="form-input" value={conversionReference} onChange={(e) => setConversionReference(e.target.value)} placeholder="e.g. rate/source used" /></div>
              <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Converted commitment</label><input className="form-input" type="number" value={convertedValue} onChange={(e) => setConvertedValue(e.target.value)} placeholder="In budget currency" /></div>
              <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Ceiling</label><input type="number" min="0" step="0.01" className="form-input" value={ceiling} onChange={(e) => setCeiling(e.target.value)} placeholder="Optional" /></div>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm">
              <span className="text-neutral-600">Calculated total value: </span>
              <span className="font-bold text-neutral-900">{currency} {computedValue.toLocaleString()}</span>
            </div>
            <div className="space-y-2 border-t border-neutral-100 pt-3">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={isFramework} onChange={(e) => setIsFramework(e.target.checked)} />
                This is a framework agreement (call-offs will draw down against a ceiling)
              </label>
              {isFramework && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-neutral-600">Framework ceiling</label>
                  <input type="number" min="0" step="0.01" className="form-input" value={frameworkCeiling} onChange={(e) => setFrameworkCeiling(e.target.value)} placeholder="Maximum draw-down value" />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-800">Deliverables</h2>
                <button type="button" className="btn-secondary text-xs" onClick={addDeliverable}>Add deliverable</button>
              </div>
              {deliverables.length === 0 && <p className="text-xs text-neutral-400">No deliverables yet.</p>}
              {deliverables.map((d, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input className="form-input w-full sm:col-span-2" placeholder="Deliverable name" value={d.name} onChange={(e) => setDeliverables((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input type="date" className="form-input w-full" value={d.due_date ?? ""} onChange={(e) => setDeliverables((arr) => arr.map((x, j) => j === i ? { ...x, due_date: e.target.value } : x))} />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-800">Obligations</h2>
                <button type="button" className="btn-secondary text-xs" onClick={addObligation}>Add obligation</button>
              </div>
              {obligations.length === 0 && <p className="text-xs text-neutral-400">No obligations yet.</p>}
              {obligations.map((o, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input className="form-input w-full sm:col-span-2" placeholder="Obligation" value={o.obligation} onChange={(e) => setObligations((arr) => arr.map((x, j) => j === i ? { ...x, obligation: e.target.value } : x))} />
                  <select className="form-input w-full" value={o.responsible_party} onChange={(e) => setObligations((arr) => arr.map((x, j) => j === i ? { ...x, responsible_party: e.target.value } : x))}>
                    <option value="counterparty">Counterparty</option>
                    <option value="sadcpf">SADC PF</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-800">Template & review</h2>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Generate from template (optional)</label>
              <select className="form-input" value={templateVersionId} onChange={(e) => setTemplateVersionId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Do not generate yet</option>
                {templateOptions.map((opt) => (<option key={opt.id} value={opt.id}>{opt.label}</option>))}
              </select>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <dt className="text-neutral-500">Title</dt><dd className="text-neutral-900 font-medium">{title || "—"}</dd>
              <dt className="text-neutral-500">Origin</dt><dd className="text-neutral-900 capitalize">{origin}</dd>
              <dt className="text-neutral-500">Counterparty</dt><dd className="text-neutral-900">{partyType === "organisation" ? (vendors.find((v) => v.id === vendorId)?.name ?? "—") : `${firstName} ${surname}`.trim() || "—"}</dd>
              <dt className="text-neutral-500">Value</dt><dd className="text-neutral-900 font-semibold">{currency} {computedValue.toLocaleString()}</dd>
              <dt className="text-neutral-500">Dates</dt><dd className="text-neutral-900">{startDate || "—"} → {endDate || "—"}</dd>
              <dt className="text-neutral-500">Deliverables</dt><dd className="text-neutral-900">{deliverables.filter((d) => d.name.trim()).length}</dd>
            </dl>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" className="btn-secondary" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>{t("common.back")}</button>
        {step < steps.length ? (
          <button type="button" className="btn-primary disabled:opacity-60" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>{t("contracts.create.continue")}</button>
        ) : (
          <button type="button" className="btn-primary disabled:opacity-60" disabled={submitting} onClick={submit}>
            {submitting ? t("contracts.create.creating") : t("contracts.createTitle")}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ContractCreatePage() {
  return (
    <Suspense fallback={null}>
      <ContractCreateInner />
    </Suspense>
  );
}
