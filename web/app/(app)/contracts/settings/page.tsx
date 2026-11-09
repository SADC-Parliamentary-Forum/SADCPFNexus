"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { contractsApi, type ContractType, type CurrencyRecord, type ContractAuthorityRule, type ContractComplianceRequirement } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function ContractSettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();

  const { data: types = [] } = useQuery({
    queryKey: ["contract-types-admin"],
    queryFn: () => contractsApi.types().then((r) => r.data.data),
  });
  const { data: currencies = [] } = useQuery({
    queryKey: ["contract-currencies-admin"],
    queryFn: () => contractsApi.currencies(true).then((r) => r.data.data),
  });
  const { data: authorityRules = [] } = useQuery({
    queryKey: ["contract-authority-rules"],
    queryFn: () => contractsApi.authorityRules().then((r) => r.data.data).catch(() => []),
  });
  const { data: complianceReqs = [] } = useQuery({
    queryKey: ["contract-compliance-requirements"],
    queryFn: () => contractsApi.complianceRequirements().then((r) => r.data.data).catch(() => []),
  });

  // New contract type form
  const [typeName, setTypeName] = useState("");
  const [typeCounterparty, setTypeCounterparty] = useState("individual");
  const [typeLegal, setTypeLegal] = useState(false);

  // New currency form
  const [curCode, setCurCode] = useState("");
  const [curName, setCurName] = useState("");
  const [curSymbol, setCurSymbol] = useState("");

  // New authority rule form
  const [ruleName, setRuleName] = useState("");
  const [ruleAction, setRuleAction] = useState<"approve" | "sign">("approve");
  const [ruleFloor, setRuleFloor] = useState("");
  const [ruleCeiling, setRuleCeiling] = useState("");
  const [ruleRole, setRuleRole] = useState("");
  const [ruleAltRole, setRuleAltRole] = useState("");
  const [rulePolicy, setRulePolicy] = useState("");

  // New compliance requirement form
  const [reqCode, setReqCode] = useState("");
  const [reqName, setReqName] = useState("");
  const [reqExpiry, setReqExpiry] = useState(false);
  const [reqBlockAct, setReqBlockAct] = useState(false);
  const [reqBlockPay, setReqBlockPay] = useState(false);

  const refreshTypes = () => qc.invalidateQueries({ queryKey: ["contract-types-admin"] });
  const refreshCurrencies = () => qc.invalidateQueries({ queryKey: ["contract-currencies-admin"] });
  const refreshRules = () => qc.invalidateQueries({ queryKey: ["contract-authority-rules"] });
  const refreshCompliance = () => qc.invalidateQueries({ queryKey: ["contract-compliance-requirements"] });

  const err = (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.common.actionFailed"));

  const addType = () => {
    if (!typeName.trim()) return;
    contractsApi.createType({ name: typeName.trim(), counterparty_type: typeCounterparty, requires_legal_review: typeLegal })
      .then(() => { toast.success(t("contracts.settings.typeAdded")); setTypeName(""); setTypeLegal(false); refreshTypes(); }).catch(err);
  };
  const toggleType = (ty: ContractType) =>
    contractsApi.updateType(ty.id, { is_active: !ty.is_active }).then(() => { toast.success(t("contracts.settings.updated")); refreshTypes(); }).catch(err);
  const toggleTypeLegal = (ty: ContractType) =>
    contractsApi.updateType(ty.id, { requires_legal_review: !ty.requires_legal_review }).then(() => { toast.success(t("contracts.settings.updated")); refreshTypes(); }).catch(err);

  const addCurrency = () => {
    if (!curCode.trim() || !curName.trim()) return;
    contractsApi.createCurrency({ code: curCode.trim(), name: curName.trim(), symbol: curSymbol.trim() || undefined })
      .then(() => { toast.success(t("contracts.settings.currencyAdded")); setCurCode(""); setCurName(""); setCurSymbol(""); refreshCurrencies(); }).catch(err);
  };
  const makeDefault = (c: CurrencyRecord) =>
    contractsApi.updateCurrency(c.id, { is_default: true }).then(() => { toast.success(t("contracts.settings.defaultSet")); refreshCurrencies(); }).catch(err);
  const toggleCurrency = (c: CurrencyRecord) =>
    contractsApi.updateCurrency(c.id, { is_active: !c.is_active }).then(() => { toast.success(t("contracts.settings.updated")); refreshCurrencies(); }).catch(err);

  const addRule = () => {
    if (!ruleName.trim() || !ruleRole.trim()) return;
    contractsApi.createAuthorityRule({
      name: ruleName.trim(), action: ruleAction, authorised_role: ruleRole.trim(),
      alternate_role: ruleAltRole.trim() || undefined, amount_floor: ruleFloor ? Number(ruleFloor) : 0,
      amount_ceiling: ruleCeiling ? Number(ruleCeiling) : undefined, policy_source: rulePolicy.trim() || undefined,
    }).then(() => {
      toast.success(t("contracts.settings.ruleAdded"));
      setRuleName(""); setRuleFloor(""); setRuleCeiling(""); setRuleRole(""); setRuleAltRole(""); setRulePolicy("");
      refreshRules();
    }).catch(err);
  };
  const toggleRule = (r: ContractAuthorityRule) =>
    contractsApi.updateAuthorityRule(r.id, { is_active: !r.is_active }).then(() => { toast.success(t("contracts.settings.updated")); refreshRules(); }).catch(err);

  const band = (r: ContractAuthorityRule) => {
    const floor = Number(r.amount_floor).toLocaleString();
    return r.amount_ceiling != null ? `${floor} – ${Number(r.amount_ceiling).toLocaleString()}` : `≥ ${floor}`;
  };

  const addRequirement = () => {
    if (!reqCode.trim() || !reqName.trim()) return;
    contractsApi.createComplianceRequirement({
      code: reqCode.trim(), name: reqName.trim(), requires_expiry: reqExpiry,
      blocks_activation: reqBlockAct, blocks_payment: reqBlockPay,
    }).then(() => {
      toast.success(t("contracts.settings.requirementAdded"));
      setReqCode(""); setReqName(""); setReqExpiry(false); setReqBlockAct(false); setReqBlockPay(false);
      refreshCompliance();
    }).catch(err);
  };
  const toggleRequirement = (r: ContractComplianceRequirement) =>
    contractsApi.updateComplianceRequirement(r.id, { is_active: !r.is_active }).then(() => { toast.success(t("contracts.settings.updated")); refreshCompliance(); }).catch(err);

  return (
    <div className="space-y-6 max-w-4xl">
      <ModulePageHeader
        title="contracts.settings.title"
        subtitle="contracts.settings.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.contracts", href: "/contracts" }, { label: "contracts.settings.crumb" }]} />}
      />

      {/* Contract types */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100"><h2 className="text-sm font-semibold text-neutral-800">{t("contracts.settings.types")}</h2></div>
        <table className="data-table">
          <thead><tr><th>{t("contracts.field.name")}</th><th>{t("contracts.field.counterparty")}</th><th>{t("contracts.settings.legalReview")}</th><th>{t("contracts.status.active")}</th><th></th></tr></thead>
          <tbody>
            {types.map((ty) => (
              <tr key={ty.id}>
                <td className="text-sm font-medium text-neutral-800">{ty.name}</td>
                <td className="text-xs capitalize text-neutral-500">{ty.counterparty_type}</td>
                <td className="text-sm">
                  <button className="font-semibold text-primary text-xs hover:opacity-80" onClick={() => toggleTypeLegal(ty)}>{ty.requires_legal_review ? t("contracts.settings.required") : t("contracts.settings.notRequired")}</button>
                </td>
                <td className="text-sm">{ty.is_active ? t("contracts.common.yes") : t("contracts.common.no")}</td>
                <td className="text-right"><button className="btn-secondary text-xs py-0.5" onClick={() => toggleType(ty)}>{ty.is_active ? t("contracts.settings.deactivate") : t("contracts.templates.activate")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-end gap-2">
          <div className="space-y-1"><label htmlFor="contracts-settings-type-name" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.newTypeName")}</label><input id="contracts-settings-type-name" className="form-input" value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder={t("contracts.settings.typePlaceholder")} /></div>
          <div className="space-y-1"><label htmlFor="contracts-settings-type-counterparty" className="text-xs font-semibold text-neutral-600">{t("contracts.field.counterparty")}</label>
            <select id="contracts-settings-type-counterparty" className="form-input" value={typeCounterparty} onChange={(e) => setTypeCounterparty(e.target.value)}>
              <option value="individual">{t("contracts.counterpartyType.individual")}</option><option value="organisation">{t("contracts.counterpartyType.organisation")}</option><option value="either">{t("contracts.counterpartyType.either")}</option>
            </select>
          </div>
          <label htmlFor="contracts-settings-type-legal" className="flex items-center gap-2 text-sm text-neutral-600 pb-2"><input id="contracts-settings-type-legal" type="checkbox" checked={typeLegal} onChange={(e) => setTypeLegal(e.target.checked)} /> {t("contracts.settings.requiresLegal")}</label>
          <button className="btn-primary text-sm" onClick={addType}>{t("contracts.settings.addType")}</button>
        </div>
      </div>

      {/* Currencies */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100"><h2 className="text-sm font-semibold text-neutral-800">{t("contracts.settings.currencies")}</h2></div>
        <table className="data-table">
          <thead><tr><th>{t("contracts.settings.code")}</th><th>{t("contracts.field.name")}</th><th>{t("contracts.settings.symbol")}</th><th>{t("contracts.settings.default")}</th><th>{t("contracts.status.active")}</th><th></th></tr></thead>
          <tbody>
            {currencies.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-sm">{c.code}</td>
                <td className="text-sm text-neutral-800">{c.name}</td>
                <td className="text-sm text-neutral-600">{c.symbol ?? "—"}</td>
                <td className="text-sm">{c.is_default ? <span className="badge badge-success">{t("contracts.settings.default")}</span> : <button className="font-semibold text-primary text-xs hover:opacity-80" onClick={() => makeDefault(c)}>{t("contracts.settings.setDefault")}</button>}</td>
                <td className="text-sm">{c.is_active ? t("contracts.common.yes") : t("contracts.common.no")}</td>
                <td className="text-right"><button className="btn-secondary text-xs py-0.5" onClick={() => toggleCurrency(c)}>{c.is_active ? t("contracts.settings.deactivate") : t("contracts.templates.activate")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-end gap-2">
          <div className="space-y-1"><label htmlFor="contracts-settings-currency-code" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.code")}</label><input id="contracts-settings-currency-code" className="form-input w-24 uppercase" value={curCode} maxLength={8} onChange={(e) => setCurCode(e.target.value.toUpperCase())} placeholder="KES" /></div>
          <div className="space-y-1"><label htmlFor="contracts-settings-currency-name" className="text-xs font-semibold text-neutral-600">{t("contracts.field.name")}</label><input id="contracts-settings-currency-name" className="form-input" value={curName} onChange={(e) => setCurName(e.target.value)} placeholder={t("contracts.settings.currencyNamePlaceholder")} /></div>
          <div className="space-y-1"><label htmlFor="contracts-settings-currency-symbol" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.symbol")}</label><input id="contracts-settings-currency-symbol" className="form-input w-24" value={curSymbol} onChange={(e) => setCurSymbol(e.target.value)} placeholder="KSh" /></div>
          <button className="btn-primary text-sm" onClick={addCurrency}>{t("contracts.settings.addCurrency")}</button>
        </div>
      </div>

      {/* Authority Matrix */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.settings.authorityMatrix")}</h2>
          <p className="text-xs text-neutral-500 mt-0.5">{t("contracts.settings.authorityHint")}</p>
        </div>
        <table className="data-table">
          <thead><tr><th>{t("contracts.settings.rule")}</th><th>{t("contracts.settings.action")}</th><th>{t("contracts.settings.valueBand")}</th><th>{t("contracts.settings.authorisedRole")}</th><th>{t("contracts.settings.alternate")}</th><th>{t("contracts.settings.policy")}</th><th>{t("contracts.status.active")}</th><th></th></tr></thead>
          <tbody>
            {authorityRules.length === 0 ? (
              <tr><td colSpan={8} className="text-sm text-neutral-400 p-4">{t("contracts.settings.noRules")}</td></tr>
            ) : authorityRules.map((r) => (
              <tr key={r.id}>
                <td className="text-sm font-medium text-neutral-800">{r.name}</td>
                <td className="text-xs capitalize text-neutral-500">{r.action === "approve" || r.action === "sign" ? t(`contracts.settings.ruleAction.${r.action}`) : r.action}</td>
                <td className="text-sm text-neutral-600">{band(r)} {r.currency ?? ""}</td>
                <td className="text-sm text-neutral-800">{r.authorised_role}</td>
                <td className="text-xs text-neutral-500">{r.alternate_role ?? "—"}</td>
                <td className="text-xs text-neutral-500">{r.policy_source ?? "—"}</td>
                <td className="text-sm">{r.is_active ? t("contracts.common.yes") : t("contracts.common.no")}</td>
                <td className="text-right"><button className="btn-secondary text-xs py-0.5" onClick={() => toggleRule(r)}>{r.is_active ? t("contracts.settings.deactivate") : t("contracts.templates.activate")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-end gap-2">
          <div className="space-y-1"><label htmlFor="contracts-settings-rule-name" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.ruleName")}</label><input id="contracts-settings-rule-name" className="form-input" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder={t("contracts.settings.rulePlaceholder")} /></div>
          <div className="space-y-1"><label htmlFor="contracts-settings-rule-action" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.action")}</label>
            <select id="contracts-settings-rule-action" className="form-input w-28" value={ruleAction} onChange={(e) => setRuleAction(e.target.value as "approve" | "sign")}>
              <option value="approve">{t("contracts.settings.ruleAction.approve")}</option><option value="sign">{t("contracts.settings.ruleAction.sign")}</option>
            </select>
          </div>
          <div className="space-y-1"><label htmlFor="contracts-settings-rule-floor" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.floor")}</label><input id="contracts-settings-rule-floor" className="form-input w-28" type="number" value={ruleFloor} onChange={(e) => setRuleFloor(e.target.value)} placeholder="0" /></div>
          <div className="space-y-1"><label htmlFor="contracts-settings-rule-ceiling" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.ceiling")}</label><input id="contracts-settings-rule-ceiling" className="form-input w-28" type="number" value={ruleCeiling} onChange={(e) => setRuleCeiling(e.target.value)} placeholder={t("contracts.settings.ceilingPlaceholder")} /></div>
          <div className="space-y-1"><label htmlFor="contracts-settings-rule-role" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.authorisedRole")}</label><input id="contracts-settings-rule-role" className="form-input" value={ruleRole} onChange={(e) => setRuleRole(e.target.value)} placeholder={t("contracts.settings.rolePlaceholder")} /></div>
          <div className="space-y-1"><label htmlFor="contracts-settings-rule-alt-role" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.alternateRole")}</label><input id="contracts-settings-rule-alt-role" className="form-input" value={ruleAltRole} onChange={(e) => setRuleAltRole(e.target.value)} placeholder={t("contracts.common.optionalParen")} /></div>
          <div className="space-y-1"><label htmlFor="contracts-settings-rule-policy" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.policyRef")}</label><input id="contracts-settings-rule-policy" className="form-input w-36" value={rulePolicy} onChange={(e) => setRulePolicy(e.target.value)} placeholder={t("contracts.common.optionalParen")} /></div>
          <button className="btn-primary text-sm" onClick={addRule}>{t("contracts.settings.addRule")}</button>
        </div>
      </div>

      {/* Compliance requirements */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.settings.compliance")}</h2>
          <p className="text-xs text-neutral-500 mt-0.5">{t("contracts.settings.complianceHint")}</p>
        </div>
        <table className="data-table">
          <thead><tr><th>{t("contracts.settings.code")}</th><th>{t("contracts.field.name")}</th><th>{t("contracts.settings.expiryTracked")}</th><th>{t("contracts.settings.blocksActivation")}</th><th>{t("contracts.settings.blocksPayment")}</th><th>{t("contracts.status.active")}</th><th></th></tr></thead>
          <tbody>
            {complianceReqs.length === 0 ? (
              <tr><td colSpan={7} className="text-sm text-neutral-400 p-4">{t("contracts.settings.noRequirements")}</td></tr>
            ) : complianceReqs.map((r) => (
              <tr key={r.id}>
                <td className="text-sm font-mono">{r.code}</td>
                <td className="text-sm text-neutral-800">{r.name}</td>
                <td className="text-sm">{r.requires_expiry ? t("contracts.common.yes") : t("contracts.common.no")}</td>
                <td className="text-sm">{r.blocks_activation ? t("contracts.common.yes") : t("contracts.common.no")}</td>
                <td className="text-sm">{r.blocks_payment ? t("contracts.common.yes") : t("contracts.common.no")}</td>
                <td className="text-sm">{r.is_active ? t("contracts.common.yes") : t("contracts.common.no")}</td>
                <td className="text-right"><button className="btn-secondary text-xs py-0.5" onClick={() => toggleRequirement(r)}>{r.is_active ? t("contracts.settings.deactivate") : t("contracts.templates.activate")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-end gap-2">
          <div className="space-y-1"><label htmlFor="contracts-settings-requirement-code" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.code")}</label><input id="contracts-settings-requirement-code" className="form-input w-40" value={reqCode} onChange={(e) => setReqCode(e.target.value)} placeholder="tax_clearance" /></div>{/* i18n-ignore */}
          <div className="space-y-1"><label htmlFor="contracts-settings-requirement-name" className="text-xs font-semibold text-neutral-600">{t("contracts.field.name")}</label><input id="contracts-settings-requirement-name" className="form-input" value={reqName} onChange={(e) => setReqName(e.target.value)} placeholder={t("contracts.settings.reqPlaceholder")} /></div>
          <label htmlFor="contracts-settings-requirement-expiry" className="flex items-center gap-2 text-sm text-neutral-600 pb-2"><input id="contracts-settings-requirement-expiry" type="checkbox" checked={reqExpiry} onChange={(e) => setReqExpiry(e.target.checked)} /> {t("contracts.settings.tracksExpiry")}</label>
          <label htmlFor="contracts-settings-requirement-block-activation" className="flex items-center gap-2 text-sm text-neutral-600 pb-2"><input id="contracts-settings-requirement-block-activation" type="checkbox" checked={reqBlockAct} onChange={(e) => setReqBlockAct(e.target.checked)} /> {t("contracts.settings.blocksActivation")}</label>
          <label htmlFor="contracts-settings-requirement-block-payment" className="flex items-center gap-2 text-sm text-neutral-600 pb-2"><input id="contracts-settings-requirement-block-payment" type="checkbox" checked={reqBlockPay} onChange={(e) => setReqBlockPay(e.target.checked)} /> {t("contracts.settings.blocksPayment")}</label>
          <button className="btn-primary text-sm" onClick={addRequirement}>{t("contracts.settings.addRequirement")}</button>
        </div>
      </div>
    </div>
  );
}
