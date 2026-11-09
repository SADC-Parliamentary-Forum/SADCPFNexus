"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hrDryRunSourceApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { FormSection } from "@/components/ui/FormSection";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { getStoredUser, isSystemAdmin } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HrDryRunSourceUploadPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const user = getStoredUser();
  if (!isSystemAdmin(user)) {
    return <AccessDenied path="/hr/imports/dry-run-source" reason={t("hr.imports.dryRun.accessReason")} />;
  }

  const [warn1, warn2 = ""] = t("hr.imports.dryRun.warning").split("{workflow}");
  const [once1, once2 = ""] = t("hr.imports.dryRun.onceStaged").split("{link}");

  const { data, isLoading } = useQuery({
    queryKey: ["hr-dry-run-source"],
    queryFn: async () => (await hrDryRunSourceApi.list()).data.data,
  });

  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      files.forEach((f) => form.append("files[]", f));
      return hrDryRunSourceApi.upload(form);
    },
    onSuccess: (res) => {
      const { stored, rejected } = res.data.data;
      setMessage(rejected.length ? t("hr.imports.dryRun.stagedRejected", { count: stored.length, rejected: rejected.join(", ") }) : t("hr.imports.dryRun.stagedCount", { count: stored.length }));
      setError(null);
      setFiles([]);
      qc.invalidateQueries({ queryKey: ["hr-dry-run-source"] });
      toast.success(t("hr.imports.dryRun.uploaded"), t("hr.imports.dryRun.stagedCount", { count: stored.length }));
    },
    onError: (err: unknown) => {
      setError(t("hr.imports.dryRun.uploadFailedDot"));
      toast.error(t("hr.imports.dryRun.uploadFailed"), apiErrorMessage(err, t("hr.imports.dryRun.uploadFailedDot")));
    },
  });

  const removeOne = useMutation({
    mutationFn: (name: string) => hrDryRunSourceApi.remove(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-dry-run-source"] });
      toast.success(t("hr.imports.dryRun.removed"));
    },
    onError: (err: unknown) => toast.error(t("hr.imports.dryRun.removeFailed"), apiErrorMessage(err, t("hr.imports.dryRun.removeFailedDot"))),
  });

  const clearAll = useMutation({
    mutationFn: () => hrDryRunSourceApi.clear(),
    onSuccess: (res) => {
      setMessage(res.data.message);
      qc.invalidateQueries({ queryKey: ["hr-dry-run-source"] });
      toast.success(t("hr.imports.dryRun.cleared"));
    },
    onError: (err: unknown) => toast.error(t("hr.imports.dryRun.clearFailed"), apiErrorMessage(err, t("hr.imports.dryRun.clearFailedDot"))),
  });

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="hr.imports.dryRunLink"
        subtitle="hr.imports.dryRun.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "hr.imports.crumb", href: "/hr/imports" },
              { label: "hr.imports.dryRunLink" },
            ]}
          />
        }
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {warn1}
        <span className="font-mono">HR historical migration — dry run</span>{/* i18n-ignore */}
        {warn2}
      </div>

      <FormSection title="common.upload" description="hr.imports.dryRun.uploadHint" icon="upload_file">
        <div className="flex flex-col gap-3">
          <input
            type="file"
            multiple
            accept=".pdf,.xls,.xlsx"
            className="form-input"
            aria-label={t("hr.imports.fileInput")}
            disabled={upload.isPending}
            onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
          />
          {files.length > 0 ? <p className="text-xs text-neutral-600">{t("hr.imports.filesSelected", { count: files.length })}</p> : null}
          <button
            type="button"
            className="btn-primary text-sm w-fit"
            disabled={files.length === 0 || upload.isPending}
            onClick={() => upload.mutate()}
          >
            {upload.isPending ? t("hr.imports.dryRun.uploading") : t("common.upload")}
          </button>
        </div>
      </FormSection>

      {message ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <FormSection
        title={t("hr.imports.dryRun.currentlyStaged", { count: data?.length ?? 0 })}
        icon="folder"
        actions={
          data && data.length > 0 ? (
            <button
              type="button"
              className="btn-secondary text-xs text-red-600"
              disabled={clearAll.isPending}
              onClick={() => clearAll.mutate()}
            >
              {clearAll.isPending ? t("hr.imports.dryRun.clearing") : t("hr.imports.dryRun.clearAll")}
            </button>
          ) : undefined
        }
      >
        {isLoading ? (
          <p className="text-sm text-neutral-500">{t("common.loading")}</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("hr.imports.dryRun.empty")}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("finance.payslips.col.file")}</th>
                <th>{t("hr.imports.dryRun.col.size")}</th>
                <th>{t("hr.imports.dryRun.col.uploaded")}</th>
                <th><span className="sr-only">{t("finance.budget.col.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {data.map((f) => (
                <tr key={f.name}>
                  <td className="font-mono text-xs">{f.name}</td>
                  <td>{formatBytes(f.size_bytes)}</td>
                  <td>{new Date(f.uploaded_at).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      disabled={removeOne.isPending}
                      onClick={() => removeOne.mutate(f.name)}
                    >
                      {t("hr.imports.dryRun.remove")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FormSection>

      <p className="text-sm text-neutral-600">
        {once1}
        <Link href="https://github.com/SADC-Parliamentary-Forum/SADCPFNexus/actions/workflows/hr-migration-dry-run.yml" className="font-semibold text-primary-700 hover:opacity-80">
          GitHub Actions {/* i18n-ignore */}
        </Link>
        {once2}
      </p>
    </div>
  );
}
