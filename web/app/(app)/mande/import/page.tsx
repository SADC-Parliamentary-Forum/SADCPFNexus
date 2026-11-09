"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { mandeApi, type MeImportPreview } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function MandeImportPage() {
  const user = getStoredUser();
  const { t } = useI18n();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "mande.admin");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MeImportPreview | null>(null);

  const previewMut = useMutation({
    mutationFn: (f: File) => mandeApi.previewImport(f).then((r) => r.data.data),
    onSuccess: setPreview,
  });

  const commitMut = useMutation({
    mutationFn: (f: File) => mandeApi.commitImport(f).then((r) => r.data),
    onSuccess: () => {
      setPreview(null);
      setFile(null);
    },
  });

  if (!canAdmin) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title={t("mande.import.title")}
          subtitle={t("mande.import.noPermission")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.mande", href: "/mande" }, { label: t("mande.import.title") }]} />}
        />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("mande.import.title")}
        subtitle={t("mande.import.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.mande", href: "/mande" }, { label: t("mande.import.title") }]} />}
      />

      <div className="card p-5 space-y-4">
        <input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label={t("mande.import.file")}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(null);
          }}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-40"
            disabled={!file || previewMut.isPending}
            onClick={() => file && previewMut.mutate(file)}
          >
            {t("mande.import.preview")}
          </button>
          <button
            type="button"
            className="btn-primary text-sm disabled:opacity-40"
            disabled={!file || !preview || preview.valid === 0 || commitMut.isPending}
            onClick={() => file && commitMut.mutate(file)}
          >
            {preview ? t("mande.import.commitCount", { count: preview.valid }) : t("mande.import.commit")}
          </button>
        </div>
        {previewMut.isError && (
          <p className="text-sm text-red-600">{t("mande.import.previewFailed")}</p>
        )}
        {commitMut.isSuccess && (
          <p className="text-sm text-green-700">
            {commitMut.data.message}
          </p>
        )}
      </div>

      {preview && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-100 flex gap-4 text-sm">
            <span>{t("mande.import.valid", { count: preview.valid })}</span>
            <span>{t("mande.import.invalid", { count: preview.invalid })}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("mande.import.line")}</th>
                <th>{t("mande.col.title")}</th>
                <th>{t("mande.import.pifReason")}</th>
                <th>{t("correspondence.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.line}>
                  <td className="text-xs">{row.line}</td>
                  <td className="text-sm">{row.data.activity_title}</td>
                  <td className="text-xs">
                    {row.data.pif_number || row.data.non_pif_reason || "—"}
                  </td>
                  <td className="text-xs">
                    {row.ok ? (
                      <span className="badge-success">{t("mande.import.ok")}</span>
                    ) : (
                      <span className="badge-danger">{Object.values(row.errors).join("; ")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
