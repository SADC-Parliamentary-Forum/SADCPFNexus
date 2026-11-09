"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { VendorPicker } from "@/components/ui/VendorPicker";
import {
  contractsApi, vendorsApi, procurementApi,
  type ContractType, type Vendor,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Origin = "procurement" | "pif" | "framework" | "standalone" | "legacy";
type Party = "individual" | "organisation";

interface Deliverable { name: string; due_date?: string; responsible_party?: string }
interface Obligation { obligation: string; responsible_party: string }

const STEPS = [
  { label: "contracts.create.step.origin" },
  { label: "contracts.field.counterparty" },
  { label: "contracts.create.step.details" },
  { label: "contracts.create.step.financials" },
  { label: "contracts.create.step.scope" },
  { label: "contracts.create.step.review" },
];

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

export default function ContractCreatePage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();

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

  // One key per form session: a create retried after a lost response returns
  // the first contract instead of creating a duplicate.
  const createKeyRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

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
    () => templates.flatMap((tpl) => (tpl.versions ?? []).filter((v) => v.status === "ACTIVE").map((v) => ({
      id: v.id, label: `${tpl.name} · ${v.version}`,
    }))),
    [templates],
  );

  useEffect(() => {
    if (partyType === "organisation") setTypeDefaultsForOrg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyType]);
  function setTypeDefaultsForOrg() { /* placeholder for future org-specific defaults */ }

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
      toast.success(t("contracts.create.prefilled"));
    } catch {
      toast.error(t("contracts.create.prefillFailed"));
    }
  };

  const canNext = (): boolean => {
    switch (step) {
      case 1: return origin !== "standalone" || originReference.trim().length > 0;
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

      const res = await contractsApi.create(payload as never, `${createKeyRef.current}:create`);
      const id = res.data.data.id;

      if (templateVersionId) {
        try { await contractsApi.generate(id, Number(templateVersionId)); }
        catch { toast.error(t("contracts.create.generationAttention")); }
      }

      toast.success(t("contracts.create.created"));
      router.push(`/contracts/${id}`);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.register.createFailed"));
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <ModulePageHeader
        title="contracts.newContract"
        subtitle="contracts.create.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.contracts", href: "/contracts" }, { label: "contracts.create.crumb" }]} />}
      />

      <div className="card p-5">
        <Stepper steps={STEPS.map((s) => ({ ...s, label: t(s.label) }))} currentStep={step} onStepSelect={(i) => setStep(i + 1)} />
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      <div className="card p-6 space-y-5">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.create.originTitle")}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(["procurement", "pif", "framework", "standalone", "legacy"] as Origin[]).map((o) => (
                <button key={o} type="button" onClick={() => setOrigin(o)}
                  className={`filter-tab capitalize ${origin === o ? "active" : ""}`}>{t(`contracts.create.origin.${o}`)}</button>
              ))}
            </div>
            {origin === "procurement" && (
              <div className="space-y-2">
                <label htmlFor="contracts-create-procurement-request" className="text-xs font-semibold text-neutral-600">{t("contracts.create.awardedRequest")}</label>
                <div className="flex gap-2">
                  <select id="contracts-create-procurement-request" className="form-input" value={procurementRequestId} onChange={(e) => setProcurementRequestId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">{t("contracts.create.selectAward")}</option>
                    {awarded.map((a) => (<option key={a.id} value={a.id}>{a.reference_number} — {a.title}</option>))}
                  </select>
                  <button type="button" className="btn-secondary whitespace-nowrap" disabled={!procurementRequestId} onClick={prefillFromAward}>{t("contracts.create.prefill")}</button>
                </div>
              </div>
            )}
            {origin === "standalone" && (
              <div className="space-y-1">
                <label htmlFor="contracts-create-origin-reason" className="text-xs font-semibold text-neutral-600">{t("contracts.create.standaloneReason")} <span className="text-red-500">*</span></label>
                <textarea id="contracts-create-origin-reason" className="form-input h-20 resize-none" value={originReference} onChange={(e) => setOriginReference(e.target.value)} placeholder={t("contracts.create.standalonePlaceholder")} />
              </div>
            )}
            {origin === "legacy" && (
              <p className="text-sm text-amber-600">{t("contracts.create.legacyBefore")} <Link href="/contracts/register" className="font-semibold hover:opacity-80">{t("contracts.create.legacyLink")}</Link> {t("contracts.create.legacyAfter")}</p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.field.counterparty")}</h2>
            <div className="flex gap-2">
              {(["individual", "organisation"] as Party[]).map((p) => (
                <button key={p} type="button" onClick={() => setPartyType(p)} className={`filter-tab capitalize ${partyType === p ? "active" : ""}`}>{t(`contracts.create.party.${p}`)}</button>
              ))}
            </div>
            {partyType === "organisation" ? (
              <div className="space-y-1">
                <VendorPicker
                  id="contracts-create-supplier"
                  label={t("contracts.create.supplier")}
                  required
                  value={vendors.find((v) => v.id === vendorId) ?? null}
                  onSelect={(v) => setVendorId(v ? v.id : "")}
                />
                <p className="text-xs text-neutral-400">{t("contracts.create.bankHint")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label htmlFor="contracts-create-first-name" className="text-xs font-semibold text-neutral-600">{t("contracts.create.firstName")} <span className="text-red-500">*</span></label><input id="contracts-create-first-name" className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
                <div className="space-y-1"><label htmlFor="contracts-create-surname" className="text-xs font-semibold text-neutral-600">{t("contracts.create.surname")} <span className="text-red-500">*</span></label><input id="contracts-create-surname" className="form-input" value={surname} onChange={(e) => setSurname(e.target.value)} /></div>
                <div className="space-y-1"><label htmlFor="contracts-create-email" className="text-xs font-semibold text-neutral-600">{t("contracts.create.email")}</label><input id="contracts-create-email" className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-1"><label htmlFor="contracts-create-phone" className="text-xs font-semibold text-neutral-600">{t("contracts.create.phone")}</label><input id="contracts-create-phone" className="form-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="space-y-1 col-span-2"><label htmlFor="contracts-create-profession" className="text-xs font-semibold text-neutral-600">{t("contracts.create.profession")}</label><input id="contracts-create-profession" className="form-input" value={profession} onChange={(e) => setProfession(e.target.value)} /></div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.create.detailsTitle")}</h2>
            <div className="space-y-1"><label htmlFor="contracts-create-title" className="text-xs font-semibold text-neutral-600">{t("contracts.field.title")} <span className="text-red-500">*</span></label><input id="contracts-create-title" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1">
              <label htmlFor="contracts-create-type" className="text-xs font-semibold text-neutral-600">{t("contracts.field.contractType")} <span className="text-red-500">*</span></label>
              <select id="contracts-create-type" className="form-input" value={typeId} onChange={(e) => setTypeId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">{t("contracts.create.selectType")}</option>
                {types.map((ty) => (<option key={ty.id} value={ty.id}>{ty.name}</option>))}
              </select>
            </div>
            <div className="space-y-1"><label htmlFor="contracts-create-description" className="text-xs font-semibold text-neutral-600">{t("contracts.create.shortDescription")}</label><textarea id="contracts-create-description" className="form-input h-20 resize-none" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1"><label htmlFor="contracts-create-start-date" className="text-xs font-semibold text-neutral-600">{t("common.startDate")} <span className="text-red-500">*</span></label><input id="contracts-create-start-date" type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div className="space-y-1"><label htmlFor="contracts-create-end-date" className="text-xs font-semibold text-neutral-600">{t("common.endDate")} <span className="text-red-500">*</span></label><input id="contracts-create-end-date" type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
              <div className="space-y-1"><label htmlFor="contracts-create-signature-deadline" className="text-xs font-semibold text-neutral-600">{t("contracts.create.signatureDeadline")}</label><input id="contracts-create-signature-deadline" type="date" className="form-input" value={signatureDeadline} onChange={(e) => setSignatureDeadline(e.target.value)} /></div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.create.financialTitle")}</h2>
            <p className="text-xs text-neutral-500">{t("contracts.create.financialHint")}</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1"><label htmlFor="contracts-create-rate" className="text-xs font-semibold text-neutral-600">{t("contracts.create.rate")}</label><input id="contracts-create-rate" type="number" min="0" step="0.01" className="form-input" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
              <div className="space-y-1"><label htmlFor="contracts-create-units" className="text-xs font-semibold text-neutral-600">{t("contracts.create.units")}</label><input id="contracts-create-units" type="number" min="0" step="0.5" className="form-input" value={units} onChange={(e) => setUnits(e.target.value)} /></div>
              <div className="space-y-1"><label htmlFor="contracts-create-flat-value" className="text-xs font-semibold text-neutral-600">{t("contracts.create.flatValue")}</label><input id="contracts-create-flat-value" type="number" min="0" step="0.01" className="form-input" value={flatValue} disabled={!!(rate && units)} onChange={(e) => setFlatValue(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1"><label htmlFor="contracts-create-currency" className="text-xs font-semibold text-neutral-600">{t("contracts.field.currency")}</label>
                {currencies.length > 0 ? (
                  <select id="contracts-create-currency" className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {currencies.map((c) => <option key={c.id} value={c.code}>{c.code} — {c.name}</option>)}
                  </select>
                ) : (
                  <input id="contracts-create-currency" className="form-input" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
                )}
              </div>
              <div className="space-y-1"><label htmlFor="contracts-create-budget-currency" className="text-xs font-semibold text-neutral-600">{t("contracts.create.budgetCurrency")}</label><input id="contracts-create-budget-currency" className="form-input" value={budgetCurrency} maxLength={3} onChange={(e) => setBudgetCurrency(e.target.value.toUpperCase())} placeholder={t("contracts.create.optional")} /></div>
              <div className="space-y-1"><label htmlFor="contracts-create-conversion-reference" className="text-xs font-semibold text-neutral-600">{t("contracts.create.conversionReference")}</label><input id="contracts-create-conversion-reference" className="form-input" value={conversionReference} onChange={(e) => setConversionReference(e.target.value)} placeholder={t("contracts.create.conversionPlaceholder")} /></div>
              <div className="space-y-1"><label htmlFor="contracts-create-converted-value" className="text-xs font-semibold text-neutral-600">{t("contracts.create.convertedCommitment")}</label><input id="contracts-create-converted-value" className="form-input" type="number" value={convertedValue} onChange={(e) => setConvertedValue(e.target.value)} placeholder={t("contracts.create.inBudgetCurrency")} /></div>
              <div className="space-y-1"><label htmlFor="contracts-create-ceiling" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.ceiling")}</label><input id="contracts-create-ceiling" type="number" min="0" step="0.01" className="form-input" value={ceiling} onChange={(e) => setCeiling(e.target.value)} placeholder={t("contracts.create.optional")} /></div>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm">
              <span className="text-neutral-600">{t("contracts.create.calculatedTotal")} </span>
              <span className="font-bold text-neutral-900">{currency} {computedValue.toLocaleString()}</span>
            </div>
            <div className="space-y-2 border-t border-neutral-100 pt-3">
              <label htmlFor="contracts-create-is-framework" className="flex items-center gap-2 text-sm text-neutral-700">
                <input id="contracts-create-is-framework" type="checkbox" checked={isFramework} onChange={(e) => setIsFramework(e.target.checked)} />
                {t("contracts.create.frameworkCheckbox")}
              </label>
              {isFramework && (
                <div className="space-y-1">
                  <label htmlFor="contracts-create-framework-ceiling" className="text-xs font-semibold text-neutral-600">{t("contracts.create.frameworkCeiling")}</label>
                  <input id="contracts-create-framework-ceiling" type="number" min="0" step="0.01" className="form-input" value={frameworkCeiling} onChange={(e) => setFrameworkCeiling(e.target.value)} placeholder={t("contracts.create.maxDrawdown")} />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.create.deliverables")}</h2>
                <button type="button" className="btn-secondary text-xs" onClick={addDeliverable}>{t("contracts.create.addDeliverable")}</button>
              </div>
              {deliverables.length === 0 && <p className="text-xs text-neutral-400">{t("contracts.create.noDeliverables")}</p>}
              {deliverables.map((d, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <input className="form-input col-span-2" placeholder={t("contracts.create.deliverableName")} value={d.name} onChange={(e) => setDeliverables((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input type="date" className="form-input" value={d.due_date ?? ""} onChange={(e) => setDeliverables((arr) => arr.map((x, j) => j === i ? { ...x, due_date: e.target.value } : x))} />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.create.obligations")}</h2>
                <button type="button" className="btn-secondary text-xs" onClick={addObligation}>{t("contracts.create.addObligation")}</button>
              </div>
              {obligations.length === 0 && <p className="text-xs text-neutral-400">{t("contracts.create.noObligations")}</p>}
              {obligations.map((o, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <input className="form-input col-span-2" placeholder={t("contracts.create.obligation")} value={o.obligation} onChange={(e) => setObligations((arr) => arr.map((x, j) => j === i ? { ...x, obligation: e.target.value } : x))} />
                  <select className="form-input" value={o.responsible_party} onChange={(e) => setObligations((arr) => arr.map((x, j) => j === i ? { ...x, responsible_party: e.target.value } : x))}>
                    <option value="counterparty">{t("contracts.field.counterparty")}</option>
                    <option value="sadcpf">SADC PF</option>{/* i18n-ignore */}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.create.templateReview")}</h2>
            <div className="space-y-1">
              <label htmlFor="contracts-create-template-version" className="text-xs font-semibold text-neutral-600">{t("contracts.create.generateFromTemplate")}</label>
              <select id="contracts-create-template-version" className="form-input" value={templateVersionId} onChange={(e) => setTemplateVersionId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">{t("contracts.create.doNotGenerate")}</option>
                {templateOptions.map((opt) => (<option key={opt.id} value={opt.id}>{opt.label}</option>))}
              </select>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <dt className="text-neutral-500">{t("contracts.field.title")}</dt><dd className="text-neutral-900 font-medium">{title || "—"}</dd>
              <dt className="text-neutral-500">{t("contracts.create.step.origin")}</dt><dd className="text-neutral-900 capitalize">{t(`contracts.create.origin.${origin}`)}</dd>
              <dt className="text-neutral-500">{t("contracts.field.counterparty")}</dt><dd className="text-neutral-900">{partyType === "organisation" ? (vendors.find((v) => v.id === vendorId)?.name ?? "—") : `${firstName} ${surname}`.trim() || "—"}</dd>
              <dt className="text-neutral-500">{t("contracts.field.value")}</dt><dd className="text-neutral-900 font-semibold">{currency} {computedValue.toLocaleString()}</dd>
              <dt className="text-neutral-500">{t("contracts.create.dates")}</dt><dd className="text-neutral-900">{startDate || "—"} → {endDate || "—"}</dd>
              <dt className="text-neutral-500">{t("contracts.create.deliverables")}</dt><dd className="text-neutral-900">{deliverables.filter((d) => d.name.trim()).length}</dd>
            </dl>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button type="button" className="btn-secondary" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))}>{t("common.back")}</button>
        {step < STEPS.length ? (
          <button type="button" className="btn-primary disabled:opacity-60" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>{t("contracts.create.continue")}</button>
        ) : (
          <button type="button" className="btn-primary disabled:opacity-60" disabled={submitting} onClick={submit}>
            {submitting ? t("contracts.register.creating") : t("contracts.create.createContract")}
          </button>
        )}
      </div>
    </div>
  );
}
