"use client";

import { FormEvent, useState } from "react";
import { hrVipImportApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { ContentCanvas } from "@/components/ui/ContentCanvas";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { canAccessRoute, getStoredUser } from "@/lib/auth";

type Preview = {
  employee_count?: number;
  leave_transaction_count?: number;
  payslip_count?: number;
  asset_count?: number;
  blocking_errors?: { employee_code: string; message: string }[];
  ready?: boolean;
};

export default function HrVipImportPage() {
  const { t } = useI18n();
  const [files, setFiles] = useState<FileList | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "commit" | null>(null);

  if (!canAccessRoute(getStoredUser(), "/hr/imports")) {
    return (
      <ContentCanvas>
        <ModulePageHeader title="HR VIP import" subtitle="Access denied." />
      </ContentCanvas>
    );
  }

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!files?.length) {
      setError("Select at least one Sage VIP export file.");
      return;
    }
    setBusy("upload");
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("files[]", file));
      const res = await hrVipImportApi.upload(form);
      setBatchId(res.data.data.id);
      setPreview(res.data.data.preview ?? null);
      setMessage(res.data.message);
    } catch (err: unknown) {
      setError(t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!batchId) return;
    setBusy("commit");
    setError(null);
    try {
      const res = await hrVipImportApi.commit(batchId);
      setMessage(res.data.message);
    } catch {
      setError("Commit failed. Resolve preview errors first.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ContentCanvas>
      <ModulePageHeader
        title="HR VIP import"
        subtitle="Upload Sage VIP employee, leave, and payroll exports. Commit order: employees, leave, payslips."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "hr.hub", href: "/hr" }, { label: "HR VIP import" }]} />
        }
      />
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <form onSubmit={upload} className="card space-y-3 p-4">
        <label className="block text-sm">
          Sage VIP files (PDF / XLS)
          <input
            type="file"
            multiple
            accept=".pdf,.xls,.xlsx"
            className="form-input mt-1"
            onChange={(e) => setFiles(e.target.files)}
          />
        </label>
        <Button type="submit" disabled={busy === "upload"}>
          {busy === "upload" ? "Staging…" : "Stage & preview"}
        </Button>
      </form>

      {preview && (
        <div className="card space-y-2 p-4 text-sm">
          <p>Employees: {preview.employee_count}</p>
          <p>Leave transactions: {preview.leave_transaction_count}</p>
          <p>Payslips: {preview.payslip_count}</p>
          <p>Asset register rows (unchanged): {preview.asset_count}</p>
          {(preview.blocking_errors ?? []).length > 0 && (
            <ul className="list-disc pl-5 text-red-700">
              {preview.blocking_errors!.map((e) => (
                <li key={e.employee_code}>{e.employee_code}: {e.message}</li>
              ))}
            </ul>
          )}
          <Button
            type="button"
            disabled={!preview.ready || busy === "commit"}
            onClick={() => void commit()}
          >
            {busy === "commit" ? "Committing…" : "Commit import"}
          </Button>
        </div>
      )}
    </ContentCanvas>
  );
}
