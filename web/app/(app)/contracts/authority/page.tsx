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

export default function ContractAuthorityPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm } = useConfirm();

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
    toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Action failed");

  const typeName = (id: number | null) => {
    if (id == null) return "All types";
    return types.find((t) => t.id === id)?.name ?? `Type #${id}`;
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
        toast.success("Authority rule added");
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
        toast.success("Updated");
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
      toast.error("Expiry must be after the effective date");
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
        toast.success("Delegation recorded");
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
      title: "Revoke delegation",
      message: "Revoke this authority delegation? This cannot be undone.",
      variant: "danger",
    });
    if (!ok) return;
    contractsApi
      .revokeAuthorityDelegation(d.id)
      .then(() => {
        toast.success("Delegation revoked");
        refreshDelegations();
      })
      .catch(err);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <ModulePageHeader
        title="Authority Matrix & Delegations"
        subtitle="Value-banded approval/signing authority and temporary acting delegations for contracts."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Contracts", href: "/contracts" }, { label: "Authority" }]} />}
      />

      {/* Authority Matrix */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">Authority matrix</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Value-banded approval / signing authority, evaluated when the action occurs.
          </p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>Action</th>
              <th>Value band</th>
              <th>Contract type</th>
              <th>Authorised role</th>
              <th>Alternate</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rulesLoading ? (
              <TableEmpty colSpan={8} icon="hourglass_empty" title="Loading authority rules…" />
            ) : rules.length === 0 ? (
              <TableEmpty
                colSpan={8}
                icon="rule"
                title="No authority rules configured"
                description="Approvals fall back to role permissions until rules are added."
              />
            ) : (
              rules.map((r) => (
                <tr key={r.id}>
                  <td className="text-sm font-medium text-neutral-800">{r.name}</td>
                  <td className="text-xs capitalize text-neutral-500">{r.action}</td>
                  <td className="text-sm text-neutral-600">
                    {band(r)} {r.currency ?? ""}
                  </td>
                  <td className="text-xs text-neutral-500">{typeName(r.contract_type_id)}</td>
                  <td className="text-sm text-neutral-800">{r.authorised_role}</td>
                  <td className="text-xs text-neutral-500">{r.alternate_role ?? "—"}</td>
                  <td className="text-sm">{r.is_active ? "Yes" : "No"}</td>
                  <td className="text-right">
                    <button className="btn-secondary text-xs py-0.5" onClick={() => toggleRule(r)}>
                      {r.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="p-4 border-t border-neutral-100 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Rule name</label>
            <input className="form-input" value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="e.g. SG signs above 100k" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Action</label>
            <select className="form-input w-28" value={ruleAction} onChange={(e) => setRuleAction(e.target.value as "approve" | "sign")}>
              <option value="approve">Approve</option>
              <option value="sign">Sign</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Contract type</label>
            <select className="form-input" value={ruleTypeId} onChange={(e) => setRuleTypeId(e.target.value)}>
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Floor</label>
            <input className="form-input w-28" type="number" value={ruleFloor} onChange={(e) => setRuleFloor(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Ceiling</label>
            <input className="form-input w-28" type="number" value={ruleCeiling} onChange={(e) => setRuleCeiling(e.target.value)} placeholder="none" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Currency</label>
            <input
              className="form-input w-20 uppercase"
              maxLength={3}
              value={ruleCurrency}
              onChange={(e) => setRuleCurrency(e.target.value.toUpperCase())}
              placeholder="USD"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Authorised role</label>
            <input className="form-input" value={ruleRole} onChange={(e) => setRuleRole(e.target.value)} placeholder="Secretary General" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Alternate role</label>
            <input className="form-input" value={ruleAltRole} onChange={(e) => setRuleAltRole(e.target.value)} placeholder="(optional)" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">Policy ref</label>
            <input className="form-input w-36" value={rulePolicy} onChange={(e) => setRulePolicy(e.target.value)} placeholder="(optional)" />
          </div>
          <button className="btn-primary text-sm" onClick={addRule}>
            Add rule
          </button>
        </div>
      </div>

      {/* Delegations */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-800">Acting delegations</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Temporary transfer of approval or signing authority from a role to a named delegate for a fixed period.
          </p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Delegator role</th>
              <th>Delegate</th>
              <th>Action</th>
              <th>Effective</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {delegationsLoading ? (
              <TableEmpty colSpan={6} icon="hourglass_empty" title="Loading delegations…" />
            ) : delegations.length === 0 ? (
              <TableEmpty
                colSpan={6}
                icon="assignment_ind"
                title="No delegations recorded"
                description="Temporary acting delegations will appear here once created."
              />
            ) : (
              delegations.map((d) => (
                <tr key={d.id}>
                  <td className="text-sm font-medium text-neutral-800">{d.delegator_role ?? "—"}</td>
                  <td className="text-sm text-neutral-800">
                    {d.delegate?.name ?? `#${d.delegate_user_id}`}
                    {d.delegate?.email ? <span className="text-xs text-neutral-400 block">{d.delegate.email}</span> : null}
                  </td>
                  <td className="text-xs capitalize text-neutral-500">{d.action ?? "Any"}</td>
                  <td className="text-xs text-neutral-500">
                    {d.effective_from} → {d.expires_at}
                  </td>
                  <td className="text-sm">
                    {d.is_active ? <span className="badge badge-success">Active</span> : <span className="badge badge-muted">Revoked</span>}
                  </td>
                  <td className="text-right">
                    {d.is_active ? (
                      <button className="btn-secondary text-xs py-0.5 text-red-600" onClick={() => revokeDelegation(d)}>
                        Revoke
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
              <label className="text-xs font-semibold text-neutral-600">Delegator role</label>
              <input
                className="form-input"
                value={delDelegatorRole}
                onChange={(e) => setDelDelegatorRole(e.target.value)}
                placeholder="e.g. Secretary General"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Action</label>
              <select className="form-input w-28" value={delAction} onChange={(e) => setDelAction(e.target.value)}>
                <option value="">Any</option>
                <option value="approve">Approve</option>
                <option value="sign">Sign</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Effective from</label>
              <input className="form-input" type="date" value={delFrom} onChange={(e) => setDelFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Expires</label>
              <input className="form-input" type="date" value={delUntil} min={delFrom || undefined} onChange={(e) => setDelUntil(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <EmployeePicker
              id="contract-authority-delegate"
              label="Delegate"
              value={delDelegateUser}
              onSelect={setDelDelegateUser}
              required
              placeholder="Search staff by name or email…"
            />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Reason</label>
              <textarea
                className="form-input resize-none"
                rows={2}
                value={delReason}
                onChange={(e) => setDelReason(e.target.value)}
                placeholder="(optional)"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn-primary text-sm" onClick={addDelegation}>
              Add delegation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
