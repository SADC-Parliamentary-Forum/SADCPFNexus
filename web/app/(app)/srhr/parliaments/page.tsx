"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { parliamentsApi, type Parliament } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function ParliamentsPage() {
  const { t } = useI18n();
  const [parliaments, setParliaments] = useState<Parliament[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);
  const [total, setTotal]             = useState(0);
  const [lastPage, setLastPage]       = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    parliamentsApi
      .list({ search: search || undefined, per_page: 20, page })
      .then((res) => {
        setParliaments(res.data.data ?? []);
        setTotal(res.data.total ?? 0);
        setLastPage(res.data.last_page ?? 1);
      })
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title="srhr.parliamentsPage.title"
        subtitle="srhr.parliamentsPage.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "srhr.parliamentsPage.title" }]} />}
      />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">search</span>
          <input
            className="form-input pl-9"
            placeholder={t("srhr.parliamentsPage.search")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <p className="text-sm text-neutral-500 ml-auto">{t(total === 1 ? "srhr.parliamentsPage.countOne" : "srhr.parliamentsPage.countMany", { count: total })}</p>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("srhr.col.parliament")}</th>
              <th>{t("profile.field.country")}</th>
              <th>{t("profile.field.city")}</th>
              <th>{t("srhr.activeDeployments")}</th>
              <th>{t("hr.timesheets.monthly.status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j}><div className="h-4 bg-neutral-100 rounded animate-pulse w-3/4" /></td>
                    ))}
                  </tr>
                ))
              : parliaments.length === 0
              ? (
                  <TableEmpty colSpan={6} title={t("srhr.parliamentsPage.empty")} />
                )
              : parliaments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <p className="font-medium text-neutral-900 text-sm">{p.name}</p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                          {p.country_code}
                        </span>
                        <span className="text-sm text-neutral-700">{p.country_name}</span>
                      </div>
                    </td>
                    <td className="text-sm text-neutral-600">{p.city ?? "—"}</td>
                    <td>
                      {(p.active_deployments_count ?? 0) > 0 ? (
                        <span className="badge badge-success">{t("srhr.parliamentsPage.activeCount", { count: p.active_deployments_count ?? 0 })}</span>
                      ) : (
                        <span className="text-sm text-neutral-400">{t("hr.timesheets.templates.none")}</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${p.is_active ? "badge-success" : "badge-muted"}`}>
                        {p.is_active ? t("hr.timesheets.templates.active") : t("hr.timesheets.templates.inactive")}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/srhr/parliaments/${p.id}`}
                        className="btn-secondary text-xs py-1 px-2"
                      >
                        {t("hr.timesheets.team.view")}
                      </Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            className="btn-secondary text-xs px-3 py-1.5"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("common.previous")}
          </button>
          <span className="text-xs text-neutral-500">{t("common.pageOf", { page, total: lastPage })}</span>
          <button
            className="btn-secondary text-xs px-3 py-1.5"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common.next")}
          </button>
        </div>
      )}
    </div>
  );
}
