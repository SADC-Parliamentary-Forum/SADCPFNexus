"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { assetRequestsApi, type AssetRequest } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { NewAssetRequestModal } from "@/components/assets/NewAssetRequestModal";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending: { label: "assets.requests.status.pending", badge: "badge-warning" },
  approved: { label: "assets.requests.status.approved", badge: "badge-success" },
  rejected: { label: "assets.requests.status.rejected", badge: "badge-danger" },
  fulfilled: { label: "assets.requests.status.fulfilled", badge: "badge-info" },
};

function padId(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}

const FILTER_TABS = ["all", "pending", "approved", "rejected"] as const;
type FilterTab = (typeof FILTER_TABS)[number];

function syncNewQuery(open: boolean) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (open) url.searchParams.set("new", "1");
  else url.searchParams.delete("new");
  window.history.replaceState({}, "", url.pathname + url.search);
}

export default function AssetRequestsPage() {
  const { success } = useToast();
  const { t } = useI18n();
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await assetRequestsApi.list({ per_page: 15, page: pg });
      const payload = res.data;
      const data = payload.data ?? [];
      setRequests(Array.isArray(data) ? data : []);
      setLastPage(payload.last_page ?? 1);
      setPage(pg);
    } catch {
      setError(t("assets.requests.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load(1);
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") setShowNew(true);
  }, []);

  const openNew = () => {
    setShowNew(true);
    syncNewQuery(true);
  };

  const closeNew = () => {
    setShowNew(false);
    syncNewQuery(false);
  };

  const filtered =
    filter === "all"
      ? requests
      : requests.filter((r) => r.status === filter);

  return (
    <div className="w-full space-y-6">
      <ModulePageHeader
        title={t("assets.requests.title")}
        subtitle={t("assets.requests.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "assets.requests.breadcrumbAssets", href: "/assets" },
              { label: "assets.requests.breadcrumb" },
            ]}
          />
        }
        actions={
          <button type="button" onClick={openNew} className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("assets.requests.new")}
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`filter-tab capitalize${filter === tab ? " active" : ""}`}
          >
            {tab === "all" ? t("assets.requests.filter.all") : (STATUS_CONFIG[tab] ? t(STATUS_CONFIG[tab].label) : tab)}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card p-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-neutral-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="inventory_2"
            title={t("assets.requests.empty")}
            description={
              filter !== "all"
                ? t("assets.requests.emptyFiltered")
                : t("assets.requests.emptyHint")
            }
            action={
              <button type="button" onClick={openNew} className="btn-primary inline-flex items-center gap-2 py-2 px-4 text-sm">
                <span className="material-symbols-outlined text-[16px]">add</span>
                {t("assets.requests.new")}
              </button>
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("assets.requests.col.reference")}</th>
                  <th>{t("assets.requests.col.requester")}</th>
                  <th>{t("assets.requests.col.justification")}</th>
                  <th>{t("assets.requests.col.status")}</th>
                  <th>{t("assets.requests.col.submitted")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => {
                  const sc = STATUS_CONFIG[req.status] ? { label: t(STATUS_CONFIG[req.status].label), badge: STATUS_CONFIG[req.status].badge } : { label: req.status, badge: "badge-muted" };
                  return (
                    <tr key={req.id}>
                      <td className="font-mono text-xs text-neutral-600 whitespace-nowrap">
                        {padId(req.id)}
                      </td>
                      <td className="font-medium text-neutral-900 whitespace-nowrap">
                        {req.requester?.name ?? "—"}
                      </td>
                      <td className="text-neutral-600 max-w-[260px] truncate">
                        {req.justification}
                      </td>
                      <td>
                        <span className={`badge text-xs ${sc.badge}`}>{sc.label}</span>
                      </td>
                      <td className="text-neutral-500 whitespace-nowrap text-xs">
                        {formatDate(req.created_at)}
                      </td>
                      <td>
                        <Link
                          href={`/assets/requests/${req.id}`}
                          className="btn-secondary text-xs py-1 px-2 whitespace-nowrap"
                        >
                          {t("assets.requests.view")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {lastPage > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
              <p className="text-xs text-neutral-500">{t("common.pageOf", { page, total: lastPage })}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => void load(page - 1)}
                  className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t("common.previous")}
                </button>
                <button
                  type="button"
                  disabled={page >= lastPage}
                  onClick={() => void load(page + 1)}
                  className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t("common.next")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <NewAssetRequestModal
        open={showNew}
        onClose={closeNew}
        onCreated={() => {
          closeNew();
          success(t("assets.requests.submitted"));
          void load(1);
        }}
      />
    </div>
  );
}
