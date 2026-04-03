"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { riskApi, type Risk, type RiskMatrixData } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { exportToXls } from "@/lib/csvExport";
import { loadPdfLibs } from "@/lib/pdf-libs";

// ── Config ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  draft:      { label: "Draft",      cls: "badge-muted",    icon: "edit_note"          },
  submitted:  { label: "Submitted",  cls: "badge-warning",  icon: "pending"            },
  reviewed:   { label: "Reviewed",   cls: "badge-primary",  icon: "rate_review"        },
  approved:   { label: "Approved",   cls: "badge-success",  icon: "check_circle"       },
  monitoring: { label: "Monitoring", cls: "badge-primary",  icon: "monitor_heart"      },
  escalated:  { label: "Escalated",  cls: "badge-danger",   icon: "warning"            },
  closed:     { label: "Closed",     cls: "badge-muted",    icon: "lock"               },
  archived:   { label: "Archived",   cls: "badge-muted",    icon: "archive"            },
};

const LEVEL_CONFIG: Record<string, { label: string; cls: string; bg: string }> = {
  low:      { label: "Low",      cls: "text-green-700",  bg: "bg-green-100 border-green-300"  },
  medium:   { label: "Medium",   cls: "text-yellow-700", bg: "bg-yellow-100 border-yellow-300"},
  high:     { label: "High",     cls: "text-orange-700", bg: "bg-orange-100 border-orange-300"},
  critical: { label: "Critical", cls: "text-red-700",    bg: "bg-red-100 border-red-300"      },
};

const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
  strategic:     { icon: "flag",             color: "text-indigo-600"  },
  operational:   { icon: "settings",         color: "text-blue-600"    },
  financial:     { icon: "payments",         color: "text-green-600"   },
  compliance:    { icon: "gavel",            color: "text-purple-600"  },
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
const filterMap: Record<string, string | undefined> = {
  All: undefined, Draft: "draft", Submitted: "submitted", Reviewed: "reviewed",
  Approved: "approved", Monitoring: "monitoring", Escalated: "escalated", Closed: "closed",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function RiskRegisterPage() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [matrixFilter, setMatrixFilter] = useState<{ likelihood?: number; impact?: number } | null>(null);

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

  const open     = risks.filter((r) => !["closed", "archived"].includes(r.status)).length;
  const critical = risks.filter((r) => r.risk_level === "critical").length;
  const high     = risks.filter((r) => r.risk_level === "high").length;
  const escalated = risks.filter((r) => r.status === "escalated").length;

  const EXPORT_COLUMNS = [
    { key: "risk_code",       header: "Risk Code"         },
    { key: "title",           header: "Title"             },
    { key: "category",        header: "Category"          },
    { key: "inherent_score",  header: "Inherent Score"    },
    { key: "risk_level",      header: "Risk Level"        },
    { key: "residual_score",  header: "Residual Score"    },
    { key: "status",          header: "Status"            },
    { key: "owner",           header: "Risk Owner"        },
    { key: "department",      header: "Department"        },
    { key: "next_review",     header: "Next Review Date"  },
    { key: "review_notes",    header: "Notes / Controls"  },
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
    doc.text("Risk Register", 14, 14);
    doc.setFontSize(9);
    doc.text(`Generated ${new Date().toLocaleDateString("en-GB")} · ${displayRisks.length} risk(s)`, 14, 20);
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

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Risk Register</h1>
          <p className="page-subtitle">Institutional risk management — identify, assess, and mitigate risks across all departments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToXls("risk-register", buildExportRows(), EXPORT_COLUMNS)}
            disabled={displayRisks.length === 0}
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
            title="Export to Excel"
          >
            <span className="material-symbols-outlined text-[16px]">table_view</span>
            Excel
          </button>
          <button
            onClick={handleExportPdf}
            disabled={displayRisks.length === 0}
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
            title="Export to PDF"
          >
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
            PDF
          </button>
          <Link href="/risk/create" className="btn-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Log Risk
          </Link>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          Failed to load risk register.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Risks",    value: risks.length,  icon: "shield",          color: "text-primary",   bg: "bg-primary/10"  },
          { label: "Open",           value: open,          icon: "warning_amber",   color: "text-amber-600", bg: "bg-amber-50"    },
          { label: "Critical / High",value: critical + high, icon: "crisis_alert",  color: "text-red-600",   bg: "bg-red-50"      },
          { label: "Escalated",      value: escalated,     icon: "escalator_warning",color: "text-orange-600",bg: "bg-orange-50"  },
        ].map((kpi) => (
          <div key={kpi.label} className="card px-4 py-4 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${kpi.bg}`}>
              <span className={`material-symbols-outlined text-[22px] ${kpi.color}`}>{kpi.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 leading-tight">{isLoading ? "—" : kpi.value}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{kpi.label}</p>
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
              <h2 className="text-sm font-semibold text-neutral-800">Risk Heatmap</h2>
              <p className="text-xs text-neutral-500">Likelihood × Impact — click a cell to filter the list</p>
            </div>
            {matrixFilter && (
              <button
                onClick={() => setMatrixFilter(null)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
                Clear filter
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {/* Y axis label */}
            <div className="flex flex-col justify-center items-center w-5">
              <span className="text-[10px] text-neutral-400 -rotate-90 whitespace-nowrap">Likelihood →</span>
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
                          title={`L${l} × I${im} = ${score} — ${count} risk${count !== 1 ? "s" : ""}`}
                        >
                          {count > 0 && <span className="text-[11px] font-bold">{count}</span>}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* X axis label */}
              <div className="text-center text-[10px] text-neutral-400 mt-2">Impact →</div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-3 mt-4 flex-wrap">
            {[
              { label: "Low (1–5)",      bg: "bg-green-200"  },
              { label: "Medium (6–10)",  bg: "bg-yellow-300" },
              { label: "High (11–15)",   bg: "bg-orange-400" },
              { label: "Critical (≥16)", bg: "bg-red-500"    },
            ].map((z) => (
              <div key={z.label} className="flex items-center gap-1.5">
                <div className={`h-3 w-3 rounded ${z.bg}`} />
                <span className="text-[11px] text-neutral-500">{z.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By status + by level */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">By Status</h2>
            <div className="space-y-2">
              {Object.entries(matrix?.by_status ?? {}).map(([status, count]) => {
                const cfg = STATUS_CONFIG[status];
                if (!cfg || count === 0) return null;
                return (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-600">{cfg.label}</span>
                    <span className="font-semibold text-neutral-900">{count as number}</span>
                  </div>
                );
              })}
              {!matrix && <p className="text-xs text-neutral-400">Loading…</p>}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">By Risk Level</h2>
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
                    <span className={`text-xs font-medium w-16 text-right ${cfg.cls}`}>{cfg.label}</span>
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
            {f}
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
          <div className="px-5 py-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300 block mb-2">shield</span>
            <p className="text-sm text-neutral-500">No risks found{matrixFilter ? " in selected heatmap cell" : ""}.</p>
            <Link href="/risk/create" className="btn-primary mt-4 inline-flex items-center gap-1.5 text-sm">
              <span className="material-symbols-outlined text-[16px]">add</span>
              Log first risk
            </Link>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Category</th>
                <th>Inherent Score</th>
                <th>Residual Score</th>
                <th>Level</th>
                <th>Status</th>
                <th>Next Review</th>
                <th>Owner</th>
                <th>Updated</th>
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
                      <Link href={`/risk/${risk.id}`} className="font-mono text-xs text-primary hover:underline">
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
                        <span className="capitalize text-neutral-600">{risk.category}</span>
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
                      <span className={`text-xs font-semibold ${level.cls}`}>{level.label}</span>
                    </td>
                    <td>
                      <span className={`badge ${status.cls} inline-flex items-center gap-1`}>
                        <span className="material-symbols-outlined text-[11px]">{status.icon}</span>
                        {status.label}
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
  );
}
