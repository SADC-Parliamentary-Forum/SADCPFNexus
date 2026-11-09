"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { riskApi, type Risk, type RiskMatrixData } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { exportToXls } from "@/lib/csvExport";
import { loadPdfLibs } from "@/lib/pdf-libs";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import {
  BulkSelectionBar,
  SelectAllCheckbox,
  RowCheckbox,
} from "@/components/ui/BulkSelectionBar";
import { useRowSelection } from "@/lib/useRowSelection";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { RISK_HUB_CARDS } from "@/lib/hubs/risk";
import { Modal } from "@/components/ui/Modal";
import { ApplyMitigationFields, EMPTY_MITIGATION, type MitigationDraft } from "@/components/risk/ApplyMitigationFields";
import { buildMitigationFormData, assertMitigationRiskIds } from "@/lib/riskLookups";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { EmptyState } from "@/components/ui/EmptyState";

// ── Config ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  draft:      { label: "risk.analytics.status.draft",      cls: "badge-muted",    icon: "edit_note"          },
  submitted:  { label: "risk.analytics.status.submitted",  cls: "badge-warning",  icon: "pending"            },
  reviewed:   { label: "risk.analytics.status.reviewed",   cls: "badge-primary",  icon: "rate_review"        },
  approved:   { label: "risk.analytics.status.approved",   cls: "badge-success",  icon: "check_circle"       },
  monitoring: { label: "risk.analytics.status.monitoring", cls: "badge-primary",  icon: "monitor_heart"      },
  escalated:  { label: "risk.analytics.status.escalated",  cls: "badge-danger",   icon: "warning"            },
  closed:     { label: "risk.analytics.status.closed",     cls: "badge-muted",    icon: "lock"               },
  archived:   { label: "risk.analytics.status.archived",   cls: "badge-muted",    icon: "archive"            },
};

const LEVEL_CONFIG: Record<string, { label: string; cls: string; bg: string }> = {
  low:      { label: "risk.create.level.low",      cls: "text-green-700",  bg: "bg-green-100 border-green-300"  },
  medium:   { label: "risk.create.level.medium",   cls: "text-yellow-700", bg: "bg-yellow-100 border-yellow-300"},
  high:     { label: "risk.create.level.high",     cls: "text-orange-700", bg: "bg-orange-100 border-orange-300"},
  critical: { label: "risk.create.level.critical", cls: "text-red-700",    bg: "bg-red-100 border-red-300"      },
};

const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
  strategic:     { icon: "flag",             color: "text-indigo-600"  },
  operational:   { icon: "settings",         color: "text-blue-600"    },
  financial:     { icon: "payments",         color: "text-green-600"   },
  compliance:    { icon: "gavel",            color: "text-teal-600"    },
  reputational:  { icon: "verified_user",    color: "text-pink-600"    },
  security:      { icon: "security",         color: "text-red-600"     },
  other:         { icon: "more_horiz",       color: "text-neutral-500" },
};

function residualLevel(s: number): string {
  if (s >= 16) return "critical";
  if (s >= 11) return "high";
  if (s >= 6)  return "medium";
  return "low";
}

// Heat-map cell colour by zone
function cellBg(score: number): string {
  if (score >= 16) return "bg-red-500 text-white";
  if (score >= 11) return "bg-orange-400 text-white";
  if (score >= 6)  return "bg-yellow-300 text-neutral-900";
  return "bg-green-200 text-neutral-900";
}

const STATUS_FILTERS = ["All", "Draft", "Submitted", "Reviewed", "Approved", "Monitoring", "Escalated", "Closed"] as const;
/** Catalog key for each status filter tab; the filter values themselves stay English state ids. */
const FILTER_LABELS: Record<string, string> = {
  All: "risk.register.filterAll", Draft: "risk.analytics.status.draft", Submitted: "risk.analytics.status.submitted",
  Reviewed: "risk.analytics.status.reviewed", Approved: "risk.analytics.status.approved",
  Monitoring: "risk.analytics.status.monitoring", Escalated: "risk.analytics.status.escalated", Closed: "risk.analytics.status.closed",
};

/** Translated risk category, falling back to the raw value. */
function categoryLabel(t: (key: string) => string, category: string): string {
  const key = `risk.create.category.${category}`;
  const label = t(key);
  return label === key ? category : label;
}
const filterMap: Record<string, string | undefined> = {
  All: undefined, Draft: "draft", Submitted: "submitted", Reviewed: "reviewed",
  Approved: "approved", Monitoring: "monitoring", Escalated: "escalated", Closed: "closed",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function RiskRegisterPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [matrixFilter, setMatrixFilter] = useState<{ likelihood?: number; impact?: number } | null>(null);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");
  const [mitigationOpen, setMitigationOpen] = useState(false);
  const [mitigation, setMitigation] = useState<MitigationDraft>(EMPTY_MITIGATION);
  const [mitigationError, setMitigationError] = useState<string | null>(null);
  const [mitigationSaving, setMitigationSaving] = useState(false);

  const { data: pageData, isLoading, isError } = useQuery({
    queryKey: ["risk", "list", statusFilter],
    queryFn: () => {
      const params: Record<string, string | number> = { per_page: 200 };
      const s = filterMap[statusFilter];
      if (s) params.status = s;
      return riskApi.list(params).then((r) => (r.data as any).data as Risk[]);
    },
    staleTime: 30_000,
  });

  const { data: matrix } = useQuery({
    queryKey: ["risk", "matrix"],
    queryFn: () => riskApi.getMatrix({ exclude_closed: true }).then((r) => r.data ?? null),
    staleTime: 60_000,
  });

  const risks: Risk[] = pageData ?? [];

  // Apply matrix cell filter on top of status filter
  const displayRisks = matrixFilter
    ? risks.filter((r) => r.likelihood === matrixFilter.likelihood && r.impact === matrixFilter.impact)
    : risks;

  const getId = useCallback((row: Risk) => row.id, []);
  const selection = useRowSelection({
    rows: displayRisks,
    getId,
  });

  const open     = risks.filter((r) => !["closed", "archived"].includes(r.status)).length;
  const critical = risks.filter((r) => r.risk_level === "critical").length;
  const high     = risks.filter((r) => r.risk_level === "high").length;
  const escalated = risks.filter((r) => r.status === "escalated").length;

  const EXPORT_COLUMNS = [
    { key: "risk_code",       header: t("risk.auditTrail.riskCode")       },
    { key: "title",           header: t("risk.common.title")              },
    { key: "category",        header: t("risk.create.category")           },
    { key: "inherent_score",  header: t("risk.common.inherentScore")      },
    { key: "risk_level",      header: t("risk.register.riskLevel")        },
    { key: "residual_score",  header: t("risk.common.residualScore")      },
    { key: "status",          header: t("risk.common.status")             },
    { key: "owner",           header: t("risk.common.riskOwner")          },
    { key: "department",      header: t("risk.analytics.department")      },
    { key: "next_review",     header: t("risk.register.nextReviewDate")   },
    { key: "review_notes",    header: t("risk.register.notesControls")    },
  ];

  function buildExportRows() {
    return displayRisks.map((r) => ({
      risk_code:      r.risk_code,
      title:          r.title,
      category:       r.category,
      inherent_score: r.inherent_score ?? "",
      risk_level:     r.risk_level ?? "",
      residual_score: r.residual_likelihood != null && r.residual_impact != null
        ? r.residual_likelihood * r.residual_impact
        : "",
      status:         r.status,
      owner:          r.riskOwner?.name ?? "",
      department:     (r as any).department ?? "",
      next_review:    r.next_review_date ?? "",
      review_notes:   r.review_notes ?? "",
    }));
  }

  async function handleExportPdf() {
    const { jsPDF, autoTable } = await loadPdfLibs();
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text(t("risk.hub"), 14, 14);
    doc.setFontSize(9);
    doc.text(t("risk.register.pdfGenerated", { date: new Date().toLocaleDateString("en-GB"), count: displayRisks.length }), 14, 20);
    autoTable(doc, {
      head: [EXPORT_COLUMNS.map((c) => c.header)],
      body: buildExportRows().map((r) => EXPORT_COLUMNS.map((c) => String(r[c.key as keyof typeof r] ?? ""))),
      startY: 25,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [29, 133, 237], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 55 },
        2: { cellWidth: 22 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 18 },
        6: { cellWidth: 20 },
        7: { cellWidth: 28 },
        8: { cellWidth: 22 },
        9: { cellWidth: 22 },
      },
    });
    doc.save(`risk-register-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function applySelectedMitigation() {
    if (!mitigation.description.trim()) {
      setMitigationError(t("risk.mitigation.descriptionRequired"));
      return;
    }
    const ids = selection.selectedIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const idError = assertMitigationRiskIds(ids);
    if (idError) {
      setMitigationError(t(idError));
      return;
    }
    setMitigationSaving(true);
    setMitigationError(null);
    try {
      await riskApi.applyMitigations(
        buildMitigationFormData({
          riskIds: ids,
          description: mitigation.description,
          treatmentType: mitigation.treatment_type,
          dueDate: mitigation.due_date || undefined,
          file: mitigation.file,
          documentType: "risk_mitigation_plan",
        }),
      );
      setMitigationOpen(false);
      setMitigation(EMPTY_MITIGATION);
      selection.clear();
      await qc.invalidateQueries({ queryKey: ["risk", "list"] });
    } catch (err: unknown) {
      setMitigationError(apiErrorMessage(err, t("risk.mitigation.failed")));
    } finally {
      setMitigationSaving(false);
    }
  }

  return (
    <>
    <RegisterShell
      title="risk.hub"
      subtitle="risk.register.subtitle"
      density={density}
      onDensityChange={setDensity}
      loading={isLoading}
      bulkBar={
        <BulkSelectionBar count={selection.selectedCount} onClear={selection.clear} disabled={mitigationSaving}>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={selection.selectedCount === 0 || mitigationSaving}
            onClick={() => {
              setMitigationError(null);
              setMitigationOpen(true);
            }}
          >
            {t("risk.mitigation.applySelected")}
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={selection.selectedCount === 0}
            onClick={() => {
              const selected = displayRisks.filter((r) => selection.isSelected(r.id));
              exportToXls(
                "risk-register-selected",
                selected.map((r) => ({
                  risk_code: r.risk_code,
                  title: r.title,
                  category: r.category,
                  status: r.status,
                  risk_level: r.risk_level ?? "",
                })),
                [
                  { key: "risk_code", header: t("risk.auditTrail.riskCode") },
                  { key: "title", header: t("risk.common.title") },
                  { key: "category", header: t("risk.create.category") },
                  { key: "status", header: t("risk.common.status") },
                  { key: "risk_level", header: t("reports.col.level") },
                ],
              );
            }}
          >
            {t("procurement.register.exportSelected")}
          </button>
        </BulkSelectionBar>
      }
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToXls("risk-register", buildExportRows(), EXPORT_COLUMNS)}
            disabled={displayRisks.length === 0}
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
            title={t("risk.register.exportExcel")}
          >
            <span className="material-symbols-outlined text-[16px]">table_view</span>
            Excel{/* i18n-ignore */}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={displayRisks.length === 0}
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
            title={t("risk.register.exportPdf")}
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            PDF{/* i18n-ignore */}
          </button>
          <Link href="/risk/create" className="btn-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("risk.register.logRisk")}
          </Link>
        </div>
      }
      stats={
        isError ? (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error_outline</span>
            {t("risk.register.loadFailed")}
          </div>
        ) : null
      }
    >
    <div className="space-y-6">
      <ModuleHubCards cards={RISK_HUB_CARDS} />
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "risk.analytics.totalRisks",       value: risks.length,  icon: "shield",          color: "text-primary",   bg: "bg-primary/10"  },
          { label: "risk.register.kpiOpen",           value: open,          icon: "warning_amber",   color: "text-amber-600", bg: "bg-amber-50"    },
          { label: "risk.register.kpiCriticalHigh",   value: critical + high, icon: "crisis_alert",  color: "text-red-600",   bg: "bg-red-50"      },
          { label: "risk.analytics.status.escalated", value: escalated,     icon: "escalator_warning",color: "text-orange-600",bg: "bg-orange-50"  },
        ].map((kpi) => (
          <div key={kpi.label} className="card px-4 py-4 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${kpi.bg}`}>
              <span className={`material-symbols-outlined text-[22px] ${kpi.color}`}>{kpi.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 leading-tight">{isLoading ? "—" : kpi.value}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{t(kpi.label)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap + By Status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 5×5 Heatmap */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-800">{t("risk.analytics.heatmap")}</h2>
              <p className="text-xs text-neutral-500">{t("risk.register.heatmapHint")}</p>
            </div>
            {matrixFilter && (
              <button
                onClick={() => setMatrixFilter(null)}
                className="btn-secondary text-xs py-1 px-2 inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
                {t("governance.plenary.clearFilter")}
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {/* Y axis label */}
            <div className="flex flex-col justify-center items-center w-5">
              <span className="text-[10px] text-neutral-400 -rotate-90 whitespace-nowrap">{t("risk.analytics.likelihoodAxis")}</span>
            </div>

            <div className="flex-1">
              {/* Grid (5 rows = likelihood 5→1 top-to-bottom, 5 cols = impact 1→5 left-to-right) */}
              <div className="grid gap-1" style={{ gridTemplateColumns: "24px repeat(5, 1fr)" }}>
                {/* Column headers (impact) */}
                <div key="hdr-spacer" />
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="text-center text-[10px] text-neutral-400 font-medium pb-0.5">{i}</div>
                ))}

                {/* Rows: likelihood 5 → 1 */}
                {[5, 4, 3, 2, 1].map((l) => (
                  <React.Fragment key={l}>
                    <div className="flex items-center justify-center text-[10px] text-neutral-400 font-medium pr-1">{l}</div>
                    {[1, 2, 3, 4, 5].map((im) => {
                      const score = l * im;
                      const cell  = matrix?.cells.find((c) => c.likelihood === l && c.impact === im);
                      const count = cell?.count ?? 0;
                      const active = matrixFilter?.likelihood === l && matrixFilter?.impact === im;
                      return (
                        <button
                          key={`${l}-${im}`}
                          onClick={() => setMatrixFilter(active ? null : { likelihood: l, impact: im })}
                          className={`relative aspect-square rounded flex items-center justify-center text-xs font-bold transition-all ${cellBg(score)} ${active ? "ring-2 ring-neutral-900 scale-110 z-10" : "hover:scale-105"}`}
                          title={t(count === 1 ? "risk.register.cellOne" : "risk.register.cellMany", { l, i: im, score, count })}
                        >
                          {count > 0 && <span className="text-[11px] font-bold">{count}</span>}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* X axis label */}
              <div className="text-center text-[10px] text-neutral-400 mt-2">{t("risk.analytics.impactAxis")}</div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-3 mt-4 flex-wrap">
            {[
              { label: "risk.register.legendLow",      bg: "bg-green-200"  },
              { label: "risk.register.legendMedium",   bg: "bg-yellow-300" },
              { label: "risk.register.legendHigh",     bg: "bg-orange-400" },
              { label: "risk.register.legendCritical", bg: "bg-red-500"    },
            ].map((z) => (
              <div key={z.label} className="flex items-center gap-1.5">
                <div className={`h-3 w-3 rounded ${z.bg}`} />
                <span className="text-[11px] text-neutral-500">{t(z.label)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By status + by level */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">{t("risk.register.byStatus")}</h2>
            <div className="space-y-2">
              {Object.entries(matrix?.by_status ?? {}).map(([status, count]) => {
                const cfg = STATUS_CONFIG[status];
                if (!cfg || count === 0) return null;
                return (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">{t(cfg.label)}</span>
                    <span className="font-semibold text-neutral-900">{count as number}</span>
                  </div>
                );
              })}
              {!matrix && <p className="text-xs text-neutral-400">{t("common.loading")}</p>}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">{t("risk.register.byLevel")}</h2>
            <div className="space-y-2">
              {(["critical", "high", "medium", "low"] as const).map((level) => {
                const count = matrix?.by_risk_level?.[level] ?? 0;
                const cfg   = LEVEL_CONFIG[level];
                return (
                  <div key={level} className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${level === "critical" ? "bg-red-500" : level === "high" ? "bg-orange-400" : level === "medium" ? "bg-yellow-400" : "bg-green-400"}`}
                        style={{ width: `${matrix?.totals.total ? Math.round((count / matrix.totals.total) * 100) : 0}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium w-16 text-right ${cfg.cls}`}>{t(cfg.label)}</span>
                    <span className="text-xs text-neutral-500 w-5 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => { setStatusFilter(f); setMatrixFilter(null); }}
            className={`filter-tab ${statusFilter === f ? "active" : ""}`}
          >
            {t(FILTER_LABELS[f])}
            {f !== "All" && (() => {
              const s = filterMap[f];
              const cnt = s ? risks.filter((r) => r.status === s).length : risks.length;
              return cnt > 0 ? <span className="ml-1.5 text-[10px] font-semibold opacity-70">({cnt})</span> : null;
            })()}
          </button>
        ))}
      </div>

      {/* Risk list */}
      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="divide-y divide-neutral-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 animate-pulse flex gap-4">
                <div className="h-4 w-24 bg-neutral-200 rounded" />
                <div className="h-4 flex-1 bg-neutral-100 rounded" />
              </div>
            ))}
          </div>
        ) : displayRisks.length === 0 ? (
          <EmptyState
            icon="shield"
            title={matrixFilter ? "risk.register.emptyCell" : "risk.register.empty"}
            action={
              <Link href="/risk/create" className="btn-primary inline-flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-[16px]">add</span>
                {t("risk.register.logFirst")}
              </Link>
            }
          />
        ) : (
          <table className="data-table">
              <caption className="sr-only">{t("risk.register.caption")}</caption>
            <thead>
              <tr>
                <th className="w-10">
                  <SelectAllCheckbox
                    checked={selection.allSelectableSelected}
                    indeterminate={selection.someSelectableSelected && !selection.allSelectableSelected}
                    onChange={selection.toggleAllSelectable}
                  />
                </th>
                <th>{t("risk.incidents.col.code")}</th>
                <th>{t("risk.common.title")}</th>
                <th>{t("risk.create.category")}</th>
                <th>{t("risk.common.inherentScore")}</th>
                <th>{t("risk.common.residualScore")}</th>
                <th>{t("reports.col.level")}</th>
                <th>{t("risk.common.status")}</th>
                <th>{t("risk.common.nextReview")}</th>
                <th>{t("risk.policies.colOwner")}</th>
                <th>{t("risk.register.colUpdated")}</th>
              </tr>
            </thead>
            <tbody>
              {displayRisks.map((risk) => {
                const level = LEVEL_CONFIG[risk.risk_level] ?? LEVEL_CONFIG.low;
                const status = STATUS_CONFIG[risk.status] ?? STATUS_CONFIG.draft;
                const cat = CATEGORY_CONFIG[risk.category] ?? CATEGORY_CONFIG.other;
                return (
                  <tr key={risk.id}>
                    <td>
                      <RowCheckbox
                        checked={selection.isSelected(risk.id)}
                        onChange={() => selection.toggle(risk.id)}
                        label={t("risk.register.selectRow", { code: risk.risk_code })}
                      />
                    </td>
                    <td>
                      <Link href={`/risk/${risk.id}`} className="font-mono text-xs text-primary">
                        {risk.risk_code}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/risk/${risk.id}`} className="font-medium text-neutral-900 hover:text-primary line-clamp-1">
                        {risk.title}
                      </Link>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className={`material-symbols-outlined text-[13px] ${cat.color}`}>{cat.icon}</span>
                        <span className="capitalize text-neutral-600">{categoryLabel(t, risk.category)}</span>
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center justify-center h-6 w-8 rounded text-xs font-bold border ${level.bg} ${level.cls}`}>
                        {risk.inherent_score}
                      </span>
                    </td>
                    <td>
                      {risk.residual_likelihood != null && risk.residual_impact != null ? (() => {
                        const rs = risk.residual_likelihood * risk.residual_impact;
                        const rl = LEVEL_CONFIG[residualLevel(rs)];
                        return (
                          <span className={`inline-flex items-center justify-center h-6 w-8 rounded text-xs font-bold border ${rl.bg} ${rl.cls}`}>
                            {rs}
                          </span>
                        );
                      })() : <span className="text-xs text-neutral-300">—</span>}
                    </td>
                    <td>
                      <span className={`text-xs font-semibold ${level.cls}`}>{t(level.label)}</span>
                    </td>
                    <td>
                      <span className={`badge ${status.cls} inline-flex items-center gap-1`}>
                        <span className="material-symbols-outlined text-[11px]">{status.icon}</span>
                        {t(status.label)}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-neutral-400">{risk.next_review_date ? formatDateShort(risk.next_review_date) : "—"}</span>
                    </td>
                    <td>
                      <span className="text-xs text-neutral-500">{risk.riskOwner?.name ?? "—"}</span>
                    </td>
                    <td>
                      <span className="text-xs text-neutral-400">{formatDateShort(risk.updated_at)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
    </RegisterShell>
    <Modal
      open={mitigationOpen}
      onClose={() => {
        if (mitigationSaving) return;
        setMitigationOpen(false);
      }}
      size="lg"
      title={t("risk.mitigation.title")}
      description={t("risk.mitigation.applyCount", { count: selection.selectedCount })}
      footer={
        <>
          <button
            type="button"
            className="btn-secondary flex-1"
            disabled={mitigationSaving}
            onClick={() => setMitigationOpen(false)}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary flex-1 flex items-center justify-center gap-1.5"
            disabled={mitigationSaving}
            onClick={() => void applySelectedMitigation()}
          >
            {mitigationSaving ? (
              <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            {t("risk.mitigation.apply")}
          </button>
        </>
      }
    >
      {mitigationError && (
        <p className="mb-3 text-sm text-red-700" role="alert">{mitigationError}</p>
      )}
      <ApplyMitigationFields
        idPrefix="risk-register-mitigation"
        value={mitigation}
        onChange={setMitigation}
        required
      />
    </Modal>
    </>
  );
}
