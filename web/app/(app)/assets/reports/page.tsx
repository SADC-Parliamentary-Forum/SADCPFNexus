"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AssetAssigneePicker } from "@/components/assets/AssetAssigneePicker";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import {
  assetsApi,
  type AssetAssignedToUserReport,
  type AssetReportCatalogueItem,
  type TenantUserOption,
} from "@/lib/api";
import {
  displayReportValue,
  filterCatalogue,
  modeI18nKey,
  presentFamilies,
  reportHref,
  reportNeedsCampaign,
  reportNeedsPeriod,
  reportNeedsStaff,
  reportRowKey,
  REPORT_MODES,
  familyI18nKey,
  type ReportMode,
} from "@/lib/asset-report-catalogue";
import { registerExportQuery } from "@/lib/asset-register-print";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const [catalogue, setCatalogue] = useState<AssetReportCatalogueItem[]>([]);
  const [family, setFamily] = useState("all");
  const [staff, setStaff] = useState<TenantUserOption | null>(null);
  const [mode, setMode] = useState<ReportMode>("current");
  const [asOf, setAsOf] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<AssetAssignedToUserReport | null>(null);
  const [selectedId, setSelectedId] = useState("R01");
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    assetsApi.reportCatalogue()
      .then((res) => setCatalogue(res.data.data ?? []))
      .catch(() => setCatalogue([]));
  }, []);

  const families = useMemo(() => presentFamilies(catalogue), [catalogue]);
  const visible = useMemo(() => filterCatalogue(catalogue, family), [catalogue, family]);

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

  async function runAssigned(reportId = selectedId) {
    if (reportNeedsStaff(reportId) && !staff) {
      setMsg(t("assets.reports.pickStaff"));
      return;
    }
    setRunning(true);
    setMsg(null);
    try {
      const res = await assetsApi.runGovernedReport({
        report_id: reportId,
        user_id: staff?.id,
        staff_number: staff?.employee_number || undefined,
        mode: reportId === "R02" ? "current" : mode,
        as_of: mode === "as_of" && asOf ? asOf : undefined,
        from: reportNeedsPeriod(reportId) && from ? from : undefined,
        to: reportNeedsPeriod(reportId) && to ? to : undefined,
        campaign_id: reportNeedsCampaign(reportId) && campaignId ? Number(campaignId) : undefined,
      });
      setSelectedId(reportId);
      setReport(res.data);
    } catch {
      setMsg(t("assets.reports.runFailed"));
    } finally {
      setRunning(false);
    }
  }

  async function exportReport(format: "pdf" | "xlsx" | "csv", official = true, intent: "export" | "print" = "export") {
    if (reportNeedsStaff(selectedId) && !staff) {
      setMsg(t("assets.reports.pickStaff"));
      return;
    }
    setExporting(`${format}-${intent}`);
    setMsg(null);
    try {
      const res = await assetsApi.exportGovernedReport({
        report_id: selectedId,
        format,
        official,
        intent,
        user_id: staff?.id,
        staff_number: staff?.employee_number || undefined,
        mode: selectedId === "R02" ? "current" : mode,
        as_of: mode === "as_of" && asOf ? asOf : undefined,
        from: reportNeedsPeriod(selectedId) && from ? from : undefined,
        to: reportNeedsPeriod(selectedId) && to ? to : undefined,
        campaign_id: reportNeedsCampaign(selectedId) && campaignId ? Number(campaignId) : undefined,
      });
      const blob = res.data as Blob;
      const type = (blob.type || "").toLowerCase();
      if (type.includes("json")) {
        setMsg(t("assets.reports.exportFailed"));
        return;
      }
      downloadBlob(blob, `SADC_PF_${selectedId}_${new Date().toISOString().slice(0, 10)}.${format}`);
    } catch {
      setMsg(t("assets.reports.exportFailed"));
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.reports.title"
        subtitle="assets.reports.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.reports.title") }]} />}
      />
      {msg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {msg}
        </div>
      )}

      <section id="asset-report-r01" className="card p-5 space-y-4" data-testid="asset-reports-r01">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{report?.title ?? t("assets.reports.assignedToUser")}</h2>
          <p className="mt-1 text-sm text-neutral-500">{t("assets.reports.assignedToUserHint")}</p>
        </div>
        {reportNeedsStaff(selectedId) ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AssetAssigneePicker
              id="asset-reports-staff"
              label={t("assets.reports.staff")}
              value={staff}
              onSelect={setStaff}
              required
              hint={t("assets.reports.pickStaff")}
            />
            <div>
              <label htmlFor="asset-reports-mode" className="block text-xs font-medium text-neutral-700 mb-1">
                {t("assets.reports.mode")}
              </label>
              <select
                id="asset-reports-mode"
                className="form-input text-sm w-full"
                value={mode}
                onChange={(e) => setMode(e.target.value as ReportMode)}
                data-testid="asset-reports-r01-mode"
              >
                {REPORT_MODES.map((value) => (
                  <option key={value} value={value}>{t(modeI18nKey(value))}</option>
                ))}
              </select>
            </div>
            {mode === "as_of" ? (
              <div>
                <label htmlFor="asset-reports-as-of" className="block text-xs font-medium text-neutral-700 mb-1">
                  {t("assets.reports.asOf")}
                </label>
                <input
                  id="asset-reports-as-of"
                  type="datetime-local"
                  className="form-input text-sm w-full"
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                  data-testid="asset-reports-r01-as-of"
                />
              </div>
            ) : null}
          </div>
        ) : null}
        {reportNeedsPeriod(selectedId) ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="asset-reports-from" className="block text-xs font-medium text-neutral-700 mb-1">
                {t("assets.reports.periodFrom")}
              </label>
              <input
                id="asset-reports-from"
                type="date"
                className="form-input text-sm w-full"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                data-testid="asset-reports-from"
              />
            </div>
            <div>
              <label htmlFor="asset-reports-to" className="block text-xs font-medium text-neutral-700 mb-1">
                {t("assets.reports.periodTo")}
              </label>
              <input
                id="asset-reports-to"
                type="date"
                className="form-input text-sm w-full"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                data-testid="asset-reports-to"
              />
            </div>
          </div>
        ) : null}
        {reportNeedsCampaign(selectedId) ? (
          <div className="max-w-xs">
            <label htmlFor="asset-reports-campaign" className="block text-xs font-medium text-neutral-700 mb-1">
              {t("assets.reports.campaignId")}
            </label>
            <input
              id="asset-reports-campaign"
              type="number"
              className="form-input text-sm w-full"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              data-testid="asset-reports-campaign"
            />
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={running || (reportNeedsStaff(selectedId) && !staff)}
            onClick={() => void runAssigned()}
            data-testid="asset-reports-r01-run"
          >
            {running ? t("assets.reports.preparing") : t("assets.reports.run")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={exporting !== null || (reportNeedsStaff(selectedId) && !staff)}
            onClick={() => void exportReport("pdf", true, "print")}
            data-testid="asset-reports-r01-print"
          >
            {exporting === "pdf-print" ? t("assets.reports.preparing") : t("assets.reports.printStatement")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={exporting !== null || (reportNeedsStaff(selectedId) && !staff)}
            onClick={() => void exportReport("pdf")}
            data-testid="asset-reports-r01-pdf"
          >
            {exporting === "pdf-export" ? t("assets.reports.preparing") : t("assets.reports.exportOfficialPdf")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={exporting !== null || (reportNeedsStaff(selectedId) && !staff)}
            onClick={() => void exportReport("xlsx")}
            data-testid="asset-reports-r01-xlsx"
          >
            {exporting === "xlsx-export" ? t("assets.reports.preparing") : t("assets.reports.exportXlsx")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={exporting !== null || (reportNeedsStaff(selectedId) && !staff)}
            onClick={() => void exportReport("csv", false)}
            data-testid="asset-reports-r01-csv"
          >
            {exporting === "csv-export" ? t("assets.reports.preparing") : t("assets.reports.exportCsv")}
          </button>
        </div>
        {report ? (
          <div className="space-y-3" data-testid="asset-reports-r01-results">
            <p className="text-xs text-neutral-500">
              {t("assets.reports.runMeta", {
                id: report.run.report_run_id,
                when: report.run.generated_at,
                asOf: report.run.data_as_of,
              })}
              {" · "}
              {report.run.official ? t("assets.reports.official") : t("assets.reports.draft")}
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-neutral-100 px-3 py-1">{t("assets.reports.totalCount")}: {report.totals.count}</span>
              {report.totals.unacknowledged != null ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{t("assets.reports.totalUnacknowledged")}: {report.totals.unacknowledged}</span>
              ) : null}
              {report.totals.overdue != null ? (
                <span className="rounded-full bg-red-50 px-3 py-1 text-red-800">{t("assets.reports.totalOverdue")}: {report.totals.overdue}</span>
              ) : null}
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="data-table min-w-full text-sm">
                <thead>
                  <tr>
                    {(report.columns ?? []).map((column) => (
                      <th key={column.key}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.data.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(report.columns?.length ?? 1, 1)} className="px-3 py-6 text-center text-neutral-500">{t("assets.reports.empty")}</td>
                    </tr>
                  ) : report.data.map((row, index) => (
                    <tr key={reportRowKey(row as unknown as Record<string, unknown>, index)}>
                      {(report.columns ?? []).map((column) => {
                        const value = (row as unknown as Record<string, unknown>)[column.key];
                        if (column.key === "asset_tag" && row.asset_id) {
                          return (
                            <td key={column.key}>
                              <Link href={`/assets/${row.asset_id}`} className="text-primary font-medium">
                                {displayReportValue(value ?? row.asset_id)}
                              </Link>
                            </td>
                          );
                        }
                        return <td key={column.key}>{displayReportValue(value)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <div className="card p-5 space-y-4">
        <h2 className="text-base font-semibold text-neutral-900">{t("assets.reports.registerPack")}</h2>
        <p className="text-sm text-neutral-500">{t("assets.reports.registerHint")}</p>
        <div className="max-w-xs">
          <label htmlFor="assets-reports-field" className="block text-xs font-semibold text-neutral-600 mb-1">{t("assets.reports.status")}</label>
          <select
            id="assets-reports-field"
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

      <section className="card p-5 space-y-4" data-testid="asset-reports-catalogue">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">{t("assets.reports.catalogue")}</h2>
          <p className="mt-1 text-sm text-neutral-500">{t("assets.reports.catalogueHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("assets.reports.catalogue")}>
          <button
            type="button"
            className={`filter-tab ${family === "all" ? "active" : ""}`}
            onClick={() => setFamily("all")}
          >
            {t("assets.reports.familyAll")}
          </button>
          {families.map((name) => (
            <button
              key={name}
              type="button"
              className={`filter-tab ${family === name ? "active" : ""}`}
              onClick={() => setFamily(name)}
            >
              {t(familyI18nKey(name))}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="data-table min-w-full text-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t("assets.reports.catalogue")}</th>
                <th>{t("assets.reports.familyAll")}</th>
                <th>{t("assets.reports.priorityMust")}</th>
                <th>{t("assets.reports.formats")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const href = reportHref(item.id);
                return (
                  <tr key={item.id} data-report-id={item.id}>
                    <td className="font-mono text-xs">{item.id}</td>
                    <td>
                      {href ? (
                        <button
                          type="button"
                          className="text-primary font-medium text-left"
                          onClick={() => {
                            setSelectedId(item.id);
                            if (!reportNeedsStaff(item.id) || staff) {
                              void runAssigned(item.id);
                            }
                          }}
                        >
                          {item.name}
                        </button>
                      ) : (
                        <span className="font-medium text-neutral-900">{item.name}</span>
                      )}
                      <p className="text-xs text-neutral-500 mt-0.5">{item.purpose}</p>
                      {item.blocked_reason ? (
                        <p className="text-xs text-amber-800 mt-0.5" data-testid={`asset-report-blocked-${item.id.toLowerCase()}`}>
                          {item.blocked_reason}
                        </p>
                      ) : null}
                    </td>
                    <td>{t(familyI18nKey(item.family))}</td>
                    <td>{item.priority === "must" ? t("assets.reports.priorityMust") : t("assets.reports.priorityShould")}</td>
                    <td className="text-xs text-neutral-500">{item.formats.join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
