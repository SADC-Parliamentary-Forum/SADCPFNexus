"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { contractsApi, type ContractType, type CurrencyRecord, type ContractAuthorityRule, type ContractComplianceRequirement } from "@/lib/api";

export default function ContractSettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();

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

  const err = (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Action failed");

  const addType = () => {
    if (!typeName.trim()) return;
    contractsApi.createType({ name: typeName.trim(), counterparty_type: typeCounterparty, requires_legal_review: typeLegal })
      .then(() => { toast.success("Contract type added"); setTypeName(""); setTypeLegal(false); refreshTypes(); }).catch(err);
  };
  const toggleType = (t: ContractType) =>
    contractsApi.updateType(t.id, { is_active: !t.is_active }).then(() => { toast.success("Updated"); refreshTypes(); }).catch(err);
  const toggleTypeLegal = (t: ContractType) =>
    contractsApi.updateType(t.id, { requires_legal_review: !t.requires_legal_review }).then(() => { toast.success("Updated"); refreshTypes(); }).catch(err);

  const addCurrency = () => {
    if (!curCode.trim() || !curName.trim()) return;
    contractsApi.createCurrency({ code: curCode.trim(), name: curName.trim(), symbol: curSymbol.trim() || undefined })
      .then(() => { toast.success("Currency added"); setCurCode(""); setCurName(""); setCurSymbol(""); refreshCurrencies(); }).catch(err);
  };
  const makeDefault = (c: CurrencyRecord) =>
    contractsApi.updateCurrency(c.id, { is_default: true }).then(() => { toast.success("Default set"); refreshCurrencies(); }).catch(err);
  const toggleCurrency = (c: CurrencyRecord) =>
    contractsApi.updateCurrency(c.id, { is_active: !c.is_active }).then(() => { toast.success("Updated"); refreshCurrencies(); }).catch(err);

  const addRule = () => {
    if (!ruleName.trim() || !ruleRole.trim()) return;
    contractsApi.createAuthorityRule({
      name: ruleName.trim(), action: ruleAction, authorised_role: ruleRole.trim(),
      alternate_role: ruleAltRole.trim() || undefined, amount_floor: ruleFloor ? Number(ruleFloor) : 0,
      amount_ceiling: ruleCeiling ? Number(ruleCeiling) : undefined, policy_source: rulePolicy.trim() || undefined,
    }).then(() => {
      toast.success("Authority rule added");
      setRuleName(""); setRuleFloor(""); setRuleCeiling(""); setRuleRole(""); setRuleAltRole(""); setRulePolicy("");
      refreshRules();
    }).catch(err);
  };
  const toggleRule = (r: ContractAuthorityRule) =>
    contractsApi.updateAuthorityRule(r.id, { is_active: !r.is_active }).then(() => { toast.success("Updated"); refreshRules(); }).catch(err);

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
      toast.success("Compliance requirement added");
      setReqCode(""); setReqName(""); setReqExpiry(false); setReqBlockAct(false); setReqBlockPay(false);
      refreshCompliance();
    }).catch(err);
  };
  const toggleRequirement = (r: ContractComplianceRequirement) =>
    contractsApi.updateComplianceRequirement(r.id, { is_active: !r.is_active }).then(() => { toast.success("Updated"); refreshCompliance(); }).catch(err);

  return (
    <div className="space-y-6 max-w-4xl">
      <ModulePageHeader
        title="Contract Settings"
        subtitle="Manage contract types and the central currency reference"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Contracts", href: "/contracts" }, { label: "Settings" }]} />}
      />

      {/* Contract types */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100"><h2 className="text-sm font-semibold text-neutral-800">Contract types</h2></div>
        <table className="data-table">
          <thead><tr><th>Name</th><th>Counterparty</th><th>Legal review</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id}>
                <td className="text-sm font-medium text-neutral-800">{t.name}</td>
                <td className="text-xs capitalize text-neutral-500">{t.counterparty_type}</td>
                <td className="text-sm">
                  <button className="text-primary text-xs underline" onClick={() => toggleTypeLegal(t)}>{t.requires_legal_review ? "Required" : "Not required"}</button>
                </td>
                <td className="text-sm">{t.is_active ? "Yes" : "No"}</td>
                <td className="text-right"><button className="btn-secondary text-xs py-0.5" onClick={() => toggleType(t)}>{t.is_active ? "Deactivate" : "Activate"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-end gap-2">
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">New type name</label><input className="form-input" value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="e.g. Translation Services Agreement" /></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Counterparty</label>
            <select className="form-input" value={typeCounterparty} onChange={(e) => setTypeCounterparty(e.target.value)}>
              <option value="individual">Individual</option><option value="organisation">Organisation</option><option value="either">Either</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-600 pb-2"><input type="checkbox" checked={typeLegal} onChange={(e) => setTypeLegal(e.target.checked)} /> Requires legal review</label>
          <button className="btn-primary text-sm" onClick={addType}>Add type</button>
        </div>
      </div>

      {/* Currencies */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100"><h2 className="text-sm font-semibold text-neutral-800">Currencies</h2></div>
        <table className="data-table">
          <thead><tr><th>Code</th><th>Name</th><th>Symbol</th><th>Default</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {currencies.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-sm">{c.code}</td>
                <td className="text-sm text-neutral-800">{c.name}</td>
                <td className="text-sm text-neutral-600">{c.symbol ?? "—"}</td>
                <td className="text-sm">{c.is_default ? <span className="badge badge-success">Default</span> : <button className="text-primary text-xs underline" onClick={() => makeDefault(c)}>Set default</button>}</td>
                <td className="text-sm">{c.is_active ? "Yes" : "No"}</td>
                <td className="text-right"><button className="btn-secondary text-xs py-0.5" onClick={() => toggleCurrency(c)}>{c.is_active ? "Deactivate" : "Activate"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-end gap-2">
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Code</label><input className="form-input w-24 uppercase" value={curCode} maxLength={8} onChange={(e) => setCurCode(e.target.value.toUpperCase())} placeholder="KES" /></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Name</label><input className="form-input" value={curName} onChange={(e) => setCurName(e.target.value)} placeholder="Kenyan Shilling" /></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Symbol</label><input className="form-input w-24" value={curSymbol} onChange={(e) => setCurSymbol(e.target.value)} placeholder="KSh" /></div>
          <button className="btn-primary text-sm" onClick={addCurrency}>Add currency</button>
        </div>
      </div>

      {/* Authority Matrix */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">Authority matrix</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Value-banded approval / signing authority, evaluated when the action occurs. Confirm the operative matrix with SADC PF before go-live (PRD §41, §134).</p>
        </div>
        <table className="data-table">
          <thead><tr><th>Rule</th><th>Action</th><th>Value band</th><th>Authorised role</th><th>Alternate</th><th>Policy</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {authorityRules.length === 0 ? (
              <tr><td colSpan={8} className="text-sm text-neutral-400 p-4">No authority rules configured — approvals fall back to role permissions.</td></tr>
            ) : authorityRules.map((r) => (
              <tr key={r.id}>
                <td className="text-sm font-medium text-neutral-800">{r.name}</td>
                <td className="text-xs capitalize text-neutral-500">{r.action}</td>
                <td className="text-sm text-neutral-600">{band(r)} {r.currency ?? ""}</td>
                <td className="text-sm text-neutral-800">{r.authorised_role}</td>
                <td className="text-xs text-neutral-500">{r.alternate_role ?? "—"}</td>
                <td className="text-xs text-neutral-500">{r.policy_source ?? "—"}</td>
                <td className="text-sm">{r.is_active ? "Yes" : "No"}</td>
                <td className="text-right"><button className="btn-secondary text-xs py-0.5" onClick={() => toggleRule(r)}>{r.is_active ? "Deactivate" : "Activate"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-end gap-2">
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Rule name</label><input className="form-input" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. SG signs above 100k" /></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Action</label>
            <select className="form-input w-28" value={ruleAction} onChange={(e) => setRuleAction(e.target.value as "approve" | "sign")}>
              <option value="approve">Approve</option><option value="sign">Sign</option>
            </select>
          </div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Floor</label><input className="form-input w-28" type="number" value={ruleFloor} onChange={(e) => setRuleFloor(e.target.value)} placeholder="0" /></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Ceiling</label><input className="form-input w-28" type="number" value={ruleCeiling} onChange={(e) => setRuleCeiling(e.target.value)} placeholder="none" /></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Authorised role</label><input className="form-input" value={ruleRole} onChange={(e) => setRuleRole(e.target.value)} placeholder="Secretary General" /></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Alternate role</label><input className="form-input" value={ruleAltRole} onChange={(e) => setRuleAltRole(e.target.value)} placeholder="(optional)" /></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Policy ref</label><input className="form-input w-36" value={rulePolicy} onChange={(e) => setRulePolicy(e.target.value)} placeholder="(optional)" /></div>
          <button className="btn-primary text-sm" onClick={addRule}>Add rule</button>
        </div>
      </div>

      {/* Compliance requirements */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">Compliance requirements</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Documents required per contract type. Blocking requirements surface in readiness and can block activation and/or payment (PRD §81-82).</p>
        </div>
        <table className="data-table">
          <thead><tr><th>Code</th><th>Name</th><th>Expiry tracked</th><th>Blocks activation</th><th>Blocks payment</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {complianceReqs.length === 0 ? (
              <tr><td colSpan={7} className="text-sm text-neutral-400 p-4">No compliance requirements configured.</td></tr>
            ) : complianceReqs.map((r) => (
              <tr key={r.id}>
                <td className="text-sm font-mono">{r.code}</td>
                <td className="text-sm text-neutral-800">{r.name}</td>
                <td className="text-sm">{r.requires_expiry ? "Yes" : "No"}</td>
                <td className="text-sm">{r.blocks_activation ? "Yes" : "No"}</td>
                <td className="text-sm">{r.blocks_payment ? "Yes" : "No"}</td>
                <td className="text-sm">{r.is_active ? "Yes" : "No"}</td>
                <td className="text-right"><button className="btn-secondary text-xs py-0.5" onClick={() => toggleRequirement(r)}>{r.is_active ? "Deactivate" : "Activate"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-end gap-2">
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Code</label><input className="form-input w-40" value={reqCode} onChange={(e) => setReqCode(e.target.value)} placeholder="tax_clearance" /></div>
          <div className="space-y-1"><label className="text-xs font-semibold text-neutral-600">Name</label><input className="form-input" value={reqName} onChange={(e) => setReqName(e.target.value)} placeholder="Tax clearance certificate" /></div>
          <label className="flex items-center gap-2 text-sm text-neutral-600 pb-2"><input type="checkbox" checked={reqExpiry} onChange={(e) => setReqExpiry(e.target.checked)} /> Tracks expiry</label>
          <label className="flex items-center gap-2 text-sm text-neutral-600 pb-2"><input type="checkbox" checked={reqBlockAct} onChange={(e) => setReqBlockAct(e.target.checked)} /> Blocks activation</label>
          <label className="flex items-center gap-2 text-sm text-neutral-600 pb-2"><input type="checkbox" checked={reqBlockPay} onChange={(e) => setReqBlockPay(e.target.checked)} /> Blocks payment</label>
          <button className="btn-primary text-sm" onClick={addRequirement}>Add requirement</button>
        </div>
      </div>
    </div>
  );
}
