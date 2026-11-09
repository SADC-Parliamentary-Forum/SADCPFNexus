"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmployeePicker } from "@/components/ui/EmployeePicker";
import { TableEmpty } from "@/components/ui/EmptyState";
import {
  contractsApi,
  type ContractAuthorityRule,
  type ContractAuthorityDelegation,
  type TenantUserOption,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function ContractAuthorityPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { t } = useI18n();

  const { data: types = [] } = useQuery({
    queryKey: ["contract-types-for-authority-page"],
    queryFn: () => contractsApi.types().then((r) => r.data.data),
  });
  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["contract-authority-rules-page"],
    queryFn: () => contractsApi.authorityRules().then((r) => r.data.data).catch(() => []),
  });
  const { data: delegations = [], isLoading: delegationsLoading } = useQuery({
    queryKey: ["contract-authority-delegations"],
    queryFn: () => contractsApi.authorityDelegations().then((r) => r.data.data).catch(() => []),
  });

  const refreshRules = () => qc.invalidateQueries({ queryKey: ["contract-authority-rules-page"] });
  const refreshDelegations = () => qc.invalidateQueries({ queryKey: ["contract-authority-delegations"] });

  const err = (e: unknown) =>
    toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.common.actionFailed"));

  const typeName = (id: number | null) => {
    if (id == null) return t("contracts.authority.allTypes");
    return types.find((ty) => ty.id === id)?.name ?? t("contracts.authority.typeNumber", { id });
  };

  const band = (r: ContractAuthorityRule) => {
    const floor = Number(r.amount_floor).toLocaleString();
    return r.amount_ceiling != null ? `${floor} – ${Number(r.amount_ceiling).toLocaleString()}` : `≥ ${floor}`;
  };

  // New rule form
  const [ruleName, setRuleName] = useState("");
  const [ruleAction, setRuleAction] = useState<"approve" | "sign">("approve");
  const [ruleTypeId, setRuleTypeId] = useState<string>("");
  const [ruleFloor, setRuleFloor] = useState("");
  const [ruleCeiling, setRuleCeiling] = useState("");
  const [ruleCurrency, setRuleCurrency] = useState("");
  const [ruleRole, setRuleRole] = useState("");
  const [ruleAltRole, setRuleAltRole] = useState("");
  const [rulePolicy, setRulePolicy] = useState("");

  const addRule = () => {
    if (!ruleName.trim() || !ruleRole.trim()) return;
    contractsApi
      .createAuthorityRule({
        name: ruleName.trim(),
        action: ruleAction,
        contract_type_id: ruleTypeId ? Number(ruleTypeId) : undefined,
        authorised_role: ruleRole.trim(),
        alternate_role: ruleAltRole.trim() || undefined,
        amount_floor: ruleFloor ? Number(ruleFloor) : 0,
        amount_ceiling: ruleCeiling ? Number(ruleCeiling) : undefined,
        currency: ruleCurrency.trim() || undefined,
        policy_source: rulePolicy.trim() || undefined,
      })
      .then(() => {
        toast.success(t("contracts.settings.ruleAdded"));
        setRuleName("");
        setRuleTypeId("");
        setRuleFloor("");
        setRuleCeiling("");
        setRuleCurrency("");
        setRuleRole("");
        setRuleAltRole("");
        setRulePolicy("");
        refreshRules();
      })
      .catch(err);
  };

  const toggleRule = (r: ContractAuthorityRule) =>
    contractsApi
      .updateAuthorityRule(r.id, { is_active: !r.is_active })
      .then(() => {
        toast.success(t("contracts.settings.updated"));
        refreshRules();
      })
      .catch(err);

  // New delegation form
  const [delDelegatorRole, setDelDelegatorRole] = useState("");
  const [delDelegateUser, setDelDelegateUser] = useState<TenantUserOption | null>(null);
  const [delAction, setDelAction] = useState<string>("");
  const [delReason, setDelReason] = useState("");
  const [delFrom, setDelFrom] = useState("");
  const [delUntil, setDelUntil] = useState("");

  const addDelegation = () => {
    if (!delDelegatorRole.trim() || !delDelegateUser || !delFrom.trim() || !delUntil.trim()) return;
    if (delUntil <= delFrom) {
      toast.error(t("contracts.authority.expiryAfterEffective"));
      return;
    }
    contractsApi
      .createAuthorityDelegation({
        delegator_role: delDelegatorRole.trim(),
        delegate_user_id: delDelegateUser.id,
        action: delAction || undefined,
        reason: delReason.trim() || undefined,
        effective_from: delFrom,
        expires_at: delUntil,
      })
      .then(() => {
        toast.success(t("contracts.authority.delegationRecorded"));
        setDelDelegatorRole("");
        setDelDelegateUser(null);
        setDelAction("");
        setDelReason("");
        setDelFrom("");
        setDelUntil("");
        refreshDelegations();
      })
      .catch(err);
  };

  const revokeDelegation = async (d: ContractAuthorityDelegation) => {
    const ok = await confirm({
      title: "contracts.authority.revokeTitle",
      message: "contracts.authority.revokeMessage",
      variant: "danger",
    });
    if (!ok) return;
    contractsApi
      .revokeAuthorityDelegation(d.id)
      .then(() => {
        toast.success(t("contracts.authority.delegationRevoked"));
        refreshDelegations();
      })
      .catch(err);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <ModulePageHeader
        title="contracts.authority.title"
        subtitle="contracts.authority.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.contracts", href: "/contracts" }, { label: "contracts.authority.crumb" }]} />}
      />

      {/* Authority Matrix */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.settings.authorityMatrix")}</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t("contracts.authority.matrixHint")}
          </p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("contracts.settings.rule")}</th>
              <th>{t("contracts.settings.action")}</th>
              <th>{t("contracts.settings.valueBand")}</th>
              <th>{t("contracts.field.contractType")}</th>
              <th>{t("contracts.settings.authorisedRole")}</th>
              <th>{t("contracts.settings.alternate")}</th>
              <th>{t("contracts.status.active")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rulesLoading ? (
              <TableEmpty colSpan={8} icon="hourglass_empty" title="contracts.authority.loadingRules" />
            ) : rules.length === 0 ? (
              <TableEmpty
                colSpan={8}
                icon="rule"
                title="contracts.authority.noRules"
                description="contracts.authority.noRulesHint"
              />
            ) : (
              rules.map((r) => (
                <tr key={r.id}>
                  <td className="text-sm font-medium text-neutral-800">{r.name}</td>
                  <td className="text-xs capitalize text-neutral-500">{r.action === "approve" || r.action === "sign" ? t(`contracts.settings.ruleAction.${r.action}`) : r.action}</td>
                  <td className="text-sm text-neutral-600">
                    {band(r)} {r.currency ?? ""}
                  </td>
                  <td className="text-xs text-neutral-500">{typeName(r.contract_type_id)}</td>
                  <td className="text-sm text-neutral-800">{r.authorised_role}</td>
                  <td className="text-xs text-neutral-500">{r.alternate_role ?? "—"}</td>
                  <td className="text-sm">{r.is_active ? t("contracts.common.yes") : t("contracts.common.no")}</td>
                  <td className="text-right">
                    <button className="btn-secondary text-xs py-0.5" onClick={() => toggleRule(r)}>
                      {r.is_active ? t("contracts.settings.deactivate") : t("contracts.templates.activate")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="contracts-authority-rule-name" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.ruleName")}</label>
            <input id="contracts-authority-rule-name" className="form-input" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder={t("contracts.settings.rulePlaceholder")} />
          </div>
          <div className="space-y-1">
            <label htmlFor="contracts-authority-rule-action" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.action")}</label>
            <select id="contracts-authority-rule-action" className="form-input w-28" value={ruleAction} onChange={(e) => setRuleAction(e.target.value as "approve" | "sign")}>
              <option value="approve">{t("contracts.settings.ruleAction.approve")}</option>
              <option value="sign">{t("contracts.settings.ruleAction.sign")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="contracts-authority-rule-type" className="text-xs font-semibold text-neutral-600">{t("contracts.field.contractType")}</label>
            <select id="contracts-authority-rule-type" className="form-input" value={ruleTypeId} onChange={(e) => setRuleTypeId(e.target.value)}>
              <option value="">{t("contracts.authority.allTypes")}</option>
              {types.map((ty) => (
                <option key={ty.id} value={ty.id}>
                  {ty.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="contracts-authority-rule-floor" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.floor")}</label>
            <input id="contracts-authority-rule-floor" className="form-input w-28" type="number" value={ruleFloor} onChange={(e) => setRuleFloor(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1">
            <label htmlFor="contracts-authority-rule-ceiling" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.ceiling")}</label>
            <input id="contracts-authority-rule-ceiling" className="form-input w-28" type="number" value={ruleCeiling} onChange={(e) => setRuleCeiling(e.target.value)} placeholder={t("contracts.settings.ceilingPlaceholder")} />
          </div>
          <div className="space-y-1">
            <label htmlFor="contracts-authority-rule-currency" className="text-xs font-semibold text-neutral-600">{t("contracts.field.currency")}</label>
            <input id="contracts-authority-rule-currency"
              className="form-input w-20 uppercase"
              maxLength={3}
              value={ruleCurrency}
              onChange={(e) => setRuleCurrency(e.target.value.toUpperCase())}
              placeholder="USD"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="contracts-authority-rule-role" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.authorisedRole")}</label>
            <input id="contracts-authority-rule-role" className="form-input" value={ruleRole} onChange={(e) => setRuleRole(e.target.value)} placeholder={t("contracts.settings.rolePlaceholder")} />
          </div>
          <div className="space-y-1">
            <label htmlFor="contracts-authority-rule-alt-role" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.alternateRole")}</label>
            <input id="contracts-authority-rule-alt-role" className="form-input" value={ruleAltRole} onChange={(e) => setRuleAltRole(e.target.value)} placeholder={t("contracts.common.optionalParen")} />
          </div>
          <div className="space-y-1">
            <label htmlFor="contracts-authority-rule-policy" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.policyRef")}</label>
            <input id="contracts-authority-rule-policy" className="form-input w-36" value={rulePolicy} onChange={(e) => setRulePolicy(e.target.value)} placeholder={t("contracts.common.optionalParen")} />
          </div>
          <button className="btn-primary text-sm" onClick={addRule}>
            {t("contracts.settings.addRule")}
          </button>
        </div>
      </div>

      {/* Delegations */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">{t("contracts.authority.delegations")}</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            {t("contracts.authority.delegationsHint")}
          </p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("contracts.authority.delegatorRole")}</th>
              <th>{t("contracts.authority.delegate")}</th>
              <th>{t("contracts.settings.action")}</th>
              <th>{t("contracts.authority.effective")}</th>
              <th>{t("contracts.field.status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {delegationsLoading ? (
              <TableEmpty colSpan={6} icon="hourglass_empty" title="contracts.authority.loadingDelegations" />
            ) : delegations.length === 0 ? (
              <TableEmpty
                colSpan={6}
                icon="assignment_ind"
                title="contracts.authority.noDelegations"
                description="contracts.authority.noDelegationsHint"
              />
            ) : (
              delegations.map((d) => (
                <tr key={d.id}>
                  <td className="text-sm font-medium text-neutral-800">{d.delegator_role ?? "—"}</td>
                  <td className="text-sm text-neutral-800">
                    {d.delegate?.name ?? `#${d.delegate_user_id}`}
                    {d.delegate?.email ? <span className="text-xs text-neutral-400 block">{d.delegate.email}</span> : null}
                  </td>
                  <td className="text-xs capitalize text-neutral-500">{d.action === "approve" || d.action === "sign" ? t(`contracts.settings.ruleAction.${d.action}`) : d.action ?? t("contracts.authority.any")}</td>
                  <td className="text-xs text-neutral-500">
                    {d.effective_from} → {d.expires_at}
                  </td>
                  <td className="text-sm">
                    {d.is_active ? <span className="badge badge-success">{t("contracts.status.active")}</span> : <span className="badge badge-muted">{t("contracts.authority.revoked")}</span>}
                  </td>
                  <td className="text-right">
                    {d.is_active ? (
                      <button className="btn-secondary text-xs py-0.5 text-red-600" onClick={() => revokeDelegation(d)}>
                        {t("contracts.authority.revoke")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="contracts-authority-delegator-role" className="text-xs font-semibold text-neutral-600">{t("contracts.authority.delegatorRole")}</label>
              <input id="contracts-authority-delegator-role"
                className="form-input"
                value={delDelegatorRole}
                onChange={(e) => setDelDelegatorRole(e.target.value)}
                placeholder={t("contracts.authority.delegatorPlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="contracts-authority-delegation-action" className="text-xs font-semibold text-neutral-600">{t("contracts.settings.action")}</label>
              <select id="contracts-authority-delegation-action" className="form-input w-28" value={delAction} onChange={(e) => setDelAction(e.target.value)}>
                <option value="">{t("contracts.authority.any")}</option>
                <option value="approve">{t("contracts.settings.ruleAction.approve")}</option>
                <option value="sign">{t("contracts.settings.ruleAction.sign")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="contracts-authority-delegation-from" className="text-xs font-semibold text-neutral-600">{t("contracts.authority.effectiveFrom")}</label>
              <input id="contracts-authority-delegation-from" className="form-input" type="date" value={delFrom} onChange={(e) => setDelFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="contracts-authority-delegation-until" className="text-xs font-semibold text-neutral-600">{t("contracts.authority.expires")}</label>
              <input id="contracts-authority-delegation-until" className="form-input" type="date" value={delUntil} min={delFrom || undefined} onChange={(e) => setDelUntil(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <EmployeePicker
              id="contract-authority-delegate"
              label={t("contracts.authority.delegate")}
              value={delDelegateUser}
              onSelect={setDelDelegateUser}
              required
              placeholder={t("contracts.authority.searchStaff")}
            />
            <div className="space-y-1">
              <label htmlFor="contracts-authority-delegation-reason" className="text-xs font-semibold text-neutral-600">{t("common.reason")}</label>
              <textarea id="contracts-authority-delegation-reason"
                className="form-input resize-none"
                rows={2}
                value={delReason}
                onChange={(e) => setDelReason(e.target.value)}
                placeholder={t("contracts.common.optionalParen")}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary text-sm" onClick={addDelegation}>
              {t("contracts.authority.addDelegation")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
