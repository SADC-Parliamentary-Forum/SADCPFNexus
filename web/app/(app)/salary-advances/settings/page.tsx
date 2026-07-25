"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  financeApi,
  type SalaryAdvancePolicyException,
  type SalaryAdvancePolicyVersion,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function SalaryAdvanceSettingsPage() {
  const [policies, setPolicies] = useState<SalaryAdvancePolicyVersion[]>([]);
  const [exceptions, setExceptions] = useState<SalaryAdvancePolicyException[]>([]);
  const [payroll, setPayroll] = useState<{
    mode: string;
    adapter?: string;
    enabled: boolean;
    message: string;
    coming_soon?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    version: "",
    effective_from: "",
    max_salary_percentage: 50,
    change_reason: "",
  });
  const [exceptionForm, setExceptionForm] = useState({
    employee_id: "",
    exception_type: "outstanding_balance",
    reason: "",
    justification: "",
    effective_from: "",
    effective_to: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pol, pay] = await Promise.all([
        financeApi.listSalaryAdvancePolicies(),
        financeApi.getSalaryAdvancePayrollIntegration(),
      ]);
      setPolicies(pol.data.data ?? []);
      setPayroll(pay.data.data);
      try {
        const ex = await financeApi.listSalaryAdvancePolicyExceptions({ per_page: 20 });
        setExceptions(ex.data.data ?? []);
      } catch {
        setExceptions([]);
      }
    } catch {
      setError("Failed to load salary advance settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await financeApi.createSalaryAdvancePolicy({
        ...form,
        salary_basis: "net_confirmed",
        max_concurrent_advances: 1,
        full_repayment_required: true,
        recovery_rule: "full_eom",
        finance_certification_required: true,
        admin_review_required: true,
        final_approver_role: "Secretary General",
      });
      setForm({ version: "", effective_from: "", max_salary_percentage: 50, change_reason: "" });
      await load();
    } catch {
      setError("Could not create policy version. Ensure you have salary_advance.admin and provide a change reason.");
    } finally {
      setSaving(false);
    }
  };

  const createException = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await financeApi.createSalaryAdvancePolicyException({
        employee_id: Number(exceptionForm.employee_id),
        exception_type: exceptionForm.exception_type,
        reason: exceptionForm.reason,
        justification: exceptionForm.justification,
        effective_from: exceptionForm.effective_from,
        effective_to: exceptionForm.effective_to || undefined,
      });
      setExceptionForm({
        employee_id: "",
        exception_type: "outstanding_balance",
        reason: "",
        justification: "",
        effective_from: "",
        effective_to: "",
      });
      await load();
    } catch {
      setError("Could not create policy exception. Admin permission required. Exceptions never silently override eligibility.");
    } finally {
      setSaving(false);
    }
  };

  const approveException = async (id: number) => {
    setSaving(true);
    try {
      await financeApi.approveSalaryAdvancePolicyException(id, {
        decision_notes: "Approved via Salary Advance Settings",
      });
      await load();
    } catch {
      setError("Could not approve exception.");
    } finally {
      setSaving(false);
    }
  };

  const active = policies.find((p) => p.active) ?? policies[0];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-1">
          <Link href="/salary-advances" className="hover:text-neutral-700">Salary Advances</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700">Settings</span>
        </div>
        <h1 className="page-title">Salary Advance Settings</h1>
        <p className="page-subtitle">Policy versions are immutable once activated. Create a new version to change rules — no silent overrides.</p>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="h-40 rounded-xl bg-neutral-100 animate-pulse" />
      ) : (
        <>
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-neutral-900">Active policy</h2>
            {active ? (
              <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-neutral-500">Version</dt><dd className="font-medium">{active.version}</dd></div>
                <div><dt className="text-xs text-neutral-500">Effective from</dt><dd className="font-medium">{formatDate(active.effective_from)}</dd></div>
                <div><dt className="text-xs text-neutral-500">Max % of net</dt><dd className="font-medium">{active.max_salary_percentage}%</dd></div>
                <div><dt className="text-xs text-neutral-500">Salary basis</dt><dd className="font-medium">{active.salary_basis}</dd></div>
                <div><dt className="text-xs text-neutral-500">Recovery</dt><dd className="font-medium">{active.recovery_rule}</dd></div>
                <div><dt className="text-xs text-neutral-500">Concurrent advances</dt><dd className="font-medium">{active.max_concurrent_advances} (locked)</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-neutral-500">No active policy found.</p>
            )}
          </div>

          <form onSubmit={createVersion} className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">Activate new policy version</h2>
            <p className="text-xs text-neutral-500">Creates a new audited version. Prior tenant versions are deactivated. Consolidation and instalments remain disabled.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-medium text-neutral-700">Version label
                <input required className="mt-1 input w-full" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="2026.2" />
              </label>
              <label className="text-xs font-medium text-neutral-700">Effective from
                <input required type="date" className="mt-1 input w-full" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-neutral-700">Max salary %
                <input required type="number" min={1} max={100} className="mt-1 input w-full" value={form.max_salary_percentage} onChange={(e) => setForm({ ...form, max_salary_percentage: Number(e.target.value) })} />
              </label>
              <label className="text-xs font-medium text-neutral-700 sm:col-span-2">Change reason (required for audit)
                <textarea required className="mt-1 input w-full min-h-[80px]" value={form.change_reason} onChange={(e) => setForm({ ...form, change_reason: e.target.value })} />
              </label>
            </div>
            <button type="submit" disabled={saving} className="btn-primary py-2 px-4 text-sm disabled:opacity-40">
              {saving ? "Saving…" : "Create & activate version"}
            </button>
          </form>

          <div className="card p-5 space-y-2">
            <h2 className="text-sm font-semibold text-neutral-900">Payroll recovery adapter</h2>
            <p className="text-sm text-neutral-600">{payroll?.message ?? "Manual recovery is the default."}</p>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-muted text-xs">Mode: {payroll?.mode ?? "manual"}</span>
              <span className="badge badge-muted text-xs">Adapter: {payroll?.adapter ?? "manual"}</span>
              <span className="badge badge-muted text-xs">{payroll?.enabled ? "Vendor enabled" : "Manual recording only"}</span>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Controlled policy exceptions</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Documented exceptions with audit trail. Approved exceptions are visible on eligibility but never silently bypass outstanding-balance or 50% rules.
              </p>
            </div>
            <form onSubmit={createException} className="grid sm:grid-cols-2 gap-3">
              <label className="text-xs font-medium text-neutral-700">Employee user ID
                <input required type="number" className="mt-1 input w-full" value={exceptionForm.employee_id} onChange={(e) => setExceptionForm({ ...exceptionForm, employee_id: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-neutral-700">Exception type
                <select className="mt-1 input w-full" value={exceptionForm.exception_type} onChange={(e) => setExceptionForm({ ...exceptionForm, exception_type: e.target.value })}>
                  <option value="outstanding_balance">Outstanding balance</option>
                  <option value="max_percentage">Max percentage</option>
                  <option value="concurrent">Concurrent advances</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-xs font-medium text-neutral-700">Effective from
                <input required type="date" className="mt-1 input w-full" value={exceptionForm.effective_from} onChange={(e) => setExceptionForm({ ...exceptionForm, effective_from: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-neutral-700">Effective to
                <input type="date" className="mt-1 input w-full" value={exceptionForm.effective_to} onChange={(e) => setExceptionForm({ ...exceptionForm, effective_to: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-neutral-700 sm:col-span-2">Reason
                <input required className="mt-1 input w-full" value={exceptionForm.reason} onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })} />
              </label>
              <label className="text-xs font-medium text-neutral-700 sm:col-span-2">Justification (audit)
                <textarea required className="mt-1 input w-full min-h-[70px]" value={exceptionForm.justification} onChange={(e) => setExceptionForm({ ...exceptionForm, justification: e.target.value })} />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" disabled={saving} className="btn-secondary py-2 px-4 text-sm disabled:opacity-40">
                  Record exception (pending)
                </button>
              </div>
            </form>
            <ul className="divide-y divide-neutral-100">
              {exceptions.length === 0 ? (
                <li className="py-3 text-sm text-neutral-500">No policy exceptions recorded.</li>
              ) : exceptions.map((ex) => (
                <li key={ex.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{ex.employee?.name ?? `User #${ex.employee_id}`} · {ex.exception_type}</p>
                    <p className="text-xs text-neutral-500">{ex.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge text-xs ${ex.status === "approved" ? "badge-success" : ex.status === "pending" ? "badge-warning" : "badge-muted"}`}>
                      {ex.status}
                    </span>
                    {ex.status === "pending" ? (
                      <button type="button" disabled={saving} onClick={() => approveException(ex.id)} className="btn-primary py-1 px-2 text-xs disabled:opacity-40">
                        Approve
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">Version history</h2>
            <ul className="divide-y divide-neutral-100">
              {policies.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{p.version}</span>
                  <span className="text-xs text-neutral-500">{formatDate(p.effective_from)}</span>
                  <span className={`badge text-xs ${p.active ? "badge-success" : "badge-muted"}`}>{p.active ? "Active" : "Inactive"}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
