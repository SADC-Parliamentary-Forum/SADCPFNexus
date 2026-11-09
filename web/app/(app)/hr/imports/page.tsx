"use client";

import { useState } from "react";
import Link from "next/link";
import { hrVipImportApi, type HrVipImportBatch } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { useToast } from "@/components/ui/Toast";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { canAccessRoute, getStoredUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Preview = {
  employee_count?: number;
  employees_to_create?: string[];
  legacy_profile_candidates?: Array<{ employee_code: string; message: string }>;
  leave_transaction_count?: number;
  leave_balance_rows?: number;
  payslip_count?: number;
  asset_count?: number;
  blocking_errors?: Array<{ employee_code: string; message: string }>;
  ready?: boolean;
};

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return fallback;
}

export default function HistoricalLeavePayrollImportPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [batch, setBatch] = useState<HrVipImportBatch | null>(null);
  const [busy, setBusy] = useState<"stage" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canAccessRoute(getStoredUser(), "/hr/imports")) {
    return <AccessDenied />;
  }

  const preview = (batch?.preview ?? null) as Preview | null;
  const summary = batch?.commit_summary ?? null;

  const stage = async () => {
    if (files.length === 0) {
      setError(t("hr.imports.selectFile"));
      return;
    }
    setBusy("stage");
    setError(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files[]", f));
      const res = await hrVipImportApi.upload(form);
      setBatch(res.data.data);
      toast.success(t("hr.imports.staged"));
    } catch (err) {
      const message = apiErrorMessage(err, t("common.error"));
      setError(message);
      toast.error(t("hr.imports.notStaged"), message);
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!batch) return;
    setBusy("commit");
    setError(null);
    try {
      const res = await hrVipImportApi.commit(batch.id);
      setBatch(res.data.data);
      toast.success(t("hr.imports.committed"));
    } catch (err) {
      const message = apiErrorMessage(err, t("common.error"));
      setError(message);
      toast.error(t("hr.imports.notCommitted"), message);
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    setFiles([]);
    setBatch(null);
    setError(null);
  };

  const [review1, reviewRest = ""] = t("hr.imports.review").split("{leave}");
  const [review2, review3 = ""] = reviewRest.split("{files}");

  const isStaged = batch && batch.status === "staged";
  const isCommitted = batch && batch.status === "committed";

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="hr.imports.title"
        subtitle="hr.imports.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "hr.imports.crumb" },
            ]}
          />
        }
        actions={
          <Link href="/hr/imports/dry-run-source" className="btn-secondary text-sm">
            {t("hr.imports.dryRunLink")}
          </Link>
        }
      />

      <FormSection
        title="hr.imports.step1"
        description="hr.imports.step1Hint"
        icon="upload_file"
      >
        <div className="flex flex-col gap-3">
          <input
            type="file"
            multiple
            accept=".pdf,.xls,.xlsx"
            className="form-input"
            aria-label={t("hr.imports.fileInput")}
            disabled={busy !== null || isCommitted === true}
            onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
          />
          {files.length > 0 ? (
            <p className="text-xs text-neutral-600">{t("hr.imports.filesSelected", { count: files.length })}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={files.length === 0 || busy !== null || isCommitted === true}
              onClick={() => void stage()}
            >
              {busy === "stage" ? t("hr.imports.staging") : t("hr.imports.stage")}
            </button>
            {batch ? (
              <button type="button" className="btn-secondary text-sm" onClick={reset} disabled={busy !== null}>
                {t("hr.imports.newBatch")}
              </button>
            ) : null}
          </div>
        </div>
      </FormSection>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      {preview ? (
        <FormSection
          title="hr.imports.step2"
          description={t("hr.imports.batchStatus", { batch: batch?.batch_number ?? "", status: batch?.status ?? "" })}
          icon="fact_check"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-3">
              <div className="text-xs text-neutral-500">{t("hr.imports.stat.employees")}</div>
              <div className="text-lg font-semibold">{preview.employee_count ?? 0}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-neutral-500">{t("hr.imports.stat.newEmployees")}</div>
              <div className="text-lg font-semibold">{preview.employees_to_create?.length ?? 0}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-neutral-500">{t("hr.imports.stat.leaveTransactions")}</div>
              <div className="text-lg font-semibold">{preview.leave_transaction_count ?? 0}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-neutral-500">{t("hr.imports.stat.leaveBalances")}</div>
              <div className="text-lg font-semibold">{preview.leave_balance_rows ?? 0}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-neutral-500">{t("finance.hub.payslips")}</div>
              <div className="text-lg font-semibold">{preview.payslip_count ?? 0}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-neutral-500">{t("hr.imports.stat.assets")}</div>
              <div className="text-lg font-semibold">{preview.asset_count ?? 0}</div>
            </div>
          </div>

          {preview.legacy_profile_candidates && preview.legacy_profile_candidates.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="mb-2 font-medium">
                {t("hr.imports.legacy", { count: preview.legacy_profile_candidates.length })}
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {preview.legacy_profile_candidates.map((c) => (
                  <li key={c.employee_code}>
                    <span className="font-mono">{c.employee_code}</span> — {c.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.blocking_errors && preview.blocking_errors.length > 0 ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="mb-2 font-medium">{t("hr.imports.blocking")}</p>
              <ul className="list-disc space-y-1 pl-5">
                {preview.blocking_errors.map((c) => (
                  <li key={c.employee_code}>
                    <span className="font-mono">{c.employee_code}</span> — {c.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {isStaged ? (
            <div className="mt-4">
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={busy !== null || preview.ready === false}
                onClick={() => void commit()}
              >
                {busy === "commit" ? t("hr.imports.committing") : t("hr.imports.commit")}
              </button>
              <p className="mt-2 text-xs text-neutral-500">
                {t("hr.imports.commitHint")}
              </p>
            </div>
          ) : null}
        </FormSection>
      ) : null}

      {isCommitted && summary ? (
        <FormSection title="hr.imports.step3" icon="task_alt">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(summary).map(([key, value]) => (
              <div key={key} className="card p-3">
                <dt className="text-xs text-neutral-500">{key.replace(/_/g, " ")}</dt>
                <dd className="text-lg font-semibold">{String(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-neutral-600">
            {review1}
            <Link href="/hr/leave/balances" className="font-semibold text-primary-700 hover:opacity-80">
              {t("hr.imports.leaveBalances")}
            </Link>
            {review2}
            <Link href="/hr/files" className="font-semibold text-primary-700 hover:opacity-80">
              {t("hr.imports.employeeFiles")}
            </Link>
            {review3}
          </p>
        </FormSection>
      ) : null}
    </div>
  );
}
