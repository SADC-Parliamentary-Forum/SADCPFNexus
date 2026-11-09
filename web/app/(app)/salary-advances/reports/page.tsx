"use client";

import { useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { SalaryAdvancePageHeader } from "@/components/salary-advance/SalaryAdvancePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/** Report cards; `label` and `hint` are catalog keys translated where they render. */
const REPORTS = [
  { id: "register", label: "salaryAdvances.reports.register.label", hint: "salaryAdvances.reports.register.hint", pack: "register", status: "" },
  { id: "outstanding", label: "salaryAdvances.reports.outstanding.label", hint: "salaryAdvances.reports.outstanding.hint", pack: "outstanding", status: "" },
  { id: "by-status", label: "salaryAdvances.reports.byStatus.label", hint: "salaryAdvances.reports.byStatus.hint", pack: "", status: "submitted" },
  { id: "recovery", label: "salaryAdvances.reports.recovery.label", hint: "salaryAdvances.reports.recovery.hint", pack: "recovery", status: "" },
] as const;

export default function SalaryAdvanceReportsPage() {
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (reportId: string, pack: string, status: string) => {
    setBusy(reportId);
    setError(null);
    try {
      const params: Record<string, string> = { format: "csv" };
      if (pack) params.pack = pack;
      if (status) params.status = status;
      const res = await api.get("/reports/salary-advances", { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `salary-advances-${reportId}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("salaryAdvances.reports.failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <SalaryAdvancePageHeader
        title={t("salaryAdvances.reports.title")}
        subtitle={t("salaryAdvances.reports.subtitle")}
        crumbs={[
          { label: "nav.salary_advances", href: "/salary-advances" },
          { label: t("salaryAdvances.common.reports") },
        ]}
      />

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <div key={r.id} className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-neutral-900">{t(r.label)}</h2>
            <p className="text-xs text-neutral-500">{t(r.hint)}</p>
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => download(r.id, r.pack, r.status)}
              className="btn-primary py-2 px-4 text-sm disabled:opacity-40"
            >
              {busy === r.id ? t("salaryAdvances.reports.exporting") : t("salaryAdvances.reports.download")}
            </button>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <p className="text-sm text-neutral-600">
          {t("salaryAdvances.reports.browse")
            .split(/(\{register\}|\{reports\})/)
            .map((part, i) =>
              part === "{register}" ? (
                <Link key={i} href="/salary-advances/register" className="btn-secondary text-xs">{t("salaryAdvances.register.title")}</Link>
              ) : part === "{reports}" ? (
                <Link key={i} href="/reports" className="btn-secondary text-xs">{t("salaryAdvances.common.reports")}</Link>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
        </p>
      </div>
    </div>
  );
}
