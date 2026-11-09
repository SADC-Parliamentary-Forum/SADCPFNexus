"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { correspondenceApi, type CorrespondenceLetter } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const statusConfig: Record<string, { label: string; cls: string }> = {
  draft: { label: "status.draft", cls: "badge-muted" },
  pending_review: { label: "correspondence.status.pendingReview", cls: "badge-warning" },
  pending_approval: { label: "correspondence.status.pendingApproval", cls: "badge-warning" },
  approved: { label: "status.approved", cls: "badge-success" },
  signed: { label: "correspondence.status.signed", cls: "badge-success" },
  ready_dispatch: { label: "correspondence.status.readyDispatch", cls: "badge-success" },
  sent: { label: "correspondence.status.sent", cls: "badge-success" },
  archived: { label: "correspondence.status.archived", cls: "badge-muted" },
  pending_sg_routing: { label: "correspondence.status.pendingSgRouting", cls: "badge-warning" },
  routed: { label: "correspondence.status.routed", cls: "badge-warning" },
  in_progress: { label: "correspondence.status.inProgress", cls: "badge-warning" },
  voided: { label: "correspondence.status.voided", cls: "badge-muted" },
};

const typeLabel: Record<string, string> = {
  internal_memo: "correspondence.type.memo",
  external: "correspondence.type.external",
  diplomatic_note: "correspondence.type.diplomatic",
  procurement: "nav.procurement",
};

function safeIsoDay(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function CorrespondenceRegistryPageInner() {
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [letters, setLetters] = useState<CorrespondenceLetter[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "all");
  const [filterDir, setFilterDir] = useState(searchParams.get("direction") || "all");

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, per_page: 25 };
    if (search) params.search = search;
    if (filterStatus !== "all") params.status = filterStatus;
    if (filterDir !== "all") params.direction = filterDir;

    correspondenceApi
      .list(params)
      .then((res) => {
        setLetters(res.data.data ?? []);
        setTotal(res.data.total ?? 0);
        setLastPage(res.data.last_page ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, filterStatus, filterDir]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    const rows = [
      [t("correspondence.col.reference"), t("correspondence.col.subject"), t("correspondence.col.type"), t("correspondence.col.direction"), t("correspondence.col.status"), t("correspondence.col.owner"), t("correspondence.col.createdBy"), t("correspondence.col.date")],
      ...letters.map((l) => [
        l.registry_reference || l.reference_number || "",
        l.subject,
        typeLabel[l.type] ? t(typeLabel[l.type]) : l.type,
        l.direction,
        l.status,
        l.primary_owner?.name ?? "",
        l.creator?.name ?? "",
        safeIsoDay(l.created_at),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "correspondence-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title={t("correspondence.hub.title")}
        subtitle={t("correspondence.registry.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("correspondence.hub.title") }]} />}
      />
        <div className="flex gap-2">
          <Link href="/correspondence/incoming" className="btn-secondary text-sm">{t("correspondence.hub.registerIncoming")}</Link>
          <Link href="/correspondence/create" className="btn-primary text-sm">{t("correspondence.hub.draftOutgoing")}</Link>
          <button type="button" className="btn-secondary text-sm" onClick={exportCsv}>{t("correspondence.exportCsv")}</button>
        </div>
      </div>

      <div className="card p-4 grid gap-3 sm:grid-cols-4">
        <input
          className="form-input sm:col-span-2"
          placeholder={t("correspondence.search")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="form-input"
          value={filterDir}
          onChange={(e) => {
            setFilterDir(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">{t("correspondence.allDirections")}</option>
          <option value="incoming">{t("correspondence.direction.incoming")}</option>
          <option value="outgoing">{t("correspondence.direction.outgoing")}</option>
        </select>
        <select
          className="form-input"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">{t("correspondence.allStatuses")}</option>
          {Object.entries(statusConfig).map(([k, v]) => (
            <option key={k} value={k}>{t(v.label)}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-3">{t("correspondence.col.reference")}</th>
              <th className="px-4 py-3">{t("correspondence.col.subject")}</th>
              <th className="px-4 py-3">{t("correspondence.col.type")}</th>
              <th className="px-4 py-3">{t("correspondence.col.dir")}</th>
              <th className="px-4 py-3">{t("correspondence.col.status")}</th>
              <th className="px-4 py-3">{t("correspondence.col.owner")}</th>
              <th className="px-4 py-3">{t("correspondence.col.date")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-400">{t("common.loading")}</td></tr>
            )}
            {!loading && letters.length === 0 && (
              <TableEmpty colSpan={7} title={t("correspondence.registry.empty")} />
            )}
            {letters.map((l) => {
              const cfg = statusConfig[l.status];
              const st = cfg ? { label: t(cfg.label), cls: cfg.cls } : { label: l.status, cls: "badge-muted" };
              return (
                <tr key={l.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/correspondence/${l.id}`} className="font-medium text-primary">
                      {l.registry_reference || l.reference_number || `#${l.id}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{l.subject}</td>
                  <td className="px-4 py-3">{typeLabel[l.type] ? t(typeLabel[l.type]) : l.type}</td>
                  <td className="px-4 py-3 capitalize">{l.direction}</td>
                  <td className="px-4 py-3"><span className={st.cls}>{st.label}</span></td>
                  <td className="px-4 py-3">{l.primary_owner?.name || "—"}</td>
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">{safeIsoDay(l.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>{t("correspondence.registry.records", { count: total })}</span>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("common.previous")}</button>
          <span>{t("correspondence.registry.page", { page, total: lastPage })}</span>
          <button type="button" className="btn-secondary text-xs" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</button>
        </div>
      </div>
    </div>
  );
}

export default function CorrespondenceRegistryPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">{t("correspondence.registry.loading")}</div>}>
      <CorrespondenceRegistryPageInner />
    </Suspense>
  );
}