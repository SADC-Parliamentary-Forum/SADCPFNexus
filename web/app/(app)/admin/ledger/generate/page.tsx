"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import Link from "next/link";
import { auditLogsApi, type AuditLogEntry } from "@/lib/api";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { TranslateVars } from "@/lib/i18n/messages";

type Translate = (key: string, vars?: TranslateVars) => string;

// â”€â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MODULES = [
  { value: "",             label: "admin.access.matrix.allModules" },
  { value: "admin",        label: "admin.homeLabel" },
  { value: "hr",           label: "admin.ledgerGen.mod.hr" },
  { value: "finance",      label: "nav.finance" },
  { value: "travel",       label: "nav.travel" },
  { value: "leave",        label: "nav.leave" },
  { value: "imprest",      label: "nav.imprest" },
  { value: "procurement",  label: "nav.procurement" },
  { value: "governance",   label: "admin.access.governance.crumb" },
  { value: "assets",       label: "admin.ledger.mod.assets" },
];

const SCOPES = [
  { value: "global",  label: "admin.ledgerGen.scope.global", desc: "admin.ledgerGen.scope.globalDesc", icon: "public" },
  { value: "module",  label: "admin.ledgerGen.scope.module", desc: "admin.ledgerGen.scope.moduleDesc", icon: "view_module" },
  { value: "user",    label: "admin.ledgerGen.scope.user",   desc: "admin.ledgerGen.scope.userDesc",   icon: "person_search" },
];

const EVENT_TYPES = [
  { value: "access",   label: "admin.ledgerGen.event.access",   hint: "admin.ledgerGen.event.accessHint",   actions: ["login", "logout"] },
  { value: "change",   label: "admin.ledgerGen.event.change",   hint: "admin.ledgerGen.event.changeHint",   actions: ["created", "updated", "approved", "rejected", "submitted"] },
  { value: "deletion", label: "admin.ledgerGen.event.deletion", hint: "admin.ledgerGen.event.deletionHint", actions: ["deleted"] },
];

const FORMATS = [
  { value: "csv", label: "admin.ledgerGen.format.csv", desc: "admin.ledgerGen.format.csvDesc", icon: "table_view",      iconColor: "text-green-600" },
  { value: "pdf", label: "admin.ledgerGen.format.pdf", desc: "admin.ledgerGen.format.pdfDesc", icon: "picture_as_pdf",  iconColor: "text-red-500" },
];

const STEPS = ["admin.ledgerGen.step.parameters", "admin.ledgerGen.step.preview", "admin.ledgerGen.step.export"];

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatTs(ts: string) {
  return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function entryHash(e: AuditLogEntry): string {
  const seed = `${e.id}-${e.action}-${e.created_at}-${e.user_name ?? ""}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const hex = Math.abs(h).toString(16).padStart(8, "0");
  const exp = (hex + hex.split("").reverse().join("")).slice(0, 16);
  return `${exp.slice(0, 8)}…${exp.slice(-4)}`;
}

function exportCsv(logs: AuditLogEntry[], title: string, t: Translate) {
  const headers = [
    "#",
    t("admin.governance.colTimestamp"),
    t("admin.common.user"),
    t("admin.common.email"),
    t("admin.common.module"),
    t("admin.governance.colAction"),
    t("admin.ledger.csv.recordRef"),
    t("admin.ledger.csv.ip"),
    t("admin.ledger.entryHash"),
  ];
  const rows = logs.map((l, i) => [
    i + 1,
    `"${formatTs(l.created_at)}"`,
    `"${l.user_name ?? t("admin.payslipConfig.system")}"`,
    `"${l.user_email ?? ""}"`,
    l.module ?? "",
    l.action,
    l.record_id ?? "",
    l.ip_address ?? "",
    entryHash(l),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-report-${title.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPdf(logs: AuditLogEntry[], title: string, dateFrom: string, dateTo: string, t: Translate) {
  const rows = logs.map((l, i) => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:6px 8px;font-size:11px;color:#9ca3af">${i + 1}</td>
      <td style="padding:6px 8px;font-size:11px;font-family:monospace">${formatTs(l.created_at)}</td>
      <td style="padding:6px 8px;font-size:11px">${l.user_name ?? t("admin.payslipConfig.system")}</td>
      <td style="padding:6px 8px;font-size:11px">${l.module ?? "—"}</td>
      <td style="padding:6px 8px;font-size:11px;font-weight:600">${l.action}</td>
      <td style="padding:6px 8px;font-size:11px;font-family:monospace;color:#6b7280">${l.record_id ?? "—"}</td>
      <td style="padding:6px 8px;font-size:11px;font-family:monospace;color:#9ca3af">${entryHash(l)}</td>
    </tr>`).join(""); // i18n-ignore

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:sans-serif;margin:24px;color:#111}h1{font-size:20px;font-weight:900;margin-bottom:4px}/* i18n-ignore */
.meta{font-size:12px;color:#6b7280;margin-bottom:16px}table{width:100%;border-collapse:collapse}
thead{background:#f9fafb}th{padding:6px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;text-align:left;border-bottom:2px solid #e5e7eb}
tfoot td{font-size:11px;color:#9ca3af;padding:8px}@media print{body{margin:8px}}</style></head>
<body>
<h1>SADCPFNexus — ${title}</h1><!-- i18n-ignore -->
<div class="meta">${t("admin.ledgerGen.pdf.meta", { generated: new Date().toLocaleString("en-GB"), from: dateFrom || t("admin.ledgerGen.allTime"), to: dateTo || t("admin.ledgerGen.present"), count: logs.length })}</div>
<table>
<thead><tr>
  <th>#</th><th>${t("admin.governance.colTimestamp")}</th><th>${t("admin.common.user")}</th><th>${t("admin.common.module")}</th><th>${t("admin.governance.colAction")}</th><th>${t("admin.ledger.csv.recordRef")}</th><th>${t("admin.ledgerGen.hash")}</th>
</tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="7">${t("admin.ledgerGen.pdf.footer")}</td></tr></tfoot>
</table>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    URL.revokeObjectURL(url);
    return;
  }

  const cleanup = () => URL.revokeObjectURL(url);
  win.addEventListener("load", () => {
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  }, { once: true });
  win.addEventListener("afterprint", cleanup, { once: true });
  setTimeout(cleanup, 60_000);
}

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function GenerateLedgerReportPage() {
  const { t } = useI18n();
  const [step, setStep] = useState(0);

  // Step 0: Parameters
  const [scope, setScope]             = useState("global");
  const [moduleFilter, setModuleFilter] = useState("");
  const [userFilter, setUserFilter]   = useState("");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [eventTypes, setEventTypesState] = useState<string[]>(["access", "change"]);
  const [format, setFormat]           = useState("csv");

  // Step 1: Preview
  const [previewLogs, setPreviewLogs] = useState<AuditLogEntry[]>([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Derived
  const selectedModule = scope === "module" ? moduleFilter : "";
  const selectedModuleLabel = t(MODULES.find((m) => m.value === selectedModule)?.label ?? "admin.common.module");
  const reportTitle = scope === "global"
    ? t("admin.ledgerGen.title.integrity")
    : scope === "module" && selectedModule
    ? t("admin.ledgerGen.title.module", { module: selectedModuleLabel })
    : scope === "user"
    ? t("admin.ledgerGen.title.user")
    : t("admin.ledgerGen.title.generic");

  const toggleEventType = (v: string) =>
    setEventTypesState((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  const buildParams = () => {
    const params: Record<string, string | number> = { per_page: 100 };
    if (selectedModule) params.module = selectedModule;
    if (scope === "user" && userFilter) params.user = userFilter;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo)   params.date_to   = dateTo;
    // Action filter — collect all actions for selected event types
    const actions = EVENT_TYPES.filter((et) => eventTypes.includes(et.value)).flatMap((et) => et.actions);
    if (actions.length > 0 && actions.length < EVENT_TYPES.flatMap((e) => e.actions).length) {
      params.action = actions.join(",");
    }
    return params;
  };

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditLogsApi.list(buildParams());
      setPreviewLogs(res.data.data ?? []);
      setPreviewTotal(res.data.total ?? 0);
      setStep(1);
    } catch {
      setError(t("admin.ledgerGen.previewFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (format === "csv") {
      exportCsv(previewLogs, reportTitle, t);
    } else {
      exportPdf(previewLogs, reportTitle, dateFrom, dateTo, t);
    }
    setStep(2);
  };

  // â”€â”€â”€ Step 0: Parameters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderStep0 = () => (
    <div className="space-y-8">
      {/* 1. Scope */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-neutral-900">{t("admin.ledgerGen.section.scope")}</h3>
        <div className="space-y-2">
          {SCOPES.map((s) => (
            <label htmlFor={`admin-ledger-generate-scope-${s.value}`} key={s.value} className={cn(
              "flex items-start gap-4 rounded-xl border p-4 cursor-pointer transition-all",
              scope === s.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-neutral-200 bg-white hover:border-neutral-300",
            )}>
              <input id={`admin-ledger-generate-scope-${s.value}`} type="radio" name="scope" value={s.value} checked={scope === s.value}
                onChange={() => setScope(s.value)} className="mt-0.5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-900">{t(s.label)}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{t(s.desc)}</p>
              </div>
              <span className={cn("material-symbols-outlined text-[22px]", scope === s.value ? "text-primary" : "text-neutral-300")}>
                {s.icon}
              </span>
            </label>
          ))}
        </div>
        {scope === "module" && (
          <div className="mt-2 rounded-lg bg-neutral-50 border border-neutral-200 p-4">
            <label htmlFor="admin-ledger-generate-target-module" className="block text-xs font-semibold text-neutral-600 mb-1.5">{t("admin.ledgerGen.targetModule")}</label>
            <select id="admin-ledger-generate-target-module" className="form-input" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              {MODULES.map((m) => <option key={m.value} value={m.value}>{t(m.label)}</option>)}
            </select>
          </div>
        )}
        {scope === "user" && (
          <div className="mt-2 rounded-lg bg-neutral-50 border border-neutral-200 p-4">
            <label htmlFor="admin-ledger-generate-user-name-or-email" className="block text-xs font-semibold text-neutral-600 mb-1.5">{t("admin.ledgerGen.userLabel")}</label>
            <input id="admin-ledger-generate-user-name-or-email" className="form-input" placeholder={t("admin.ledgerGen.userPlaceholder")}
              value={userFilter} onChange={(e) => setUserFilter(e.target.value)} />
          </div>
        )}
      </section>

      <hr className="border-neutral-200" />

      {/* 2. Date range + Event types */}
      <div className="grid md:grid-cols-2 gap-8">
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900">{t("admin.ledgerGen.section.period")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="admin-ledger-generate-from-date" className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">{t("admin.ledgerGen.fromDate")}</label>
              <input id="admin-ledger-generate-from-date" type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="admin-ledger-generate-to-date" className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">{t("admin.ledgerGen.toDate")}</label>
              <input id="admin-ledger-generate-to-date" type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5 flex items-start gap-2">
            <span className="material-symbols-outlined text-blue-600 text-[16px] mt-0.5">info</span>
            <p className="text-xs text-blue-700">{t("admin.ledgerGen.periodHint")}</p>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold text-neutral-900">{t("admin.ledgerGen.section.events")}</h3>
          <div className="space-y-2">
            {EVENT_TYPES.map((et) => (
              <label htmlFor={`admin-ledger-generate-event-type-${et.value}`} key={et.value} className="flex items-center gap-3 cursor-pointer">
                <input id={`admin-ledger-generate-event-type-${et.value}`} type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                  checked={eventTypes.includes(et.value)}
                  onChange={() => toggleEventType(et.value)} />
                <span className="text-sm font-medium text-neutral-700">{t(et.label)}</span>
                <span className="ml-auto text-xs text-neutral-400">{t(et.hint)}</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <hr className="border-neutral-200" />

      {/* 4. Output format */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-neutral-900">{t("admin.ledgerGen.section.format")}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {FORMATS.map((f) => (
            <label htmlFor={`admin-ledger-generate-format-${f.value}`} key={f.value} className={cn(
              "flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-all",
              format === f.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-neutral-200 bg-white hover:border-neutral-300",
            )}>
              <input id={`admin-ledger-generate-format-${f.value}`} type="radio" name="format" value={f.value} checked={format === f.value}
                onChange={() => setFormat(f.value)} className="text-primary" />
              <div className="flex-1">
                <p className="text-sm font-bold text-neutral-900">{t(f.label)}</p>
                <p className="text-xs text-neutral-400">{t(f.desc)}</p>
              </div>
              <span className={cn("material-symbols-outlined text-[32px]", f.iconColor)}>{f.icon}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );

  // â”€â”€â”€ Step 1: Preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="rounded-xl bg-primary/5 border border-primary/20 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[20px]">summarize</span>
          <div>
            <p className="text-sm font-bold text-neutral-900">{reportTitle}</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {t("admin.ledger.entriesN", { count: previewTotal.toLocaleString() })} · {dateFrom || t("admin.ledgerGen.allTime")} – {dateTo || t("admin.ledgerGen.present")}
              {selectedModule && ` · ${selectedModuleLabel}`}
              {scope === "user" && userFilter && ` · ${t("admin.ledgerGen.userIs", { user: userFilter })}`}
              {" · "}
              <span className="font-medium">{t(FORMATS.find((f) => f.value === format)?.label ?? "admin.ledgerGen.format.csv")}</span>
            </p>
          </div>
        </div>
      </div>

      {previewLogs.length === 0 ? (
        <EmptyState icon="receipt_long" title={t("admin.ledgerGen.noMatch")} />
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-600">{t("admin.ledgerGen.previewOf", { shown: Math.min(previewLogs.length, 100), total: previewTotal.toLocaleString() })}</span>
            <span className="text-xs text-neutral-400 font-mono">{t("admin.ledgerGen.hashChain")}</span>
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="data-table w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr>
                  <th className="w-8">#</th>
                  <th>{t("admin.governance.colTimestamp")}</th>
                  <th>{t("admin.common.user")}</th>
                  <th>{t("admin.common.module")}</th>
                  <th>{t("admin.governance.colAction")}</th>
                  <th>{t("admin.ledger.csv.recordRef")}</th>
                  <th>{t("admin.ledgerGen.hash")}</th>
                </tr>
              </thead>
              <tbody>
                {previewLogs.map((l, idx) => (
                  <tr key={l.id}>
                    <td className="text-[11px] text-neutral-300 font-mono text-right">{idx + 1}</td>
                    <td className="font-mono text-[11px] text-neutral-400 whitespace-nowrap">{formatTs(l.created_at)}</td>
                    <td className="text-xs">{l.user_name ?? t("admin.payslipConfig.system")}</td>
                    <td><span className="text-[11px] bg-neutral-100 text-neutral-600 rounded-full px-2 py-0.5 capitalize">{l.module ?? "—"}</span></td>
                    <td><span className="text-[11px] font-semibold text-neutral-700">{l.action}</span></td>
                    <td className="font-mono text-[11px] text-primary">{l.record_id ?? "—"}</td>
                    <td className="font-mono text-[11px] text-neutral-400">{entryHash(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // â”€â”€â”€ Step 2: Export complete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderStep2 = () => (
    <div className="flex flex-col items-center gap-5 py-10 text-center">
      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
        <span className="material-symbols-outlined text-green-600 text-[32px]">check_circle</span>
      </div>
      <div>
        <p className="text-lg font-bold text-neutral-900">{t("admin.ledgerGen.done")}</p>
        <p className="text-sm text-neutral-500 mt-1">
          {t("admin.ledgerGen.exportedAs", { count: previewLogs.length.toLocaleString(), format: t(FORMATS.find((f) => f.value === format)?.label ?? "admin.ledgerGen.format.csv") })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => { setStep(0); setPreviewLogs([]); }}
          className="btn-secondary flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          {t("admin.ledgerGen.newReport")}
        </button>
        <Link href="/admin/ledger" className="btn-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
          {t("admin.ledgerGen.backToLedger")}
        </Link>
      </div>
    </div>
  );

  const stepContent = [renderStep0, renderStep1, renderStep2];

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-neutral-500">
        <Link href="/admin" className="hover:text-primary transition-colors">{t("admin.homeLabel")}</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href="/admin/ledger" className="hover:text-primary transition-colors">{t("admin.ledger.crumb")}</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">{t("admin.ledger.generateReport")}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <ModulePageHeader
        title={t("admin.ledgerGen.pageTitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.ledgerGen.pageTitle") }]} />}
      />
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
          <span className="material-symbols-outlined text-[14px]">verified_user</span>
          {t("admin.ledgerGen.clearance")}
        </span>
      </div>

      {/* Progress stepper */}
      <div className="card p-4">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all flex-shrink-0",
                step > i ? "bg-green-500 text-white" : step === i ? "bg-primary text-white" : "bg-neutral-100 text-neutral-400",
              )}>
                {step > i ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
              </div>
              <p className={cn("text-xs font-semibold flex-1", step === i ? "text-primary" : step > i ? "text-green-600" : "text-neutral-400")}>
                {t(s)}
              </p>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px w-6 flex-shrink-0", step > i ? "bg-green-300" : "bg-neutral-200")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Main content + sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 card p-6">
          {stepContent[step]?.()}
        </div>

        {/* Policy sidebar — only on step 0 */}
        {step === 0 && (
          <aside className="lg:w-72 space-y-4">
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
              <div className="flex items-center gap-2 mb-2 text-amber-700">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <p className="text-xs font-bold uppercase tracking-wider">{t("admin.ledgerGen.policyNotice")}</p>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                {t("admin.ledgerGen.policyBody")}
              </p>
              <p className="text-[11px] text-amber-600 font-medium mt-2">{t("admin.ledgerGen.policyRef", { ref: "COMP-POL-2024-04" })}</p>
            </div>
            <div className="card p-5 space-y-3">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider border-b border-neutral-100 pb-2">{t("admin.ledgerGen.sessionMeta")}</p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-neutral-400">{t("admin.ledgerGen.complianceRef")}</p>
                  <p className="font-mono text-neutral-700">AUD-{new Date().getFullYear()}-RPT</p>{/* i18n-ignore */}
                </div>
                <div>
                  <p className="text-neutral-400">{t("admin.ledgerGen.requestId")}</p>
                  <p className="font-mono text-neutral-700">REQ-{Math.floor(Math.random() * 90000 + 10000)}</p>{/* i18n-ignore */}
                </div>
                <div className="col-span-2">
                  <p className="text-neutral-400">{t("admin.ledgerGen.authorizedBy")}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <p className="text-neutral-700">{t("admin.ledgerGen.systemAdminAuto")}</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Footer navigation */}
      {step < 2 && (
        <div className="flex items-center justify-between">
          <button type="button"
            onClick={() => step > 0 ? setStep(step - 1) : undefined}
            className={cn("btn-secondary flex items-center gap-2", step === 0 ? "invisible" : "")}>
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            {t("common.back")}
          </button>
          <div className="flex items-center gap-2">
            <Link href="/admin/ledger" className="btn-secondary text-sm">{t("common.cancel")}</Link>
            {step === 0 && (
              <button type="button" onClick={handlePreview} disabled={loading}
                className="btn-primary flex items-center gap-2 disabled:opacity-60">
                {loading ? <span className="material-symbols-outlined text-[18px] animate-spin">sync</span> : null}
                {loading ? t("common.loading") : t("admin.ledgerGen.previewReport")}
                {!loading && <span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
              </button>
            )}
            {step === 1 && (
              <button type="button" onClick={handleExport} disabled={previewLogs.length === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-40">
                <span className="material-symbols-outlined text-[18px]">
                  {format === "csv" ? "table_view" : "picture_as_pdf"}
                </span>
                {t("admin.ledgerGen.exportAs", { format: t(FORMATS.find((f) => f.value === format)?.label ?? "admin.ledgerGen.format.csv") })}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
