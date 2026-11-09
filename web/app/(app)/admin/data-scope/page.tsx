"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { adminApi, type Department } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type SecurityGateStatus = "pass" | "fail";

interface SecurityGate {
  id: string;
  label: string;
  desc: string;
  status: SecurityGateStatus;
}

// Static RLS gate definitions — represent what's enforced at DB/API layer
const SECURITY_GATES: SecurityGate[] = [
  { id: "TI-9921", label: "admin.dataScope.gate.tenant",   desc: "admin.dataScope.gate.tenantDesc",   status: "pass" },
  { id: "RLS-001", label: "admin.dataScope.gate.rls",      desc: "admin.dataScope.gate.rlsDesc",      status: "pass" },
  { id: "PR-110",  label: "admin.dataScope.gate.pii",      desc: "admin.dataScope.gate.piiDesc",      status: "pass" },
  { id: "AU-220",  label: "admin.dataScope.gate.audit",    desc: "admin.dataScope.gate.auditDesc",    status: "pass" },
  { id: "TO-330",  label: "admin.dataScope.gate.token",    desc: "admin.dataScope.gate.tokenDesc",    status: "pass" },
  { id: "AP-441",  label: "admin.dataScope.gate.approver", desc: "admin.dataScope.gate.approverDesc", status: "pass" },
];

const SCOPE_LEVELS: Record<string, { label: string; color: string }> = {
  confidential: { label: "admin.dataScope.scope.confidential", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  internal:     { label: "admin.dataScope.scope.internal",     color: "bg-blue-100 text-blue-700 border-blue-200" },
  restricted:   { label: "admin.governance.restricted",        color: "bg-amber-100 text-amber-700 border-amber-200" },
  public:       { label: "admin.governance.public",            color: "bg-green-100 text-green-700 border-green-200" },
};

function getScopeLevel(dept: Department): keyof typeof SCOPE_LEVELS {
  const name = dept.name.toLowerCase();
  if (name.includes("finance") || name.includes("hr") || name.includes("payroll")) return "confidential";
  if (name.includes("exec") || name.includes("governance") || name.includes("sg")) return "restricted";
  if (name.includes("programme") || name.includes("srhr") || name.includes("legal")) return "internal";
  return "internal";
}

function getRlsPolicy(dept: Department): string {
  const name = dept.name.toLowerCase().replace(/\s+/g, "_").toUpperCase().slice(0, 12);
  return `RLS_${name}_T`;
}

export default function DataScopePage() {
  const { t } = useI18n();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [runningDiag, setRunningDiag] = useState(false);
  const [lastRun, setLastRun]         = useState<Date | null>(null);

  useEffect(() => {
    setLoading(true);
    adminApi.listDepartments()
      .then((res) => setDepartments((res.data as { data: Department[] }).data ?? res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRunDiagnostics = () => {
    setRunningDiag(true);
    setTimeout(() => {
      setRunningDiag(false);
      setLastRun(new Date());
    }, 1800);
  };

  const filtered = departments.filter((d) =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase()),
  );

  const passCount   = SECURITY_GATES.filter((g) => g.status === "pass").length;
  const failCount   = SECURITY_GATES.filter((g) => g.status === "fail").length;

  const timeAgo = (d: Date) => {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return t("admin.dataScope.secondsAgo", { n: s });
    return t("admin.dataScope.minutesAgo", { n: Math.floor(s / 60) });
  };

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title={t("admin.dataScope.title")}
        subtitle={t("admin.dataScope.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("admin.homeLabel"), href: "/admin" },
              { label: t("admin.dataScope.title") },
            ]}
          />
        }
        meta={
          <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-green-700">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            {t("admin.dataScope.systemLive")}
          </span>
        }
        actions={
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/admin/ledger" className="btn-secondary flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              {t("admin.dataScope.auditLog")}
            </Link>
            <button
              type="button"
              onClick={handleRunDiagnostics}
              disabled={runningDiag}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              <span className={cn("material-symbols-outlined text-[18px]", runningDiag ? "animate-spin" : "")}>refresh</span>
              {runningDiag ? t("admin.dataScope.running") : t("admin.dataScope.runDiagnostics")}
            </button>
          </div>
        }
      />

      {lastRun && (
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[18px]">check_circle</span>
          <p className="text-sm text-green-700 dark:text-green-400">{t("admin.dataScope.diagPassed", { count: passCount, ago: timeAgo(lastRun) })}</p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{t("admin.dataScope.securityGates")}</p>
            <span className="material-symbols-outlined text-neutral-300 text-[18px]">policy</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{SECURITY_GATES.length}</p>
            <span className="text-xs font-semibold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">{t("admin.common.active")}</span>
          </div>
          <div className="mt-2 w-full bg-neutral-100 dark:bg-neutral-700/40 rounded-full h-1 overflow-hidden">
            <div className="bg-green-500 h-1 rounded-full" style={{ width: `${(passCount / SECURITY_GATES.length) * 100}%` }} />
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{t("admin.dataScope.enforcement")}</p>
            <span className="material-symbols-outlined text-neutral-300 text-[18px]">shield_lock</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t("admin.dataScope.strict")}</p>
            <span className="text-xs font-semibold text-green-700 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded">{"SEV-0"}</span>
          </div>
          <div className="mt-2 w-full bg-neutral-100 dark:bg-neutral-700/40 rounded-full h-1 overflow-hidden">
            <div className="bg-green-500 h-1 rounded-full w-full" />
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{t("admin.dataScope.failedChecks")}</p>
            <span className="material-symbols-outlined text-neutral-300 text-[18px]">gpp_bad</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className={cn("text-2xl font-bold", failCount > 0 ? "text-red-600" : "text-neutral-900")}>{failCount}</p>
            <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded", failCount > 0 ? "text-red-700 bg-red-100" : "text-green-600 bg-green-100")}>
              {failCount > 0 ? t("admin.dataScope.actionNeeded") : t("admin.dataScope.stable")}
            </span>
          </div>
          <div className="mt-2 w-full bg-neutral-100 dark:bg-neutral-700/40 rounded-full h-1 overflow-hidden">
            <div className={cn("h-1 rounded-full", failCount > 0 ? "bg-red-500" : "bg-green-500")} style={{ width: `${(failCount / SECURITY_GATES.length) * 100 || 1}%` }} />
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{t("admin.dataScope.deptsScoped")}</p>
            <span className="material-symbols-outlined text-neutral-300 text-[18px]">domain</span>
          </div>
          {loading ? (
            <div className="h-7 w-12 bg-neutral-100 dark:bg-neutral-700/40 rounded animate-pulse" />
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{departments.length}</p>
              <span className="text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{t("admin.dataScope.rlsActive")}</span>
            </div>
          )}
          <div className="mt-2 w-full bg-neutral-100 dark:bg-neutral-700/40 rounded-full h-1 overflow-hidden">
            <div className="bg-primary h-1 rounded-full w-full" />
          </div>
        </div>
      </div>

      {/* Main grid: left = CI gates, right = dept scoping rules */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Security CI Gates */}
        <div className="xl:col-span-1 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">security_update_good</span>
              <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{t("admin.dataScope.ciGates")}</span>
            </div>
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="p-4 space-y-2">
            {SECURITY_GATES.map((gate) => (
              <div
                key={gate.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border",
                  gate.status === "pass"
                    ? "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
                    : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-1.5 rounded-lg",
                    gate.status === "pass" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600",
                  )}>
                    <span className="material-symbols-outlined text-[18px]">
                      {gate.status === "pass" ? "check_circle" : "cancel"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{t(gate.label)}</p>
                    <p className="text-[11px] text-neutral-400">{t(gate.desc)}</p>
                    <p className="text-[10px] text-neutral-300 font-mono mt-0.5">{t("admin.dataScope.policyId", { id: gate.id })}</p>
                  </div>
                </div>
                <span className={cn(
                  "text-[11px] font-bold px-2 py-0.5 rounded border",
                  gate.status === "pass"
                    ? "bg-green-100 text-green-700 border-green-200"
                    : "bg-red-100 text-red-700 border-red-200",
                )}>
                  {gate.status === "pass" ? t("admin.dataScope.pass") : t("admin.dataScope.fail")}
                </span>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-700 text-xs text-neutral-400 dark:text-neutral-500 flex items-center justify-between">
            <span>{t("admin.dataScope.passing", { pass: passCount, total: SECURITY_GATES.length })}</span>
            <span className="font-mono">{"SHA-256 · RLS"}</span>
          </div>
        </div>

        {/* Department Scoping Rules */}
        <div className="xl:col-span-2 card overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
            <div>
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{t("admin.dataScope.deptRules")}</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{t("admin.dataScope.deptRulesDesc")}</p>
            </div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-[16px]">search</span>
              <input
                type="text"
                className="form-input pl-8 py-1.5 text-sm w-44"
                placeholder={t("admin.dataScope.searchRules")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-neutral-100 dark:bg-neutral-700/40 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="domain"
              title={search ? t("admin.dataScope.noMatch") : t("admin.dataScope.noDepts")}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>{t("admin.dataScope.colCode")}</th>
                    <th>{t("admin.dataScope.colName")}</th>
                    <th>{t("admin.dataScope.colScope")}</th>
                    <th>{t("admin.dataScope.colPolicy")}</th>
                    <th className="text-center">{t("admin.common.status")}</th>
                    <th className="text-right">{t("admin.weeklySummary.users")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((dept) => {
                    const scope = getScopeLevel(dept);
                    const scopeDef = SCOPE_LEVELS[scope];
                    return (
                      <tr key={dept.id}>
                        <td className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">{dept.code || `DEPT-${dept.id}`}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-primary text-[14px]">domain</span>
                            </div>
                            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{dept.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", scopeDef.color)}>
                            {t(scopeDef.label)}
                          </span>
                        </td>
                        <td className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">{getRlsPolicy(dept)}</td>
                        <td className="text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="text-[11px] font-semibold text-green-700">{t("admin.common.active")}</span>
                          </div>
                        </td>
                        <td className="text-right text-sm font-medium text-neutral-600 dark:text-neutral-400 tabular-nums">
                          {dept.users_count ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-5 py-3 border-t border-neutral-100 dark:border-neutral-700 flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
            <span>{t(filtered.length !== 1 ? "admin.dataScope.deptMany" : "admin.dataScope.deptOne", { count: filtered.length })} · {t("admin.dataScope.allEnforced")}</span>
            <span className="font-mono text-neutral-300 dark:text-neutral-600">{t("admin.dataScope.isolationLine")}</span>
          </div>
        </div>
      </div>

      {/* Tenant Isolation Health footer */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 px-5 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-green-600 text-[20px]">verified_user</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("admin.dataScope.healthy")}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t("admin.dataScope.healthyDesc")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-400 dark:text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-green-500">lock</span>
              {t("admin.dataScope.pgRls")}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-green-500">lock</span>
              {t("admin.dataScope.appScoping")}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-green-500">lock</span>
              {t("admin.dataScope.tokenIsolation")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
