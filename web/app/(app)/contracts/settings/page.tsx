"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { ErrorBanner, TableEmpty } from "@/components/ui/EmptyState";
import { Checkbox } from "@/components/ui/Checkbox";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { apiErrorMessage } from "@/lib/apiError";
import {
  contractsApi,
  type ContractType,
  type CurrencyRecord,
  type ContractAuthorityRule,
  type ContractComplianceRequirement,
} from "@/lib/api";

type SettingsTab = "types" | "currencies" | "authority" | "compliance";

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: "types", label: "Types", icon: "category" },
  { id: "currencies", label: "Currencies", icon: "payments" },
  { id: "authority", label: "Authority", icon: "gavel" },
  { id: "compliance", label: "Compliance", icon: "verified_user" },
];

function StatusBadge({ on }: { on: boolean }) {
  return (
    <span className={`badge ${on ? "badge-success" : "badge-muted"}`}>
      {on ? "Active" : "Inactive"}
    </span>
  );
}

function FlagBadge({ on, onLabel = "Yes", offLabel = "No" }: { on: boolean; onLabel?: string; offLabel?: string }) {
  return (
    <span className={`badge ${on ? "badge-success" : "badge-muted"}`}>
      {on ? onLabel : offLabel}
    </span>
  );
}

function SettingsTable({
  caption,
  columns,
  loading,
  error,
  onRetry,
  empty,
  children,
}: {
  caption: string;
  columns: number;
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
  empty: { icon: string; title: string; description: string };
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 max-h-[32rem] overflow-auto rounded-lg border border-neutral-200">
      {error ? (
        <div className="p-3">
          <ErrorBanner message={apiErrorMessage(error, "Could not load this list.")} onRetry={onRetry} />
        </div>
      ) : null}
      <table className="data-table min-w-full">
        <caption className="sr-only">{caption}</caption>
        {loading ? (
          <tbody>
            <tr>
              <td colSpan={columns} className="p-5 text-sm text-neutral-500">
                Loading {caption.toLowerCase()}…
              </td>
            </tr>
          </tbody>
        ) : children ? (
          children
        ) : error ? null : (
          <tbody>
            <TableEmpty colSpan={columns} icon={empty.icon} title={empty.title} description={empty.description} />
          </tbody>
        )}
      </table>
    </div>
  );
}

export default function ContractSettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();
  const [tab, setTab] = useState<SettingsTab>("types");
  const tabRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});

  const typesQuery = useQuery({
    queryKey: ["contract-types-admin"],
    queryFn: () => contractsApi.types().then((r) => r.data.data),
  });
  const currenciesQuery = useQuery({
    queryKey: ["contract-currencies-admin"],
    queryFn: () => contractsApi.currencies(true).then((r) => r.data.data),
  });
  const rulesQuery = useQuery({
    queryKey: ["contract-authority-rules"],
    queryFn: () => contractsApi.authorityRules().then((r) => r.data.data),
  });
  const complianceQuery = useQuery({
    queryKey: ["contract-compliance-requirements"],
    queryFn: () => contractsApi.complianceRequirements().then((r) => r.data.data),
  });

  const types = typesQuery.data ?? [];
  const currencies = currenciesQuery.data ?? [];
  const authorityRules = rulesQuery.data ?? [];
  const complianceReqs = complianceQuery.data ?? [];

  const counts: Record<SettingsTab, number> = {
    types: types.length,
    currencies: currencies.length,
    authority: authorityRules.length,
    compliance: complianceReqs.length,
  };

  const [typeName, setTypeName] = useState("");
  const [typeCounterparty, setTypeCounterparty] = useState("individual");
  const [typeLegal, setTypeLegal] = useState(false);
  const [savingType, setSavingType] = useState(false);

  const [curCode, setCurCode] = useState("");
  const [curName, setCurName] = useState("");
  const [curSymbol, setCurSymbol] = useState("");
  const [savingCurrency, setSavingCurrency] = useState(false);

  const [ruleName, setRuleName] = useState("");
  const [ruleAction, setRuleAction] = useState<"approve" | "sign">("approve");
  const [ruleFloor, setRuleFloor] = useState("");
  const [ruleCeiling, setRuleCeiling] = useState("");
  const [ruleRole, setRuleRole] = useState("");
  const [ruleAltRole, setRuleAltRole] = useState("");
  const [rulePolicy, setRulePolicy] = useState("");
  const [savingRule, setSavingRule] = useState(false);

  const [reqCode, setReqCode] = useState("");
  const [reqName, setReqName] = useState("");
  const [reqExpiry, setReqExpiry] = useState(false);
  const [reqBlockAct, setReqBlockAct] = useState(false);
  const [reqBlockPay, setReqBlockPay] = useState(false);
  const [savingReq, setSavingReq] = useState(false);

  const refreshTypes = () => qc.invalidateQueries({ queryKey: ["contract-types-admin"] });
  const refreshCurrencies = () => qc.invalidateQueries({ queryKey: ["contract-currencies-admin"] });
  const refreshRules = () => qc.invalidateQueries({ queryKey: ["contract-authority-rules"] });
  const refreshCompliance = () => qc.invalidateQueries({ queryKey: ["contract-compliance-requirements"] });

  const fail = (e: unknown, fallback: string) => toast.error(apiErrorMessage(e, fallback));

  const selectTab = (id: SettingsTab) => {
    setTab(id);
    requestAnimationFrame(() => tabRefs.current[id]?.focus());
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, current: SettingsTab) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const index = TABS.findIndex((item) => item.id === current);
    const nextIndex =
      e.key === "Home" ? 0
        : e.key === "End" ? TABS.length - 1
          : e.key === "ArrowRight" ? (index + 1) % TABS.length
            : (index - 1 + TABS.length) % TABS.length;
    selectTab(TABS[nextIndex].id);
  };

  const addType = (e: FormEvent) => {
    e.preventDefault();
    if (!typeName.trim() || savingType) return;
    setSavingType(true);
    contractsApi.createType({ name: typeName.trim(), counterparty_type: typeCounterparty, requires_legal_review: typeLegal })
      .then(() => { toast.success("Contract type added"); setTypeName(""); setTypeLegal(false); refreshTypes(); })
      .catch((err) => fail(err, "Could not add contract type."))
      .finally(() => setSavingType(false));
  };
  const toggleType = async (t: ContractType) => {
    if (t.is_active) {
      const ok = await confirm({
        title: "Deactivate contract type",
        message: `${t.name} will no longer be available when creating contracts.`,
        confirmText: "Deactivate",
        variant: "danger",
      });
      if (!ok) return;
    }
    contractsApi.updateType(t.id, { is_active: !t.is_active })
      .then(() => { toast.success(t.is_active ? "Type deactivated" : "Type activated"); refreshTypes(); })
      .catch((err) => fail(err, "Could not update contract type."));
  };
  const toggleTypeLegal = (t: ContractType) =>
    contractsApi.updateType(t.id, { requires_legal_review: !t.requires_legal_review })
      .then(() => { toast.success("Legal review updated"); refreshTypes(); })
      .catch((err) => fail(err, "Could not update legal review."));

  const addCurrency = (e: FormEvent) => {
    e.preventDefault();
    if (!curCode.trim() || !curName.trim() || savingCurrency) return;
    setSavingCurrency(true);
    contractsApi.createCurrency({ code: curCode.trim(), name: curName.trim(), symbol: curSymbol.trim() || undefined })
      .then(() => { toast.success("Currency added"); setCurCode(""); setCurName(""); setCurSymbol(""); refreshCurrencies(); })
      .catch((err) => fail(err, "Could not add currency."))
      .finally(() => setSavingCurrency(false));
  };
  const makeDefault = (c: CurrencyRecord) =>
    contractsApi.updateCurrency(c.id, { is_default: true })
      .then(() => { toast.success(`${c.code} is now the default currency`); refreshCurrencies(); })
      .catch((err) => fail(err, "Could not set default currency."));
  const toggleCurrency = async (c: CurrencyRecord) => {
    if (c.is_active) {
      const ok = await confirm({
        title: "Deactivate currency",
        message: `${c.code} will be hidden from new contracts.`,
        confirmText: "Deactivate",
        variant: "danger",
      });
      if (!ok) return;
    }
    contractsApi.updateCurrency(c.id, { is_active: !c.is_active })
      .then(() => { toast.success(c.is_active ? "Currency deactivated" : "Currency activated"); refreshCurrencies(); })
      .catch((err) => fail(err, "Could not update currency."));
  };

  const addRule = (e: FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !ruleRole.trim() || savingRule) return;
    setSavingRule(true);
    contractsApi.createAuthorityRule({
      name: ruleName.trim(),
      action: ruleAction,
      authorised_role: ruleRole.trim(),
      alternate_role: ruleAltRole.trim() || undefined,
      amount_floor: ruleFloor ? Number(ruleFloor) : 0,
      amount_ceiling: ruleCeiling ? Number(ruleCeiling) : undefined,
      policy_source: rulePolicy.trim() || undefined,
    }).then(() => {
      toast.success("Authority rule added");
      setRuleName(""); setRuleFloor(""); setRuleCeiling(""); setRuleRole(""); setRuleAltRole(""); setRulePolicy("");
      refreshRules();
    }).catch((err) => fail(err, "Could not add authority rule."))
      .finally(() => setSavingRule(false));
  };
  const toggleRule = async (r: ContractAuthorityRule) => {
    if (r.is_active) {
      const ok = await confirm({
        title: "Deactivate authority rule",
        message: `${r.name} will no longer apply when staff approve or sign.`,
        confirmText: "Deactivate",
        variant: "danger",
      });
      if (!ok) return;
    }
    contractsApi.updateAuthorityRule(r.id, { is_active: !r.is_active })
      .then(() => { toast.success(r.is_active ? "Rule deactivated" : "Rule activated"); refreshRules(); })
      .catch((err) => fail(err, "Could not update authority rule."));
  };

  const band = (r: ContractAuthorityRule) => {
    const floor = Number(r.amount_floor).toLocaleString();
    return r.amount_ceiling != null ? `${floor} – ${Number(r.amount_ceiling).toLocaleString()}` : `≥ ${floor}`;
  };

  const addRequirement = (e: FormEvent) => {
    e.preventDefault();
    if (!reqCode.trim() || !reqName.trim() || savingReq) return;
    setSavingReq(true);
    contractsApi.createComplianceRequirement({
      code: reqCode.trim(),
      name: reqName.trim(),
      requires_expiry: reqExpiry,
      blocks_activation: reqBlockAct,
      blocks_payment: reqBlockPay,
    }).then(() => {
      toast.success("Compliance requirement added");
      setReqCode(""); setReqName(""); setReqExpiry(false); setReqBlockAct(false); setReqBlockPay(false);
      refreshCompliance();
    }).catch((err) => fail(err, "Could not add compliance requirement."))
      .finally(() => setSavingReq(false));
  };
  const toggleRequirement = async (r: ContractComplianceRequirement) => {
    if (r.is_active) {
      const ok = await confirm({
        title: "Deactivate requirement",
        message: `${r.name} will no longer block readiness checks.`,
        confirmText: "Deactivate",
        variant: "danger",
      });
      if (!ok) return;
    }
    contractsApi.updateComplianceRequirement(r.id, { is_active: !r.is_active })
      .then(() => { toast.success(r.is_active ? "Requirement deactivated" : "Requirement activated"); refreshCompliance(); })
      .catch((err) => fail(err, "Could not update requirement."));
  };

  return (
    <div className="w-full min-w-0 space-y-6" data-testid="contract-settings">
      <ModulePageHeader
        title="Contract Settings"
        subtitle="Configure the types, currencies, signing authority, and documents used across the contract register"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Contracts", href: "/contracts" }, { label: "Settings" }]} />}
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Contract settings sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`cs-tab-${item.id}`}
            aria-controls={`cs-panel-${item.id}`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            ref={(el) => { tabRefs.current[item.id] = el; }}
            className={`filter-tab inline-flex items-center gap-1.5 ${tab === item.id ? "active" : ""}`}
            onClick={() => selectTab(item.id)}
            onKeyDown={(e) => onTabKey(e, item.id)}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden>{item.icon}</span>
            {item.label}
            <span className="tabular-nums text-[11px] text-neutral-400">{counts[item.id]}</span>
          </button>
        ))}
      </div>

      {tab === "types" && (
        <div role="tabpanel" id="cs-panel-types" aria-labelledby="cs-tab-types">
          <FormSection
            title="Contract types"
            description="Classify agreements and decide whether legal review is required before signature."
            icon="category"
          >
            <form onSubmit={addType} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="New type name" htmlFor="cs-type-name" required>
                <input id="cs-type-name" className="form-input" value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="e.g. Translation Services Agreement" />
              </FormField>
              <FormField label="Counterparty" htmlFor="cs-type-counterparty">
                <select id="cs-type-counterparty" className="form-input" value={typeCounterparty} onChange={(e) => setTypeCounterparty(e.target.value)}>
                  <option value="individual">Individual</option>
                  <option value="organisation">Organisation</option>
                  <option value="either">Either</option>
                </select>
              </FormField>
              <div className="flex items-end pb-2">
                <Checkbox id="cs-type-legal" checked={typeLegal} onChange={setTypeLegal} label="Requires legal review" />
              </div>
              <div className="flex items-end">
                <button type="submit" className="btn-primary text-sm w-full sm:w-auto" disabled={!typeName.trim() || savingType}>
                  {savingType ? "Adding…" : "Add type"}
                </button>
              </div>
            </form>
            <SettingsTable
              caption="Contract types"
              columns={5}
              loading={typesQuery.isLoading}
              error={typesQuery.error}
              onRetry={() => void typesQuery.refetch()}
              empty={{ icon: "category", title: "No contract types", description: "Add a type such as a service agreement or framework contract." }}
            >
              {types.length > 0 ? (
                <>
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr>
                      <th>Name</th>
                      <th>Counterparty</th>
                      <th>Legal review</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {types.map((t) => (
                      <tr key={t.id} className={t.is_active ? undefined : "opacity-60"}>
                        <td className="text-sm font-medium text-neutral-800">{t.name}</td>
                        <td className="text-xs capitalize text-neutral-500">{t.counterparty_type}</td>
                        <td>
                          <button type="button" className="btn-secondary text-xs py-0.5" onClick={() => toggleTypeLegal(t)}>
                            {t.requires_legal_review ? "Required" : "Not required"}
                          </button>
                        </td>
                        <td><StatusBadge on={t.is_active} /></td>
                        <td className="text-right">
                          <button type="button" className="btn-secondary text-xs py-0.5" onClick={() => void toggleType(t)}>
                            {t.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : null}
            </SettingsTable>
          </FormSection>
        </div>
      )}

      {tab === "currencies" && (
        <div role="tabpanel" id="cs-panel-currencies" aria-labelledby="cs-tab-currencies">
          <FormSection
            title="Currencies"
            description="Maintain the reference list used when recording contract values."
            icon="payments"
          >
            <form onSubmit={addCurrency} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Code" htmlFor="cs-currency-code" required>
                <input id="cs-currency-code" className="form-input uppercase" value={curCode} maxLength={8} onChange={(e) => setCurCode(e.target.value.toUpperCase())} placeholder="KES" />
              </FormField>
              <FormField label="Name" htmlFor="cs-currency-name" required>
                <input id="cs-currency-name" className="form-input" value={curName} onChange={(e) => setCurName(e.target.value)} placeholder="Kenyan Shilling" />
              </FormField>
              <FormField label="Symbol" htmlFor="cs-currency-symbol">
                <input id="cs-currency-symbol" className="form-input" value={curSymbol} onChange={(e) => setCurSymbol(e.target.value)} placeholder="KSh" />
              </FormField>
              <div className="flex items-end">
                <button type="submit" className="btn-primary text-sm w-full sm:w-auto" disabled={!curCode.trim() || !curName.trim() || savingCurrency}>
                  {savingCurrency ? "Adding…" : "Add currency"}
                </button>
              </div>
            </form>
            <SettingsTable
              caption="Currencies"
              columns={6}
              loading={currenciesQuery.isLoading}
              error={currenciesQuery.error}
              onRetry={() => void currenciesQuery.refetch()}
              empty={{ icon: "payments", title: "No currencies", description: "Add NAD, USD or another currency used in contracts." }}
            >
              {currencies.length > 0 ? (
                <>
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Symbol</th>
                      <th>Default</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currencies.map((c) => (
                      <tr key={c.id} className={c.is_active ? undefined : "opacity-60"}>
                        <td className="font-mono text-sm">{c.code}</td>
                        <td className="text-sm text-neutral-800">{c.name}</td>
                        <td className="text-sm text-neutral-600">{c.symbol ?? "—"}</td>
                        <td>
                          {c.is_default ? (
                            <span className="badge badge-success">Default</span>
                          ) : (
                            <button type="button" className="btn-secondary text-xs py-0.5" onClick={() => makeDefault(c)}>
                              Set default
                            </button>
                          )}
                        </td>
                        <td><StatusBadge on={c.is_active} /></td>
                        <td className="text-right">
                          <button type="button" className="btn-secondary text-xs py-0.5" onClick={() => void toggleCurrency(c)}>
                            {c.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : null}
            </SettingsTable>
          </FormSection>
        </div>
      )}

      {tab === "authority" && (
        <div role="tabpanel" id="cs-panel-authority" aria-labelledby="cs-tab-authority">
          <FormSection
            title="Authority matrix"
            description="Value bands that decide who may approve or sign. If no rule matches, the action falls back to role permissions."
            icon="gavel"
          >
            <form onSubmit={addRule} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Rule name" htmlFor="cs-rule-name" required>
                <input id="cs-rule-name" className="form-input" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. SG signs above 100k" />
              </FormField>
              <FormField label="Action" htmlFor="cs-rule-action">
                <select id="cs-rule-action" className="form-input" value={ruleAction} onChange={(e) => setRuleAction(e.target.value as "approve" | "sign")}>
                  <option value="approve">Approve</option>
                  <option value="sign">Sign</option>
                </select>
              </FormField>
              <FormField label="Floor" htmlFor="cs-rule-floor">
                <input id="cs-rule-floor" className="form-input" type="number" min={0} value={ruleFloor} onChange={(e) => setRuleFloor(e.target.value)} placeholder="0" />
              </FormField>
              <FormField label="Ceiling" htmlFor="cs-rule-ceiling">
                <input id="cs-rule-ceiling" className="form-input" type="number" min={0} value={ruleCeiling} onChange={(e) => setRuleCeiling(e.target.value)} placeholder="none" />
              </FormField>
              <FormField label="Authorised role" htmlFor="cs-rule-role" required>
                <input id="cs-rule-role" className="form-input" value={ruleRole} onChange={(e) => setRuleRole(e.target.value)} placeholder="Secretary General" />
              </FormField>
              <FormField label="Alternate role" htmlFor="cs-rule-alt">
                <input id="cs-rule-alt" className="form-input" value={ruleAltRole} onChange={(e) => setRuleAltRole(e.target.value)} placeholder="Optional" />
              </FormField>
              <FormField label="Policy ref" htmlFor="cs-rule-policy">
                <input id="cs-rule-policy" className="form-input" value={rulePolicy} onChange={(e) => setRulePolicy(e.target.value)} placeholder="Optional" />
              </FormField>
              <div className="flex items-end">
                <button type="submit" className="btn-primary text-sm w-full sm:w-auto" disabled={!ruleName.trim() || !ruleRole.trim() || savingRule}>
                  {savingRule ? "Adding…" : "Add rule"}
                </button>
              </div>
            </form>
            <SettingsTable
              caption="Authority rules"
              columns={8}
              loading={rulesQuery.isLoading}
              error={rulesQuery.error}
              onRetry={() => void rulesQuery.refetch()}
              empty={{ icon: "gavel", title: "No authority rules", description: "Approvals will use role permissions until you add a value band." }}
            >
              {authorityRules.length > 0 ? (
                <>
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr>
                      <th>Rule</th>
                      <th>Action</th>
                      <th>Value band</th>
                      <th>Authorised role</th>
                      <th>Alternate</th>
                      <th>Policy</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {authorityRules.map((r) => (
                      <tr key={r.id} className={r.is_active ? undefined : "opacity-60"}>
                        <td className="text-sm font-medium text-neutral-800">{r.name}</td>
                        <td className="text-xs capitalize text-neutral-500">{r.action}</td>
                        <td className="whitespace-nowrap text-sm text-neutral-600">{band(r)} {r.currency ?? ""}</td>
                        <td className="text-sm text-neutral-800">{r.authorised_role}</td>
                        <td className="text-xs text-neutral-500">{r.alternate_role ?? "—"}</td>
                        <td className="max-w-[12rem] truncate text-xs text-neutral-500" title={r.policy_source ?? undefined}>{r.policy_source ?? "—"}</td>
                        <td><StatusBadge on={r.is_active} /></td>
                        <td className="text-right">
                          <button type="button" className="btn-secondary text-xs py-0.5" onClick={() => void toggleRule(r)}>
                            {r.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : null}
            </SettingsTable>
          </FormSection>
        </div>
      )}

      {tab === "compliance" && (
        <div role="tabpanel" id="cs-panel-compliance" aria-labelledby="cs-tab-compliance">
          <FormSection
            title="Compliance requirements"
            description="Documents that must be on file. Blocking items appear in readiness and can stop activation or payment."
            icon="verified_user"
          >
            <form onSubmit={addRequirement} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Code" htmlFor="cs-req-code" required>
                <input id="cs-req-code" className="form-input" value={reqCode} onChange={(e) => setReqCode(e.target.value)} placeholder="tax_clearance" />
              </FormField>
              <FormField label="Name" htmlFor="cs-req-name" required>
                <input id="cs-req-name" className="form-input" value={reqName} onChange={(e) => setReqName(e.target.value)} placeholder="Tax clearance certificate" />
              </FormField>
              <div className="flex items-end">
                <button type="submit" className="btn-primary text-sm w-full sm:w-auto" disabled={!reqCode.trim() || !reqName.trim() || savingReq}>
                  {savingReq ? "Adding…" : "Add requirement"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:col-span-2 lg:col-span-3">
                <Checkbox id="cs-req-expiry" checked={reqExpiry} onChange={setReqExpiry} label="Tracks expiry" />
                <Checkbox id="cs-req-block-act" checked={reqBlockAct} onChange={setReqBlockAct} label="Blocks activation" />
                <Checkbox id="cs-req-block-pay" checked={reqBlockPay} onChange={setReqBlockPay} label="Blocks payment" />
              </div>
            </form>
            <SettingsTable
              caption="Compliance requirements"
              columns={7}
              loading={complianceQuery.isLoading}
              error={complianceQuery.error}
              onRetry={() => void complianceQuery.refetch()}
              empty={{ icon: "verified_user", title: "No compliance requirements", description: "Add items such as tax clearance if they must be on file before a contract is used." }}
            >
              {complianceReqs.length > 0 ? (
                <>
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Expiry</th>
                      <th>Blocks activation</th>
                      <th>Blocks payment</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complianceReqs.map((r) => (
                      <tr key={r.id} className={r.is_active ? undefined : "opacity-60"}>
                        <td className="font-mono text-sm">{r.code}</td>
                        <td className="text-sm text-neutral-800">{r.name}</td>
                        <td><FlagBadge on={r.requires_expiry} /></td>
                        <td><FlagBadge on={r.blocks_activation} /></td>
                        <td><FlagBadge on={r.blocks_payment} /></td>
                        <td><StatusBadge on={r.is_active} /></td>
                        <td className="text-right">
                          <button type="button" className="btn-secondary text-xs py-0.5" onClick={() => void toggleRequirement(r)}>
                            {r.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : null}
            </SettingsTable>
          </FormSection>
        </div>
      )}
    </div>
  );
}
