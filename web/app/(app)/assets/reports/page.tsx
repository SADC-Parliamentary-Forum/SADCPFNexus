"use client";

import { useState } from "react";
import Link from "next/link";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { assetsApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { registerExportQuery } from "@/lib/asset-register-print";

function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AssetReportsPage() {
  const { t } = useI18n();
  const [busy, setBusy] = useState<"csv" | "xlsx" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [status, setStatus] = useState("live");

  async function download(format: "csv" | "xlsx") {
    setBusy(format);
    setMsg(null);
    try {
      const res = await assetsApi.registerExport({
        ...registerExportQuery([], { status }),
        format,
      });
      const blob = res.data as Blob;
      const type = (blob.type || "").toLowerCase();
      const peek = await blob.slice(0, 8).text();
      if (type.includes("json") || peek.trim().startsWith("{")) {
        setMsg(t("assets.reports.failed"));
        return;
      }
      const ext = format === "xlsx" ? "xlsx" : "csv";
      downloadBlob(blob, `fixed-asset-register-${new Date().toISOString().slice(0, 10)}.${ext}`);
    } catch {
      setMsg(t("assets.reports.failed"));
    } finally {
      setBusy(null);
    }
  }

  const packs = [
    {
      href: "/assets/depreciation",
      title: t("assets.reports.packDepreciation"),
      hint: t("assets.reports.packDepreciationHint"),
      icon: "trending_down",
    },
    {
      href: "/assets/disposal",
      title: t("assets.reports.packDisposal"),
      hint: t("assets.reports.packDisposalHint"),
      icon: "delete_forever",
    },
    {
      href: "/assets/verification",
      title: t("assets.reports.packVerification"),
      hint: t("assets.reports.packVerificationHint"),
      icon: "fact_check",
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.reports.title"
        subtitle="assets.reports.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.reports.title") }]} />}
      />
      {msg && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{msg}</div>}
      <div className="card p-5 space-y-4">
        <h2 className="text-base font-semibold text-neutral-900">{t("assets.reports.registerPack")}</h2>
        <p className="text-sm text-neutral-500">{t("assets.reports.registerHint")}</p>
        <div className="max-w-xs">
          <label htmlFor="assets-reports-field" className="block text-xs font-semibold text-neutral-600 mb-1">{t("assets.reports.status")}</label>
          <select id="assets-reports-field"
            className="form-input text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            data-testid="asset-reports-status"
          >
            <option value="live">{t("assets.register.live")}</option>
            <option value="all">{t("assets.register.allStatuses")}</option>
            <option value="pending">{t("assets.register.pendingCapitalisation")}</option>
            <option value="active">{t("assets.register.active")}</option>
            <option value="retired">{t("assets.register.retiredStatus")}</option>
            <option value="disposed">{t("assets.register.disposed")}</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary"
            disabled={busy !== null}
            onClick={() => void download("csv")}
            data-testid="asset-reports-download-csv"
          >
            {busy === "csv" ? t("assets.reports.preparing") : t("assets.reports.downloadCsv")}
          </button>
          <button
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => void download("xlsx")}
            data-testid="asset-reports-download-excel"
          >
            {busy === "xlsx" ? t("assets.reports.preparing") : t("assets.reports.downloadExcel")}
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {packs.map((pack) => (
          <Link key={pack.href} href={pack.href} className="card p-4 hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">{pack.icon}</span>
              <h3 className="text-sm font-semibold text-neutral-900">{pack.title}</h3>
            </div>
            <p className="mt-2 text-xs text-neutral-500">{pack.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
