"use client";

import { useEffect, useState } from "react";
import {
  financeApi,
  hrFilesApi,
  type SalaryAdvancePolicyException,
  type SalaryAdvancePolicyVersion,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { SalaryAdvancePageHeader } from "@/components/salary-advance/SalaryAdvancePageHeader";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";

export default function SalaryAdvanceSettingsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [policies, setPolicies] = useState<SalaryAdvancePolicyVersion[]>([]);
  const [exceptions, setExceptions] = useState<SalaryAdvancePolicyException[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<Array<{ id: number; name: string | null; detail: string | null }>>([]);
  const [payroll, setPayroll] = useState<{
    mode: string;
    adapter?: string;
    driver?: string;
    enabled: boolean;
    message: string;
    coming_soon?: boolean;
    recording_mode?: string;
    supports_auto_push?: boolean;
    supports_auto_pull?: boolean;
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
      setError(t("salaryAdvances.settings.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    hrFilesApi
      .list({ per_page: 100 })
      .then((res) => {
        setEmployeeOptions(
          (res.data.data ?? []).map((file) => ({
            id: file.employee_id,
            name: file.employee?.name ?? file.staff_number ?? null,
            detail: file.employee?.email ?? file.current_position ?? null,
          })),
        );
      })
      .catch(() => setEmployeeOptions([]));
  }, []);

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
      toast.success(t("salaryAdvances.settings.versionCreated"), form.version || undefined);
      setForm({ version: "", effective_from: "", max_salary_percentage: 50, change_reason: "" });
      await load();
    } catch (err) {
      const message = apiErrorMessage(err, t("salaryAdvances.settings.versionCreateFailed"));
      setError(message);
      toast.error(t("salaryAdvances.settings.versionNotCreated"), message);
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
      toast.success(t("salaryAdvances.settings.exceptionCreated"));
      setExceptionForm({
        employee_id: "",
        exception_type: "outstanding_balance",
        reason: "",
        justification: "",
        effective_from: "",
        effective_to: "",
      });
      await load();
    } catch (err) {
      const message = apiErrorMessage(err, t("salaryAdvances.settings.exceptionCreateFailed"));
      setError(message);
      toast.error(t("salaryAdvances.settings.exceptionNotCreated"), message);
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
      toast.success(t("salaryAdvances.settings.exceptionApproved"));
      await load();
    } catch (err) {
      const message = apiErrorMessage(err, t("salaryAdvances.settings.approveFailed"));
      setError(message);
      toast.error(t("procurement.exceptions.approveFailedTitle"), message);
    } finally {
      setSaving(false);
    }
  };

  const active = policies.find((p) => p.active) ?? policies[0];

  return (
    <div className="space-y-6">
      <SalaryAdvancePageHeader
        title="salaryAdvances.settings.title"
        subtitle={t("salaryAdvances.settings.subtitle")}
        crumbs={[
          { label: "nav.salary_advances", href: "/salary-advances" },
          { label: "travel.settings.crumb" },
        ]}
      />

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="h-40 rounded-xl bg-neutral-100 animate-pulse" />
      ) : (
        <>
          <div className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-neutral-900">{t("leave.settings.activePolicy")}</h2>
            {active ? (
              <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-neutral-500">{t("leave.settings.version")}</dt><dd className="font-medium">{active.version}</dd></div>
                <div><dt className="text-xs text-neutral-500">{t("travel.settings.effectiveFrom")}</dt><dd className="font-medium">{formatDate(active.effective_from)}</dd></div>
                <div><dt className="text-xs text-neutral-500">{t("salaryAdvances.settings.maxPctNet")}</dt><dd className="font-medium">{active.max_salary_percentage}%</dd></div>
                <div><dt className="text-xs text-neutral-500">{t("salaryAdvances.settings.salaryBasis")}</dt><dd className="font-medium">{active.salary_basis}</dd></div>
                <div><dt className="text-xs text-neutral-500">{t("salaryAdvances.detail.step.recovery")}</dt><dd className="font-medium">{active.recovery_rule}</dd></div>
                <div><dt className="text-xs text-neutral-500">{t("salaryAdvances.settings.concurrent")}</dt><dd className="font-medium">{t("salaryAdvances.settings.locked", { count: active.max_concurrent_advances })}</dd></div>
              </dl>
            ) : (
              <EmptyState icon="policy" title="salaryAdvances.settings.noActive" className="py-6 min-h-0" />
            )}
          </div>

          <form onSubmit={createVersion} className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900">{t("salaryAdvances.settings.activateTitle")}</h2>
            <p className="text-xs text-neutral-500">{t("salaryAdvances.settings.activateHint")}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label htmlFor="salary-advances-settings-version-label-setform-placeholder-2026-2" className="text-xs font-medium text-neutral-700">{t("salaryAdvances.settings.versionLabel")}
                <input id="salary-advances-settings-version-label-setform-placeholder-2026-2" required className="mt-1 input w-full" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="2026.2" />
              </label>
              <label htmlFor="salary-advances-settings-effective-from-setform" className="text-xs font-medium text-neutral-700">{t("travel.settings.effectiveFrom")}
                <input id="salary-advances-settings-effective-from-setform" required type="date" className="mt-1 input w-full" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
              </label>
              <label htmlFor="salary-advances-settings-max-salary-setform" className="text-xs font-medium text-neutral-700">{t("salaryAdvances.settings.maxSalaryPct")}
                <input id="salary-advances-settings-max-salary-setform" required type="number" min={1} max={100} className="mt-1 input w-full" value={form.max_salary_percentage} onChange={(e) => setForm({ ...form, max_salary_percentage: Number(e.target.value) })} />
              </label>
              <label htmlFor="salary-advances-settings-change-reason-required-for-audit-setform" className="text-xs font-medium text-neutral-700 sm:col-span-2">{t("salaryAdvances.settings.changeReason")}
                <textarea id="salary-advances-settings-change-reason-required-for-audit-setform" required className="mt-1 input w-full min-h-[80px]" value={form.change_reason} onChange={(e) => setForm({ ...form, change_reason: e.target.value })} />
              </label>
            </div>
            <button type="submit" disabled={saving} className="btn-primary py-2 px-4 text-sm disabled:opacity-40">
              {saving ? t("leave.settings.saving") : t("salaryAdvances.settings.createActivate")}
            </button>
          </form>

          <div className="card p-5 space-y-2">
            <h2 className="text-sm font-semibold text-neutral-900">{t("salaryAdvances.settings.payrollTitle")}</h2>
            <p className="text-sm text-neutral-600">{payroll?.message ?? t("salaryAdvances.settings.manualDefault")}</p>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-muted text-xs">{t("salaryAdvances.settings.driver", { value: payroll?.driver ?? payroll?.mode ?? "manual" })}</span>
              <span className="badge badge-muted text-xs">{t("salaryAdvances.settings.adapter", { value: payroll?.adapter ?? "manual" })}</span>
              <span className="badge badge-muted text-xs">
                {payroll?.recording_mode === "manual_reference_required"
                  ? t("salaryAdvances.settings.referenceRequired")
                  : (payroll?.recording_mode ?? "manual")}
              </span>
              <span className={`badge text-xs ${payroll?.enabled ? "badge-warning" : "badge-success"}`}>
                {payroll?.enabled ? t("salaryAdvances.settings.vendorEnabled") : t("salaryAdvances.settings.manualOnly")}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              {t("salaryAdvances.settings.autoPushPull", {
                push: payroll?.supports_auto_push ? t("procurement.vendors.csv.yes") : t("procurement.vendors.csv.no"),
                pull: payroll?.supports_auto_pull ? t("procurement.vendors.csv.yes") : t("procurement.vendors.csv.no"),
              })}{" "}
              {t("salaryAdvances.settings.changeDriverVia")}{" "}
              <code className="font-mono">SALARY_ADVANCE_PAYROLL_DRIVER</code>{" "}{/* i18n-ignore */}
              {t("salaryAdvances.settings.vendorRejected")}
            </p>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">{t("salaryAdvances.settings.exceptionsTitle")}</h2>
              <p className="text-xs text-neutral-500 mt-1">
                {t("salaryAdvances.settings.exceptionsHint")}
              </p>
            </div>
            <form onSubmit={createException} className="grid sm:grid-cols-2 gap-3">
              <label htmlFor="sa-exception-employee" className="text-xs font-medium text-neutral-700">{t("salary.exception.employee")}
                <select
                  id="sa-exception-employee"
                  required
                  className="mt-1 input w-full"
                  value={exceptionForm.employee_id}
                  data-testid="sa-exception-employee"
                  onChange={(e) => setExceptionForm({ ...exceptionForm, employee_id: e.target.value })}
                >
                  <option value="">{t("pickers.none")}</option>
                  {employeeOptions.map((employee) => (
                    <option key={employee.id} value={String(employee.id)}>
                      {`${employee.name ?? t("salaryAdvances.settings.employeeFallback", { id: employee.id })} (${employee.detail ?? t("salaryAdvances.settings.noEmail")})`}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="salary-advances-settings-exception-type-setexceptionform-outstanding-bala" className="text-xs font-medium text-neutral-700">{t("salaryAdvances.settings.exceptionType")}
                <select id="salary-advances-settings-exception-type-setexceptionform-outstanding-bala" className="mt-1 input w-full" value={exceptionForm.exception_type} onChange={(e) => setExceptionForm({ ...exceptionForm, exception_type: e.target.value })}>
                  <option value="outstanding_balance">{t("workflows.simulate.field.outstanding_balance")}</option>
                  <option value="max_percentage">{t("salaryAdvances.settings.maxPercentage")}</option>
                  <option value="concurrent">{t("salaryAdvances.settings.concurrent")}</option>
                  <option value="other">{t("risk.create.category.other")}</option>
                </select>
              </label>
              <label htmlFor="salary-advances-settings-effective-from-setexceptionform" className="text-xs font-medium text-neutral-700">{t("travel.settings.effectiveFrom")}
                <input id="salary-advances-settings-effective-from-setexceptionform" required type="date" className="mt-1 input w-full" value={exceptionForm.effective_from} onChange={(e) => setExceptionForm({ ...exceptionForm, effective_from: e.target.value })} />
              </label>
              <label htmlFor="salary-advances-settings-effective-to-setexceptionform" className="text-xs font-medium text-neutral-700">{t("assets.insurance.effectiveTo")}
                <input id="salary-advances-settings-effective-to-setexceptionform" type="date" className="mt-1 input w-full" value={exceptionForm.effective_to} onChange={(e) => setExceptionForm({ ...exceptionForm, effective_to: e.target.value })} />
              </label>
              <label htmlFor="salary-advances-settings-reason-setexceptionform" className="text-xs font-medium text-neutral-700 sm:col-span-2">{t("common.reason")}
                <input id="salary-advances-settings-reason-setexceptionform" required className="mt-1 input w-full" value={exceptionForm.reason} onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })} />
              </label>
              <label htmlFor="salary-advances-settings-justification-audit-setexceptionform" className="text-xs font-medium text-neutral-700 sm:col-span-2">{t("salaryAdvances.settings.justification")}
                <textarea id="salary-advances-settings-justification-audit-setexceptionform" required className="mt-1 input w-full min-h-[70px]" value={exceptionForm.justification} onChange={(e) => setExceptionForm({ ...exceptionForm, justification: e.target.value })} />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" disabled={saving} className="btn-secondary py-2 px-4 text-sm disabled:opacity-40">
                  {t("salaryAdvances.settings.recordException")}
                </button>
              </div>
            </form>
            {exceptions.length === 0 ? (
              <EmptyState icon="rule" title="salaryAdvances.settings.noExceptions" className="py-6 min-h-0" />
            ) : (
            <ul className="divide-y divide-neutral-100">
              {exceptions.map((ex) => (
                <li key={ex.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{ex.employee?.name ?? t("fleet.userNumber", { id: ex.employee_id })} · {ex.exception_type}</p>
                    <p className="text-xs text-neutral-500">{ex.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge text-xs ${ex.status === "approved" ? "badge-success" : ex.status === "pending" ? "badge-warning" : "badge-muted"}`}>
                      {ex.status}
                    </span>
                    {ex.status === "pending" ? (
                      <button type="button" disabled={saving} onClick={() => approveException(ex.id)} className="btn-primary py-1 px-2 text-xs disabled:opacity-40">
                        {t("common.approve")}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">{t("leave.settings.history")}</h2>
            <ul className="divide-y divide-neutral-100">
              {policies.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{p.version}</span>
                  <span className="text-xs text-neutral-500">{formatDate(p.effective_from)}</span>
                  <span className={`badge text-xs ${p.active ? "badge-success" : "badge-muted"}`}>{p.active ? t("audit.access.active") : t("admin.common.inactive")}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
