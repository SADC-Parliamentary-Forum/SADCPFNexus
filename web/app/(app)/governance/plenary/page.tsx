"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import api, { governanceApi, type GovernanceResolution, type GovernanceDocument } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useFormatDate } from "@/lib/useFormatDate";

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: "en" as const, label: "EN", fullLabel: "English", flag: "🇬🇧" },
  { code: "fr" as const, label: "FR", fullLabel: "French", flag: "🇫🇷" },
  { code: "pt" as const, label: "PT", fullLabel: "Portuguese", flag: "🇵🇹" },
];

const CURRENT_YEAR = new Date().getFullYear();
const SESSION_YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const FILTER_TABS = [
  { key: "", label: "All" },
  { key: "Adopted", label: "Adopted" },
  { key: "In Progress", label: "In Progress" },
  { key: "Implemented", label: "Implemented" },
  { key: "Actioned", label: "Actioned" },
  { key: "Rejected", label: "Rejected" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

const STATUS_STYLE: Record<string, string> = {
  Draft: "bg-neutral-100 text-neutral-700 border-neutral-200",
  Adopted: "bg-emerald-100 text-emerald-800 border-emerald-200",
  "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
  "Pending Review": "bg-amber-100 text-amber-800 border-amber-200",
  Implemented: "bg-teal-100 text-teal-800 border-teal-200",
  Rejected: "bg-red-100 text-red-800 border-red-200",
  Actioned: "bg-purple-100 text-purple-800 border-purple-200",
};

const STATUS_DOT: Record<string, string> = {
  Draft: "bg-neutral-400",
  Adopted: "bg-emerald-500",
  "In Progress": "bg-blue-500",
  "Pending Review": "bg-amber-500",
  Implemented: "bg-teal-500",
  Rejected: "bg-red-500",
  Actioned: "bg-purple-500",
};

function statusStyle(s: string) {
  return STATUS_STYLE[s] ?? "bg-neutral-100 text-neutral-700 border-neutral-200";
}
function statusDot(s: string) {
  return STATUS_DOT[s] ?? "bg-neutral-400";
}


// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  colorClass,
  bgClass,
}: {
  icon: string;
  label: string;
  value: number;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${bgClass}`}>
        <span className={`material-symbols-outlined text-[22px] ${colorClass}`}>{icon}</span>
      </div>
      <div>
        <div className="text-2xl font-bold text-neutral-900 leading-none">{value}</div>
        <div className="text-xs text-neutral-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

// ─── Document Download Buttons ────────────────────────────────────────────────

function DocButtons({
  resolution,
  downloading,
  onDownload,
}: {
  resolution: GovernanceResolution;
  downloading: Record<string, boolean>;
  onDownload: (res: GovernanceResolution, lang: "en" | "fr" | "pt", doc: GovernanceDocument) => void;
}) {
  const docsByLang = Object.fromEntries(
    (resolution.documents ?? []).map((d) => [d.language, d])
  ) as Partial<Record<"en" | "fr" | "pt", GovernanceDocument>>;

  return (
    <div className="flex gap-1.5 flex-wrap">
      {LANGUAGES.map(({ code, label }) => {
        const doc = docsByLang[code];
        if (!doc) return null;
        return (
          <button
            key={code}
            type="button"
            disabled={downloading[`${resolution.id}-${code}`]}
            onClick={() => onDownload(resolution, code, doc)}
            title={`Download ${label === "EN" ? "English" : label === "FR" ? "French" : "Portuguese"} version`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold transition-colors bg-white border-neutral-200 text-neutral-700 hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {downloading[`${resolution.id}-${code}`] ? (
              <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[12px]">download</span>
            )}
            {label}
          </button>
        );
      })}
      {(resolution.documents ?? []).length === 0 && (
        <span className="text-xs text-neutral-400 italic">No documents</span>
      )}
    </div>
  );
}

// ─── Expandable Resolution Row ────────────────────────────────────────────────

function ResolutionRow({
  resolution,
  downloading,
  onDownload,
}: {
  resolution: GovernanceResolution;
  downloading: Record<string, boolean>;
  onDownload: (res: GovernanceResolution, lang: "en" | "fr" | "pt", doc: GovernanceDocument) => void;
}) {
  const { fmt: fmtDate } = useFormatDate();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="hover:bg-neutral-50/50 transition-colors">
        <td className="px-5 py-3 text-sm font-mono text-neutral-600 whitespace-nowrap">
          {resolution.reference_number ?? `#${resolution.id}`}
        </td>
        <td className="px-5 py-3">
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            className="flex items-start gap-1.5 text-left group"
          >
            <span className="material-symbols-outlined text-[14px] mt-0.5 text-neutral-400 group-hover:text-primary transition-colors flex-shrink-0">
              {expanded ? "expand_less" : "expand_more"}
            </span>
            <span className="text-sm font-medium text-neutral-900 group-hover:text-primary transition-colors">
              {resolution.title}
            </span>
          </button>
        </td>
        <td className="px-5 py-3">
          {resolution.committee ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              {resolution.committee}
            </span>
          ) : (
            <span className="text-xs text-neutral-400">—</span>
          )}
        </td>
        <td className="px-5 py-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusStyle(resolution.status)}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(resolution.status)}`} />
            {resolution.status}
          </span>
        </td>
        <td className="px-5 py-3 text-sm text-neutral-600 whitespace-nowrap">
          {fmtDate(resolution.adopted_at)}
        </td>
        <td className="px-5 py-3">
          {resolution.lead_member ? (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-primary">
                  {resolution.lead_member
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
              </div>
              <span className="text-xs text-neutral-700 leading-tight">
                {resolution.lead_member}
                {resolution.lead_role && (
                  <span className="block text-neutral-400">{resolution.lead_role}</span>
                )}
              </span>
            </div>
          ) : (
            <span className="text-xs text-neutral-400">—</span>
          )}
        </td>
        <td className="px-5 py-3">
          <DocButtons resolution={resolution} downloading={downloading} onDownload={onDownload} />
        </td>
        <td className="px-5 py-3 text-right">
          <Link
            href={`/governance?resolution=${resolution.id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            View full
            <span className="material-symbols-outlined text-[13px]">open_in_new</span>
          </Link>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-neutral-50/60">
          <td colSpan={8} className="px-5 py-3">
            <div className="pl-5 border-l-2 border-primary/30">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Resolution Description
              </p>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
                {resolution.description ?? "No description provided for this resolution."}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[48, 160, 100, 80, 80, 120, 100, 60].map((w, i) => (
        <td key={i} className="px-5 py-3">
          <div className="h-4 rounded bg-neutral-100 animate-pulse" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlenaryResolutionsPage() {
  const { toast } = useToast();

  const [resolutions, setResolutions] = useState<GovernanceResolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("");
  const [sessionYear, setSessionYear] = useState<number>(CURRENT_YEAR);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        per_page: 25,
        page,
        type: "Plenary",
      };
      if (filter) params.status = filter;
      const res = await governanceApi.resolutions(params as Parameters<typeof governanceApi.resolutions>[0]);
      const payload = res.data as {
        data?: GovernanceResolution[];
        current_page?: number;
        last_page?: number;
        total?: number;
      };
      // Filter by session year client-side (adopted_at year or created_at year)
      const allItems = payload.data ?? [];
      const yearFiltered = allItems.filter((r) => {
        const dateStr = r.adopted_at ?? r.created_at ?? null;
        if (!dateStr) return true; // keep undated items
        return new Date(dateStr).getFullYear() === sessionYear;
      });
      setResolutions(yearFiltered);
      setLastPage(payload.last_page ?? 1);
      setTotal(yearFiltered.length);
    } catch {
      setError("Failed to load plenary resolutions.");
      setResolutions([]);
    } finally {
      setLoading(false);
    }
  }, [page, filter, sessionYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset page when filter or year changes
  useEffect(() => {
    setPage(1);
  }, [filter, sessionYear]);

  const handleDownload = async (
    resolution: GovernanceResolution,
    lang: "en" | "fr" | "pt",
    doc: GovernanceDocument
  ) => {
    const key = `${resolution.id}-${lang}`;
    setDownloading((p) => ({ ...p, [key]: true }));
    try {
      const res = await api.get(
        `/governance/resolutions/${resolution.id}/documents/${doc.id}/download`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.original_filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("error", "Download failed", "Could not download the document.");
    } finally {
      setDownloading((p) => ({ ...p, [key]: false }));
    }
  };

  // Compute stats from all loaded resolutions (unfiltered by status for counts)
  const stats = {
    total: resolutions.length,
    adopted: resolutions.filter((r) => r.status === "Adopted").length,
    inProgress: resolutions.filter((r) => r.status === "In Progress").length,
    implemented: resolutions.filter((r) =>
      ["Implemented", "Actioned"].includes(r.status)
    ).length,
    rejected: resolutions.filter((r) => r.status === "Rejected").length,
  };

  // Apply client-side status filter on top
  const displayed = filter
    ? resolutions.filter((r) => r.status === filter)
    : resolutions;

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Link href="/governance" className="hover:text-neutral-700 transition-colors">
          Governance
        </Link>
        <span className="material-symbols-outlined text-[13px]">chevron_right</span>
        <span className="text-neutral-700 font-medium">Plenary Resolutions</span>
      </div>

      {/* ── Hero Header ── */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 px-8 py-7 text-white relative overflow-hidden">
        {/* Decorative watermark */}
        <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-[100px] text-white/10 select-none pointer-events-none">
          gavel
        </span>

        <div className="flex flex-wrap items-start justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">account_balance</span>
              </div>
              <span className="text-sm font-semibold text-emerald-200 uppercase tracking-wider">
                Plenary Session
              </span>
            </div>
            <h1 className="text-3xl font-bold mb-1">Plenary Resolutions</h1>
            <p className="text-emerald-200 text-sm max-w-xl">
              Official resolutions adopted during plenary sessions of the SADCPF. These are binding
              decisions from the full assembly.
            </p>
          </div>

          {/* Session year selector */}
          <div className="flex flex-col items-end gap-1.5">
            <label className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">
              Session Year
            </label>
            <select
              className="rounded-lg border border-white/30 bg-white/10 backdrop-blur-sm px-4 py-2 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-white/40 cursor-pointer min-w-[110px]"
              value={sessionYear}
              onChange={(e) => setSessionYear(Number(e.target.value))}
            >
              {SESSION_YEARS.map((y) => (
                <option key={y} value={y} className="text-neutral-900 bg-white">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon="check_circle"
          label="Total adopted"
          value={stats.adopted}
          colorClass="text-emerald-700"
          bgClass="bg-emerald-50"
        />
        <StatCard
          icon="sync"
          label="In progress"
          value={stats.inProgress}
          colorClass="text-blue-700"
          bgClass="bg-blue-50"
        />
        <StatCard
          icon="task_alt"
          label="Implemented / Actioned"
          value={stats.implemented}
          colorClass="text-teal-700"
          bgClass="bg-teal-50"
        />
        <StatCard
          icon="cancel"
          label="Rejected"
          value={stats.rejected}
          colorClass="text-red-700"
          bgClass="bg-red-50"
        />
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
          <button
            type="button"
            onClick={loadData}
            className="ml-auto text-xs font-semibold text-red-700 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Filter Pills + Table Card ── */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`filter-tab${filter === tab.key ? " active" : ""}`}
              >
                {tab.label}
                {tab.key === "" && (
                  <span className="ml-1.5 rounded-full bg-current/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                    {total}
                  </span>
                )}
              </button>
            ))}
          </div>

          <span className="text-xs text-neutral-400">
            {displayed.length} resolution{displayed.length !== 1 ? "s" : ""} — {sessionYear} session
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref #</th>
                  <th>Title</th>
                  <th>Committee</th>
                  <th>Status</th>
                  <th>Date Adopted</th>
                  <th>Responsible</th>
                  <th>Documents</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          </div>
        ) : displayed.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px] text-neutral-300">gavel</span>
            </div>
            <p className="text-sm font-semibold text-neutral-700">
              No plenary resolutions for this session
            </p>
            <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
              {filter
                ? `No resolutions with status "${filter}" found for ${sessionYear}.`
                : `There are no plenary resolutions recorded for the ${sessionYear} session.`}
            </p>
            {filter && (
              <button
                type="button"
                onClick={() => setFilter("")}
                className="mt-4 text-xs font-semibold text-primary hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ref #</th>
                    <th>Title</th>
                    <th>Committee</th>
                    <th>Status</th>
                    <th>Date Adopted</th>
                    <th>Responsible</th>
                    <th>Documents</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((r) => (
                    <ResolutionRow
                      key={r.id}
                      resolution={r}
                      downloading={downloading}
                      onDownload={handleDownload}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {lastPage > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 text-sm text-neutral-600">
                <span className="text-xs">
                  Page {page} of {lastPage}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                    className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-50"
                  >
                    Next
                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer link ── */}
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <Link href="/governance" className="hover:text-primary transition-colors font-medium flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
          Back to Governance
        </Link>
        <span>SADCPF Governance Tracker · {sessionYear} Plenary Session</span>
      </div>
    </div>
  );
}
