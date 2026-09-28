"use client";

import { useState } from "react";
import Link from "next/link";
import { hrVipImportApi, type HrVipImportBatch } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { canAccessRoute, getStoredUser } from "@/lib/auth";

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

function apiErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return "Something went wrong. Please try again.";
}

export default function HistoricalLeavePayrollImportPage() {
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
      setError("Select at least one source file (PDF, XLS or XLSX).");
      return;
    }
    setBusy("stage");
    setError(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files[]", f));
      const res = await hrVipImportApi.upload(form);
      setBatch(res.data.data);
    } catch (err) {
      setError(apiErrorMessage(err));
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
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const reset = () => {
    setFiles([]);
    setBatch(null);
    setError(null);
  };

  const isStaged = batch && batch.status === "staged";
  const isCommitted = batch && batch.status === "committed";

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="Historical Leave & Payroll Import"
        subtitle="One-time or corrected historical migration from source HR/payroll reports (PDF, XLS, XLSX). Routine monthly uploads should use Staff Leave Register → Import instead."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "HR", href: "/hr" },
              { label: "Historical Import" },
            ]}
          />
        }
        actions={
          <Link href="/hr/imports/dry-run-source" className="btn-secondary text-sm">
            Dry-run source files
          </Link>
        }
      />

      <FormSection
        title="1. Upload source reports"
        description="Employee Basic, Employee Recon, Birthday List, Leave Basic, Leave History, Leave Detail, Leave Provision Movement, Payslip (PDF/XLSX), Remuneration List, 12-Month (XLS). Upload as many files as you have in one batch."
        icon="upload_file"
      >
        <div className="flex flex-col gap-3">
          <input
            type="file"
            multiple
            accept=".pdf,.xls,.xlsx"
            className="form-input"
            disabled={busy !== null || isCommitted === true}
            onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
          />
          {files.length > 0 ? (
            <p className="text-xs text-neutral-600">{files.length} file(s) selected.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={files.length === 0 || busy !== null || isCommitted === true}
              onClick={() => void stage()}
            >
              {busy === "stage" ? "Staging…" : "Stage & preview"}
            </button>
            {batch ? (
              <button type="button" className="btn-secondary text-sm" onClick={reset} disabled={busy !== null}>
                Start a new batch
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
          title="2. Review before commit"
          description={`Batch ${batch?.batch_number ?? ""} — status: ${batch?.status ?? ""}`}
          icon="fact_check"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-3">
              <div className="text-xs text-neutral-500">Employees referenced</div>
              <div className="text-lg font-semibold">{preview.employee_count ?? 0}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-neutral-500">New employees</div>
              <div className="text-lg font-semibold">{preview.employees_to_create?.length ?? 0}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-neutral-500">Leave transactions</div>
              <div className="text-lg font-semibold">{preview.leave_transaction_count ?? 0}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-neutral-500">Leave balance rows</div>
              <div className="text-lg font-semibold">{preview.leave_balance_rows ?? 0}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-neutral-500">Payslips</div>
              <div className="text-lg font-semibold">{preview.payslip_count ?? 0}</div>
            </div>
            <div className="card p-3">
              <div className="text-xs text-neutral-500">Asset register (unaffected)</div>
              <div className="text-lg font-semibold">{preview.asset_count ?? 0}</div>
            </div>
          </div>

          {preview.legacy_profile_candidates && preview.legacy_profile_candidates.length > 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="mb-2 font-medium">
                {preview.legacy_profile_candidates.length} employee code(s) not in the current staff master will be
                imported as reviewed legacy profiles (history preserved, no login):
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
              <p className="mb-2 font-medium">Blocking issues — resolve before commit:</p>
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
                {busy === "commit" ? "Committing…" : "Commit this batch"}
              </button>
              <p className="mt-2 text-xs text-neutral-500">
                Committing creates/updates employee records, leave history, balances and payslips. Login remains
                disabled for every imported identity.
              </p>
            </div>
          ) : null}
        </FormSection>
      ) : null}

      {isCommitted && summary ? (
        <FormSection title="3. Commit summary" icon="task_alt">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(summary).map(([key, value]) => (
              <div key={key} className="card p-3">
                <dt className="text-xs text-neutral-500">{key.replace(/_/g, " ")}</dt>
                <dd className="text-lg font-semibold">{String(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-neutral-600">
            Review imported records in{" "}
            <Link href="/hr/leave/balances" className="text-primary-700 underline">
              Leave balances
            </Link>{" "}
            and{" "}
            <Link href="/hr/files" className="text-primary-700 underline">
              Employee files
            </Link>
            .
          </p>
        </FormSection>
      ) : null}
    </div>
  );
}
