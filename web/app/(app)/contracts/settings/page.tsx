"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { contractsApi, type ContractType, type CurrencyRecord, type ContractAuthorityRule, type ContractComplianceRequirement, type ContractClauseRecord } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import {
  ContractField,
  ContractSubNav,
  ContractTableWrap,
  SettingsSectionNav,
} from "@/components/contracts/ContractChrome";

export default function ContractSettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const user = getStoredUser();
  const canManageClauses = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.manage_clause"]));

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
  const { data: clauses = [] } = useQuery({
    queryKey: ["contract-clause-library"],
    queryFn: () => contractsApi.clauseLibrary().then((r) => r.data.data).catch(() => [] as ContractClauseRecord[]),
  });

  const [typeName, setTypeName] = useState("");
  const [typeCounterparty, setTypeCounterparty] = useState("individual");
  const [typeLegal, setTypeLegal] = useState(false);

  const [curCode, setCurCode] = useState("");
  const [curName, setCurName] = useState("");
  const [curSymbol, setCurSymbol] = useState("");

  const [ruleName, setRuleName] = useState("");
  const [ruleAction, setRuleAction] = useState<"approve" | "sign">("approve");
  const [ruleFloor, setRuleFloor] = useState("");
  const [ruleCeiling, setRuleCeiling] = useState("");
  const [ruleRole, setRuleRole] = useState("");
  const [ruleAltRole, setRuleAltRole] = useState("");
  const [rulePolicy, setRulePolicy] = useState("");

  const [reqCode, setReqCode] = useState("");
  const [reqName, setReqName] = useState("");
  const [reqExpiry, setReqExpiry] = useState(false);
  const [reqBlockAct, setReqBlockAct] = useState(false);
  const [reqBlockPay, setReqBlockPay] = useState(false);

  const [clauseKey, setClauseKey] = useState("");
  const [clauseTitle, setClauseTitle] = useState("");
  const [clauseCategory, setClauseCategory] = useState("");
  const [clauseType, setClauseType] = useState("optional");
  const [clauseBody, setClauseBody] = useState("");

  const refreshTypes = () => qc.invalidateQueries({ queryKey: ["contract-types-admin"] });
  const refreshCurrencies = () => qc.invalidateQueries({ queryKey: ["contract-currencies-admin"] });
  const refreshRules = () => qc.invalidateQueries({ queryKey: ["contract-authority-rules"] });
  const refreshCompliance = () => qc.invalidateQueries({ queryKey: ["contract-compliance-requirements"] });
  const refreshClauses = () => qc.invalidateQueries({ queryKey: ["contract-clause-library"] });

  const err = (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.actionFailed"));
  const yesNo = (v: boolean) => (v ? t("contracts.yes") : t("contracts.no"));
  const toggleLabel = (active: boolean) => (active ? t("contracts.deactivate") : t("contracts.activate"));

  const addType = () => {
    if (!typeName.trim()) return;
    contractsApi.createType({ name: typeName.trim(), counterparty_type: typeCounterparty, requires_legal_review: typeLegal })
      .then(() => { toast.success(t("contracts.settings.typeAdded")); setTypeName(""); setTypeLegal(false); refreshTypes(); }).catch(err);
  };
  const toggleType = (row: ContractType) =>
    contractsApi.updateType(row.id, { is_active: !row.is_active }).then(() => { toast.success(t("contracts.updated")); refreshTypes(); }).catch(err);
  const toggleTypeLegal = (row: ContractType) =>
    contractsApi.updateType(row.id, { requires_legal_review: !row.requires_legal_review }).then(() => { toast.success(t("contracts.updated")); refreshTypes(); }).catch(err);

  const addCurrency = () => {
    if (!curCode.trim() || !curName.trim()) return;
    contractsApi.createCurrency({ code: curCode.trim(), name: curName.trim(), symbol: curSymbol.trim() || undefined })
      .then(() => { toast.success(t("contracts.settings.currencyAdded")); setCurCode(""); setCurName(""); setCurSymbol(""); refreshCurrencies(); }).catch(err);
  };
  const makeDefault = (c: CurrencyRecord) =>
    contractsApi.updateCurrency(c.id, { is_default: true }).then(() => { toast.success(t("contracts.settings.defaultSet")); refreshCurrencies(); }).catch(err);
  const toggleCurrency = (c: CurrencyRecord) =>
    contractsApi.updateCurrency(c.id, { is_active: !c.is_active }).then(() => { toast.success(t("contracts.updated")); refreshCurrencies(); }).catch(err);

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
    contractsApi.updateAuthorityRule(r.id, { is_active: !r.is_active }).then(() => { toast.success(t("contracts.updated")); refreshRules(); }).catch(err);

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
    contractsApi.updateComplianceRequirement(r.id, { is_active: !r.is_active }).then(() => { toast.success(t("contracts.updated")); refreshCompliance(); }).catch(err);

  const addClause = () => {
    if (!clauseKey.trim() || !clauseTitle.trim() || !clauseBody.trim()) return;
    contractsApi.createClause({
      key: clauseKey.trim(), title: clauseTitle.trim(), category: clauseCategory.trim() || undefined,
      clause_type: clauseType, body: clauseBody.trim(),
    }).then(() => {
      toast.success(t("contracts.settings.clauseAdded"));
      setClauseKey(""); setClauseTitle(""); setClauseCategory(""); setClauseType("optional"); setClauseBody("");
      refreshClauses();
    }).catch(err);
  };

  const partyLabel = (value: string) => t(`contracts.party.${value}`) !== `contracts.party.${value}` ? t(`contracts.party.${value}`) : value;
  const clauseTypeLabel = (value: string) => t(`contracts.clause.${value}`) !== `contracts.clause.${value}` ? t(`contracts.clause.${value}`) : value.replace(/_/g, " ");

  const sections = [
    { id: "types", label: t("contracts.settings.types") },
    { id: "currencies", label: t("contracts.settings.currencies") },
    { id: "authority", label: t("contracts.settings.authority") },
    { id: "compliance", label: t("contracts.settings.compliance") },
    { id: "clauses", label: t("contracts.settings.clauses") },
  ];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="contracts.settingsTitle"
        subtitle="contracts.settingsSubtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "contracts.title", href: "/contracts" }, { label: "contracts.settings" }]} />}
      />
      <ContractSubNav />
      <SettingsSectionNav sections={sections} />

      <section id="types" className="card overflow-hidden scroll-mt-4">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.settings.types")}</h2>
        </div>
        <ContractTableWrap>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("contracts.col.name")}</th>
                <th>{t("contracts.col.counterparty")}</th>
                <th>{t("contracts.col.legalReview")}</th>
                <th>{t("contracts.col.active")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {types.length === 0 ? (
                <tr><td colSpan={5} className="text-sm text-neutral-400 p-4">{t("contracts.settings.noTypes")}</td></tr>
              ) : types.map((row) => (
                <tr key={row.id}>
                  <td className="text-sm font-medium text-neutral-800">{row.name}</td>
                  <td className="text-xs text-neutral-500">{partyLabel(row.counterparty_type)}</td>
                  <td className="text-sm">
                    <button type="button" className="text-primary text-xs underline" onClick={() => toggleTypeLegal(row)}>
                      {row.requires_legal_review ? t("contracts.required") : t("contracts.notRequired")}
                    </button>
                  </td>
                  <td className="text-sm">{yesNo(row.is_active)}</td>
                  <td className="text-right">
                    <button type="button" className="btn-secondary text-xs py-0.5" onClick={() => toggleType(row)}>{toggleLabel(row.is_active)}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContractTableWrap>
        <div className="p-4 border-t border-neutral-100 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <ContractField label={t("contracts.field.typeName")} htmlFor="settings-type-name">
            <input id="settings-type-name" className="form-input w-full" value={typeName} onChange={(e) => setTypeName(e.target.value)} />
          </ContractField>
          <ContractField label={t("contracts.field.counterparty")} htmlFor="settings-type-party">
            <select id="settings-type-party" className="form-input w-full" value={typeCounterparty} onChange={(e) => setTypeCounterparty(e.target.value)}>
              <option value="individual">{t("contracts.party.individual")}</option>
              <option value="organisation">{t("contracts.party.organisation")}</option>
              <option value="either">{t("contracts.party.either")}</option>
            </select>
          </ContractField>
          <label className="flex items-center gap-2 text-sm text-neutral-600 pb-2">
            <input type="checkbox" checked={typeLegal} onChange={(e) => setTypeLegal(e.target.checked)} />
            {t("contracts.field.legalReview")}
          </label>
          <button type="button" className="btn-primary text-sm justify-self-start" onClick={addType}>{t("contracts.settings.addType")}</button>
        </div>
      </section>

      <section id="currencies" className="card overflow-hidden scroll-mt-4">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.settings.currencies")}</h2>
        </div>
        <ContractTableWrap>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("contracts.col.code")}</th>
                <th>{t("contracts.col.name")}</th>
                <th>{t("contracts.col.symbol")}</th>
                <th>{t("contracts.col.default")}</th>
                <th>{t("contracts.col.active")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {currencies.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono text-sm">{c.code}</td>
                  <td className="text-sm text-neutral-800">{c.name}</td>
                  <td className="text-sm text-neutral-600">{c.symbol ?? "—"}</td>
                  <td className="text-sm">
                    {c.is_default
                      ? <span className="badge badge-success">{t("contracts.default")}</span>
                      : <button type="button" className="text-primary text-xs underline" onClick={() => makeDefault(c)}>{t("contracts.setDefault")}</button>}
                  </td>
                  <td className="text-sm">{yesNo(c.is_active)}</td>
                  <td className="text-right">
                    <button type="button" className="btn-secondary text-xs py-0.5" onClick={() => toggleCurrency(c)}>{toggleLabel(c.is_active)}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContractTableWrap>
        <div className="p-4 border-t border-neutral-100 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <ContractField label={t("contracts.field.code")} htmlFor="settings-cur-code">
            <input id="settings-cur-code" className="form-input w-full uppercase" value={curCode} maxLength={8} onChange={(e) => setCurCode(e.target.value.toUpperCase())} />
          </ContractField>
          <ContractField label={t("contracts.field.name")} htmlFor="settings-cur-name">
            <input id="settings-cur-name" className="form-input w-full" value={curName} onChange={(e) => setCurName(e.target.value)} />
          </ContractField>
          <ContractField label={t("contracts.field.symbol")} htmlFor="settings-cur-symbol">
            <input id="settings-cur-symbol" className="form-input w-full" value={curSymbol} onChange={(e) => setCurSymbol(e.target.value)} />
          </ContractField>
          <button type="button" className="btn-primary text-sm justify-self-start" onClick={addCurrency}>{t("contracts.settings.addCurrency")}</button>
        </div>
      </section>

      <section id="authority" className="card overflow-hidden scroll-mt-4">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.settings.authority")}</h2>
          <p className="text-xs text-neutral-500 mt-0.5">{t("contracts.settings.authorityHint")}</p>
        </div>
        <ContractTableWrap>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("contracts.col.rule")}</th>
                <th>{t("contracts.col.action")}</th>
                <th>{t("contracts.col.valueBand")}</th>
                <th>{t("contracts.col.authorisedRole")}</th>
                <th>{t("contracts.col.alternate")}</th>
                <th>{t("contracts.col.policy")}</th>
                <th>{t("contracts.col.active")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {authorityRules.length === 0 ? (
                <tr><td colSpan={8} className="text-sm text-neutral-400 p-4">{t("contracts.settings.noRules")}</td></tr>
              ) : authorityRules.map((r) => (
                <tr key={r.id}>
                  <td className="text-sm font-medium text-neutral-800">{r.name}</td>
                  <td className="text-xs text-neutral-500">{t(`contracts.authority.${r.action}`)}</td>
                  <td className="text-sm text-neutral-600 whitespace-nowrap">{band(r)} {r.currency ?? ""}</td>
                  <td className="text-sm text-neutral-800">{r.authorised_role}</td>
                  <td className="text-xs text-neutral-500">{r.alternate_role ?? "—"}</td>
                  <td className="text-xs text-neutral-500">{r.policy_source ?? "—"}</td>
                  <td className="text-sm">{yesNo(r.is_active)}</td>
                  <td className="text-right">
                    <button type="button" className="btn-secondary text-xs py-0.5" onClick={() => toggleRule(r)}>{toggleLabel(r.is_active)}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContractTableWrap>
        <div className="p-4 border-t border-neutral-100 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          <ContractField label={t("contracts.field.ruleName")} htmlFor="settings-rule-name" className="lg:col-span-2">
            <input id="settings-rule-name" className="form-input w-full" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
          </ContractField>
          <ContractField label={t("contracts.field.action")} htmlFor="settings-rule-action">
            <select id="settings-rule-action" className="form-input w-full" value={ruleAction} onChange={(e) => setRuleAction(e.target.value as "approve" | "sign")}>
              <option value="approve">{t("contracts.authority.approve")}</option>
              <option value="sign">{t("contracts.authority.sign")}</option>
            </select>
          </ContractField>
          <ContractField label={t("contracts.field.floor")} htmlFor="settings-rule-floor">
            <input id="settings-rule-floor" className="form-input w-full" type="number" value={ruleFloor} onChange={(e) => setRuleFloor(e.target.value)} />
          </ContractField>
          <ContractField label={t("contracts.field.ceiling")} htmlFor="settings-rule-ceiling">
            <input id="settings-rule-ceiling" className="form-input w-full" type="number" value={ruleCeiling} onChange={(e) => setRuleCeiling(e.target.value)} />
          </ContractField>
          <ContractField label={t("contracts.field.authorisedRole")} htmlFor="settings-rule-role">
            <input id="settings-rule-role" className="form-input w-full" value={ruleRole} onChange={(e) => setRuleRole(e.target.value)} />
          </ContractField>
          <ContractField label={t("contracts.field.alternateRole")} htmlFor="settings-rule-alt">
            <input id="settings-rule-alt" className="form-input w-full" value={ruleAltRole} onChange={(e) => setRuleAltRole(e.target.value)} />
          </ContractField>
          <ContractField label={t("contracts.field.policyRef")} htmlFor="settings-rule-policy">
            <input id="settings-rule-policy" className="form-input w-full" value={rulePolicy} onChange={(e) => setRulePolicy(e.target.value)} />
          </ContractField>
          <button type="button" className="btn-primary text-sm justify-self-start" onClick={addRule}>{t("contracts.settings.addRule")}</button>
        </div>
      </section>

      <section id="compliance" className="card overflow-hidden scroll-mt-4">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.settings.compliance")}</h2>
          <p className="text-xs text-neutral-500 mt-0.5">{t("contracts.settings.complianceHint")}</p>
        </div>
        <ContractTableWrap>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("contracts.col.code")}</th>
                <th>{t("contracts.col.name")}</th>
                <th>{t("contracts.col.expiryTracked")}</th>
                <th>{t("contracts.col.blocksActivation")}</th>
                <th>{t("contracts.col.blocksPayment")}</th>
                <th>{t("contracts.col.active")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {complianceReqs.length === 0 ? (
                <tr><td colSpan={7} className="text-sm text-neutral-400 p-4">{t("contracts.settings.noRequirements")}</td></tr>
              ) : complianceReqs.map((r) => (
                <tr key={r.id}>
                  <td className="text-sm font-mono">{r.code}</td>
                  <td className="text-sm text-neutral-800">{r.name}</td>
                  <td className="text-sm">{yesNo(r.requires_expiry)}</td>
                  <td className="text-sm">{yesNo(r.blocks_activation)}</td>
                  <td className="text-sm">{yesNo(r.blocks_payment)}</td>
                  <td className="text-sm">{yesNo(r.is_active)}</td>
                  <td className="text-right">
                    <button type="button" className="btn-secondary text-xs py-0.5" onClick={() => toggleRequirement(r)}>{toggleLabel(r.is_active)}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContractTableWrap>
        <div className="p-4 border-t border-neutral-100 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
          <ContractField label={t("contracts.field.code")} htmlFor="settings-req-code">
            <input id="settings-req-code" className="form-input w-full" value={reqCode} onChange={(e) => setReqCode(e.target.value)} />
          </ContractField>
          <ContractField label={t("contracts.field.name")} htmlFor="settings-req-name" className="lg:col-span-2">
            <input id="settings-req-name" className="form-input w-full" value={reqName} onChange={(e) => setReqName(e.target.value)} />
          </ContractField>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" checked={reqExpiry} onChange={(e) => setReqExpiry(e.target.checked)} />
            {t("contracts.field.tracksExpiry")}
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" checked={reqBlockAct} onChange={(e) => setReqBlockAct(e.target.checked)} />
            {t("contracts.field.blocksActivation")}
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" checked={reqBlockPay} onChange={(e) => setReqBlockPay(e.target.checked)} />
            {t("contracts.field.blocksPayment")}
          </label>
          <button type="button" className="btn-primary text-sm justify-self-start" onClick={addRequirement}>{t("contracts.settings.addRequirement")}</button>
        </div>
      </section>

      <section id="clauses" className="card overflow-hidden scroll-mt-4">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.settings.clauses")}</h2>
          <p className="text-xs text-neutral-500 mt-0.5">{t("contracts.settings.clausesHint")}</p>
        </div>
        <ContractTableWrap>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("contracts.col.key")}</th>
                <th>{t("contracts.col.title")}</th>
                <th>{t("contracts.col.category")}</th>
                <th>{t("contracts.col.clauseType")}</th>
                <th>{t("contracts.col.active")}</th>
              </tr>
            </thead>
            <tbody>
              {clauses.length === 0 ? (
                <tr><td colSpan={5} className="text-sm text-neutral-400 p-4">{t("contracts.settings.noClauses")}</td></tr>
              ) : clauses.map((c) => (
                <tr key={c.id}>
                  <td className="text-sm font-mono">{c.key}</td>
                  <td className="text-sm font-medium text-neutral-800">{c.title}</td>
                  <td className="text-xs text-neutral-500">{c.category ?? "—"}</td>
                  <td className="text-xs text-neutral-500">{clauseTypeLabel(c.clause_type)}</td>
                  <td className="text-sm">{yesNo(c.is_active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ContractTableWrap>
        {canManageClauses && (
          <div className="p-4 border-t border-neutral-100 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <ContractField label={t("contracts.field.key")} htmlFor="settings-clause-key">
              <input id="settings-clause-key" className="form-input w-full" value={clauseKey} onChange={(e) => setClauseKey(e.target.value)} />
            </ContractField>
            <ContractField label={t("contracts.field.title")} htmlFor="settings-clause-title">
              <input id="settings-clause-title" className="form-input w-full" value={clauseTitle} onChange={(e) => setClauseTitle(e.target.value)} />
            </ContractField>
            <ContractField label={t("contracts.field.category")} htmlFor="settings-clause-cat">
              <input id="settings-clause-cat" className="form-input w-full" value={clauseCategory} onChange={(e) => setClauseCategory(e.target.value)} />
            </ContractField>
            <ContractField label={t("contracts.field.clauseType")} htmlFor="settings-clause-type">
              <select id="settings-clause-type" className="form-input w-full" value={clauseType} onChange={(e) => setClauseType(e.target.value)}>
                <option value="optional">{t("contracts.clause.optional")}</option>
                <option value="mandatory_editable">{t("contracts.clause.mandatory_editable")}</option>
                <option value="mandatory_locked">{t("contracts.clause.mandatory_locked")}</option>
                <option value="conditional">{t("contracts.clause.conditional")}</option>
                <option value="donor_specific">{t("contracts.clause.donor_specific")}</option>
              </select>
            </ContractField>
            <ContractField label={t("contracts.field.body")} htmlFor="settings-clause-body" className="sm:col-span-2 lg:col-span-4">
              <textarea id="settings-clause-body" className="form-input w-full min-h-20" value={clauseBody} onChange={(e) => setClauseBody(e.target.value)} />
            </ContractField>
            <button type="button" className="btn-primary text-sm justify-self-start" onClick={addClause}>{t("contracts.settings.addClause")}</button>
          </div>
        )}
      </section>
    </div>
  );
}
