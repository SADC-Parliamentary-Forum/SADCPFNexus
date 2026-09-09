"use client";

import { FormEvent, useState } from "react";
import { leaveApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { FormSection } from "@/components/ui/FormSection";
import { ContentCanvas } from "@/components/ui/ContentCanvas";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { getStoredUser, canAccessRoute } from "@/lib/auth";

type ImportRow = Record<string, string | number | null>;
type ImportError = { row: number; message: string };
type ImportResult = {
  rows: ImportRow[];
  errors: ImportError[];
  created: number;
  skipped: number;
  balances: number;
};

function canImportLeave(): boolean {
  return canAccessRoute(getStoredUser(), "/hr/leave/import");
}

export default function LeaveImportPage() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | "template" | null>(null);

  if (!canImportLeave()) {
    return (
      <ContentCanvas>
        <ModulePageHeader
          title="leave.import.title"
          subtitle="leave.import.denied"
          breadcrumbs={
            <PageBreadcrumbs
              items={[
                { label: "hr.hub", href: "/hr" },
                { label: "leave.import.title" },
              ]}
            />
          }
        />
      </ContentCanvas>
    );
  }

  const run = async (commit: boolean) => {
    if (!file) {
      setError(t("leave.import.noFile"));
      return;
    }
    setBusy(commit ? "commit" : "preview");
    setError(null);
    setMessage(null);
    try {
      const res = await leaveApi.import(file, commit);
      setPreview(res.data.data);
      setMessage(res.data.message);
      if (commit && res.data.data.errors.length === 0) {
        setFile(null);
      }
    } catch (err: unknown) {
      const apiMessage =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setError(apiMessage || t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = async () => {
    setBusy("template");
    setError(null);
    try {
      const res = await leaveApi.importTemplate();
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "leave-import-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(false);
  };

  const leaveRows = preview?.rows.filter((row) => row.record_type === "leave") ?? [];
  const balanceRows = preview?.rows.filter((row) => row.record_type === "balance") ?? [];
  const canCommit = Boolean(
    file && preview && preview.errors.length === 0 && (preview.created > 0 || preview.balances > 0),
  );

  return (
    <ContentCanvas>
      <ModulePageHeader
        title="leave.import.title"
        subtitle="leave.import.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "hr.hub", href: "/hr" },
              { label: "Staff Leave Register", href: "/hr/leave" },
              { label: "leave.import.title" },
            ]}
          />
        }
        actions={
          <Button type="button" variant="secondary" size="sm" onClick={() => void downloadTemplate()} disabled={busy !== null}>
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t("leave.import.template")}
          </Button>
        }
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <FormSection title="leave.import.file" description="leave.import.hint" icon="upload_file">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-sm font-medium text-neutral-700" htmlFor="leave-import-file">
              {t("leave.import.file")}
              <input
                id="leave-import-file"
                type="file"
                accept=".csv,text/csv,text/plain"
                className="form-input mt-1"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                  setMessage(null);
                }}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="secondary" disabled={!file || busy !== null}>
                {busy === "preview" ? t("leave.import.previewing") : t("leave.import.preview")}
              </Button>
              <Button type="button" disabled={!canCommit || busy !== null} onClick={() => void run(true)}>
                {busy === "commit" ? t("leave.import.committing") : t("leave.import.commit")}
              </Button>
            </div>
          </div>
        </FormSection>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          {message}
        </div>
      ) : null}

      {preview ? (
        <FormSection
          title="leave.import.rows"
          description={`${t("leave.import.created")}: ${preview.created} · ${t("leave.import.skipped")}: ${preview.skipped} · ${t("leave.import.balances")}: ${preview.balances}`}
          icon="table_rows"
        >
          {preview.errors.length > 0 ? (
            <div className="mb-4 overflow-x-auto rounded-xl border border-red-100">
              <table className="w-full text-sm">
                <thead className="bg-red-50 text-left text-xs uppercase tracking-wide text-red-700">
                  <tr>
                    <th className="px-3 py-2">{t("leave.import.colRow")}</th>
                    <th className="px-3 py-2">{t("leave.import.errors")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.errors.map((row) => (
                    <tr key={`${row.row}-${row.message}`} className="border-t border-red-100">
                      <td className="px-3 py-2 font-medium">{row.row}</td>
                      <td className="px-3 py-2">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {leaveRows.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">{t("leave.import.colRow")}</th>
                    <th className="px-3 py-2">{t("leave.import.colName")}</th>
                    <th className="px-3 py-2">{t("leave.import.colEmail")}</th>
                    <th className="px-3 py-2">{t("leave.import.colLeaveType")}</th>
                    <th className="px-3 py-2">{t("leave.import.colDates")}</th>
                    <th className="px-3 py-2">{t("leave.import.colDays")}</th>
                    <th className="px-3 py-2">{t("leave.import.colStatus")}</th>
                    <th className="px-3 py-2">{t("leave.import.colDuplicate")}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRows.map((row) => (
                    <tr key={`leave-${row.row}`} className="border-t border-neutral-100">
                      <td className="px-3 py-2">{row.row}</td>
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2">{row.leave_type}</td>
                      <td className="px-3 py-2">
                        {row.start_date} – {row.end_date}
                      </td>
                      <td className="px-3 py-2">{row.days_requested}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">
                        {row.duplicate ? t("leave.import.duplicate") : t("leave.import.newRow")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {balanceRows.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">{t("leave.import.colRow")}</th>
                    <th className="px-3 py-2">{t("leave.import.colName")}</th>
                    <th className="px-3 py-2">{t("leave.import.colEmail")}</th>
                    <th className="px-3 py-2">{t("leave.import.colYear")}</th>
                    <th className="px-3 py-2">{t("leave.import.colAnnual")}</th>
                    <th className="px-3 py-2">{t("leave.import.colLil")}</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceRows.map((row) => (
                    <tr key={`balance-${row.row}`} className="border-t border-neutral-100">
                      <td className="px-3 py-2">{row.row}</td>
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2">{row.year}</td>
                      <td className="px-3 py-2">{row.annual_days}</td>
                      <td className="px-3 py-2">{row.lil_hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </FormSection>
      ) : null}
    </ContentCanvas>
  );
}
