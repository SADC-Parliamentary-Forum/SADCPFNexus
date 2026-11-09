"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { procurementApi, type ProcurementRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";
import { ProcurementPageHeader } from "@/components/procurement/ProcurementPageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  draft: { label: "status.draft", badge: "badge-muted" },
  submitted: { label: "status.submitted", badge: "badge-warning" },
  approved: { label: "status.approved", badge: "badge-success" },
  rejected: { label: "status.rejected", badge: "badge-danger" },
  cancelled: { label: "status.cancelled", badge: "badge-muted" },
  awarded: { label: "procurement.status.awarded", badge: "badge-success" },
  in_progress: { label: "procurement.status.inProgress", badge: "badge-primary" },
  completed: { label: "procurement.status.completed", badge: "badge-success" },
};

const FILTER_TABS = [
  { key: "all", label: "procurement.filter.all" },
  { key: "draft", label: "status.draft" },
  { key: "submitted", label: "status.submitted" },
  { key: "approved", label: "status.approved" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function getListData(payload: unknown): ProcurementRequest[] {
  if (Array.isArray(payload)) return payload as ProcurementRequest[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as ProcurementRequest[];
  }
  return [];
}

export default function ProcurementIntakePage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["procurement", "intake"],
    queryFn: () =>
      procurementApi.list({ has_programme: 1, per_page: 100 }).then((res) => getListData(res.data)),
    staleTime: 20_000,
  });

  const rows = data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      const hay = [
        row.reference_number,
        row.title,
        row.status,
        row.programme?.reference_number,
        row.programme?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter, search]);

  const lastPage = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const paged = useMemo(
    () => slicePage(filtered, Math.min(page, lastPage), DEFAULT_PAGE_SIZE),
    [filtered, page, lastPage],
  );

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `procurement-intake-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        reference: r.reference_number,
        title: r.title,
        status: r.status,
        pif: r.programme?.reference_number ?? "",
        value: r.estimated_value,
        currency: r.currency,
        submitted_at: r.submitted_at ?? "",
      })),
      [
        { key: "reference", header: t("procurement.col.reference") },
        { key: "title", header: t("procurement.col.title") },
        { key: "status", header: t("procurement.col.status") },
        { key: "pif", header: "PIF" },
        { key: "currency", header: t("procurement.col.currency") },
        { key: "value", header: t("procurement.col.value") },
        { key: "submitted_at", header: t("procurement.col.submitted") },
      ],
    );
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ProcurementPageHeader
        title={t("procurement.intake.title")}
        subtitle={t("procurement.intake.subtitle")}
        crumbs={[
          { label: "nav.procurement", href: "/procurement" },
          { label: t("procurement.intake.crumb") },
        ]}
        actions={
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t("procurement.exportCsv")}
          </button>
        }
      />

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">{t("procurement.intake.loadError")}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => void refetch()}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: t("procurement.intake.kpi.packages"), value: rows.length, icon: "inbox", color: "text-primary", bg: "bg-primary/10" },
            {
              label: t("procurement.intake.kpi.matching"),
              value: filtered.length,
              icon: "filter_alt",
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              label: t("procurement.intake.kpi.drafts"),
              value: rows.filter((r) => r.status === "draft").length,
              icon: "edit_note",
              color: "text-neutral-600",
              bg: "bg-neutral-100",
            },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-500">{s.label}</p>
                  <p className="mt-0.5 text-lg font-bold text-neutral-900">{s.value}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg}`}>
                  <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder={t("procurement.intake.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setFilter(tab.key);
                  setPage(1);
                }}
                className={`filter-tab ${filter === tab.key ? "active" : ""}`}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="inbox"
            title={rows.length === 0 ? t("procurement.intake.empty") : t("procurement.noMatches")}
            description={
              rows.length === 0
                ? t("procurement.intake.emptyHint")
                : t("procurement.noMatchesHint")
            }
            action={
              rows.length === 0 ? (
                <Link href="/pif" className="btn-secondary text-sm">{t("procurement.intake.browseProgrammes")}</Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>{t("procurement.col.reference")}</th>
                  <th>{t("procurement.col.title")}</th>
                  <th>PIF</th>{/* i18n-ignore */}
                  <th>{t("procurement.col.status")}</th>
                  <th>{t("procurement.col.value")}</th>
                  <th>{t("procurement.col.submitted")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => {
                  const sc = STATUS_CONFIG[row.status] ?? {
                    label: "",
                    badge: "badge-muted",
                  };
                  const statusLabel = sc.label ? t(sc.label) : row.status.replace(/_/g, " ");
                  return (
                    <tr key={row.id}>
                      <td className="font-mono text-xs">{row.reference_number}</td>
                      <td className="max-w-sm font-medium text-neutral-900">
                        <span className="line-clamp-2">{row.title}</span>
                      </td>
                      <td className="text-xs">
                        {row.programme ? (
                          <Link
                            href={`/pif/${row.programme.id}`}
                            className="btn-secondary font-mono text-xs"
                          >
                            {row.programme.reference_number}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span className={`badge text-xs capitalize ${sc.badge}`}>{statusLabel}</span>
                      </td>
                      <td className="whitespace-nowrap font-mono text-sm">
                        {row.currency} {Number(row.estimated_value ?? 0).toLocaleString()}
                      </td>
                      <td className="text-xs text-neutral-500">
                        {row.submitted_at ? formatDateShort(row.submitted_at) : "—"}
                      </td>
                      <td>
                        <Link
                          href={`/procurement/${row.id}`}
                          className="btn-secondary text-xs"
                        >
                          {t("procurement.view")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && filtered.length > 0 && (
          <ListPagination
            page={Math.min(page, lastPage)}
            lastPage={lastPage}
            total={filtered.length}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
