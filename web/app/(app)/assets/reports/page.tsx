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
  filterCatalogue,
  modeI18nKey,
  presentFamilies,
  reportHref,
  reportNeedsStaff,
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
        mode: reportId === "R02" ? "current" : mode,
        as_of: mode === "as_of" && asOf ? asOf : undefined,
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
        mode: selectedId === "R02" ? "current" : mode,
        as_of: mode === "as_of" && asOf ? asOf : undefined,
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
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">{t("assets.reports.totalUnacknowledged")}: {report.totals.unacknowledged}</span>
              <span className="rounded-full bg-red-50 px-3 py-1 text-red-800">{t("assets.reports.totalOverdue")}: {report.totals.overdue}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-neutral-200">
              <table className="data-table min-w-full text-sm">
                <thead>
                  <tr>
                    <th>{t("assets.reports.colTag")}</th>
                    <th>{t("assets.reports.colDescription")}</th>
                    <th>{t("assets.reports.colClass")}</th>
                    <th>{t("assets.reports.colSerial")}</th>
                    <th>{t("assets.reports.colType")}</th>
                    <th>{t("assets.reports.colIssueDate")}</th>
                    <th>{t("assets.reports.colExpectedReturn")}</th>
                    <th>{t("assets.reports.colLocation")}</th>
                    <th>{t("assets.reports.colCondition")}</th>
                    <th>{t("assets.reports.colAck")}</th>
                    <th>{t("assets.reports.colStatus")}</th>
                    {report.data.some((row) => "book_value" in row) ? <th>{t("assets.register.bookValue")}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {report.data.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-3 py-6 text-center text-neutral-500">{t("assets.reports.empty")}</td>
                    </tr>
                  ) : report.data.map((row) => (
                    <tr key={row.assignment_id}>
                      <td>
                        {row.asset_id ? (
                          <Link href={`/assets/${row.asset_id}`} className="text-primary font-medium">
                            {row.asset_tag ?? row.asset_id}
                          </Link>
                        ) : (row.asset_tag ?? "—")}
                      </td>
                      <td>{row.description ?? "—"}</td>
                      <td>{row.class ?? "—"}</td>
                      <td>{row.serial_number ?? "—"}</td>
                      <td>{row.assignment_type}</td>
                      <td>{row.issue_date ?? "—"}</td>
                      <td>{row.expected_return ?? "—"}</td>
                      <td>{row.location ?? "—"}</td>
                      <td>{row.condition ?? "—"}</td>
                      <td>{row.acknowledgement_status}</td>
                      <td>{row.asset_status ?? "—"}</td>
                      {"book_value" in row ? <td>{row.book_value ?? "—"}</td> : null}
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
