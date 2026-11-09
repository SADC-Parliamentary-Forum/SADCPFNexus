"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { decisionsApi, type MeetingDecision } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE, getLastPage, getListData, getTotal } from "@/lib/listPagination";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { RegisterMobileCards } from "@/components/ui/RegisterMobileCards";
import { Badge } from "@/components/ui/Badge";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_CONFIG: Record<string, { label: string; cls: string; variant: "muted" | "success" | "primary" | "warning" }> = {
  draft: { label: "decisions.status.draft", cls: "badge-muted", variant: "muted" },
  adopted: { label: "decisions.status.adopted", cls: "badge-success", variant: "success" },
  in_progress: { label: "decisions.status.in_progress", cls: "badge-primary", variant: "primary" },
  implemented: { label: "decisions.status.implemented", cls: "badge-success", variant: "success" },
  closed: { label: "decisions.status.closed", cls: "badge-muted", variant: "muted" },
  superseded: { label: "decisions.status.superseded", cls: "badge-warning", variant: "warning" },
};

const TYPE_LABEL: Record<string, string> = {
  resolution: "decisions.type.resolution",
  management_decision: "decisions.type.management_decision",
};

const STATUS_FILTERS = [
  { key: "All", label: "decisions.filter.all", value: undefined },
  { key: "Draft", label: "decisions.status.draft", value: "draft" },
  { key: "Adopted", label: "decisions.status.adopted", value: "adopted" },
  { key: "In Progress", label: "decisions.status.in_progress", value: "in_progress" },
  { key: "Implemented", label: "decisions.status.implemented", value: "implemented" },
  { key: "Closed", label: "decisions.status.closed", value: "closed" },
] as const;

export default function DecisionsRegisterPage() {
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["decisions", "list", statusFilter, typeFilter, q, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { per_page: DEFAULT_PAGE_SIZE, page };
      const status = STATUS_FILTERS.find((f) => f.key === statusFilter)?.value;
      if (status) params.status = status;
      if (typeFilter === "resolution" || typeFilter === "management_decision") {
        params.decision_type = typeFilter;
      }
      if (q.trim()) params.q = q.trim();
      return (await decisionsApi.list(params)).data;
    },
    staleTime: 20_000,
  });

  const { data: dash } = useQuery({
    queryKey: ["decisions", "dashboard"],
    queryFn: async () => (await decisionsApi.dashboard()).data.data,
    staleTime: 30_000,
  });

  const rows = useMemo(() => getListData<MeetingDecision>(data), [data]);
  const lastPage = getLastPage(data);
  const total = getTotal(data, rows.length);

  return (
    <RegisterShell
      title="decisions.register.title"
      subtitle="decisions.register.subtitle"
      breadcrumbs={<PageBreadcrumbs items={[{ label: "decisions.crumb.governance", href: "/governance" }, { label: "decisions.register.title" }]} />}
      density={density}
      onDensityChange={setDensity}
      page={Math.min(page, lastPage)}
      pageCount={lastPage}
      total={total}
      onPageChange={setPage}
      loading={isLoading}
      actions={
        <>
          <Link href="/decisions/dashboard" className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">dashboard</span>
            {t("nav.dashboard")}
          </Link>
          <Link href="/decisions/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("decisions.new")}
          </Link>
        </>
      }
      stats={
        dash ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t("decisions.stat.total")} value={dash.total} />
            <Stat label={t("decisions.stat.overdue")} value={dash.overdue} />
            <Stat label={t("decisions.stat.openCritical")} value={dash.open_critical_actions} />
            <Stat label={t("decisions.status.inProgress")} value={dash.by_status.in_progress ?? 0} />
          </div>
        ) : undefined
      }
      filters={
        <div className="flex flex-col gap-3">
          <div className="relative max-w-md">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-neutral-400">
              search
            </span>
            <input
              className="form-input pl-9"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={t("decisions.register.searchPlaceholder")}
              aria-label={t("decisions.register.searchAria")}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => {
                  setStatusFilter(f.key);
                  setPage(1);
                }}
                className={`filter-tab${statusFilter === f.key ? " active" : ""}`}
              >
                {t(f.label)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "decisions.filter.all", value: "All" },
              { key: "decisions.filter.resolutions", value: "resolution" },
              { key: "decisions.filter.management", value: "management_decision" },
            ].map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setTypeFilter(f.value);
                  setPage(1);
                }}
                className={`filter-tab${typeFilter === f.value ? " active" : ""}`}
              >
                {t(f.key)}
              </button>
            ))}
          </div>
        </div>
      }
      empty={
        !isLoading && rows.length === 0 ? (
          <div className="card overflow-hidden">
            {isError ? (
              <EmptyState
                icon="error"
                title="decisions.register.loadFailed"
                description="decisions.register.loadFailedHint"
              />
            ) : (
              <EmptyState
                icon="gavel"
                title="decisions.register.empty"
                description={
                  q || statusFilter !== "All" || typeFilter !== "All"
                    ? "decisions.register.noMatch"
                    : "decisions.register.emptyHint"
                }
                action={
                  <Link href="/decisions/create" className="btn-primary text-sm">
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    {t("decisions.new")}
                  </Link>
                }
              />
            )}
          </div>
        ) : undefined
      }
    >
      <div className="card overflow-hidden">
        <RegisterMobileCards
          items={rows}
          getKey={(d) => d.id}
          title={(d) => d.reference_number}
          subtitle={(d) => d.title}
          badge={(d) => {
            const st = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.draft;
            return <Badge variant={st.variant}>{t(st.label)}</Badge>;
          }}
          fields={(d) => [
            { label: t("decisions.col.type"), value: TYPE_LABEL[d.decision_type] ? t(TYPE_LABEL[d.decision_type]) : d.decision_type },
            { label: t("decisions.col.owner"), value: d.owner?.name ?? "—" },
            { label: t("decisions.col.due"), value: d.due_date ? formatDateShort(d.due_date) : "—" },
          ]}
          actions={(d) => (
            <Link href={`/decisions/${d.id}`} className="btn-secondary text-xs py-1 px-2">
              {t("decisions.view")}
            </Link>
          )}
        />
        <div className="hidden overflow-x-auto md:block">
          <table className="data-table w-full">
            <caption className="sr-only">{t("decisions.register.caption")}</caption>
            <thead>
              <tr>
                <th>{t("decisions.col.reference")}</th>
                <th>{t("decisions.col.title")}</th>
                <th>{t("decisions.col.type")}</th>
                <th>{t("decisions.col.owner")}</th>
                <th>{t("decisions.col.due")}</th>
                <th>{t("decisions.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const st = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.draft;
                return (
                  <tr key={d.id}>
                    <td className="font-mono text-xs">
                      <Link href={`/decisions/${d.id}`} className="font-medium text-primary">
                        {d.reference_number}
                      </Link>
                      {d.is_confidential ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase text-amber-600">{t("decisions.confidential")}</span>
                      ) : null}
                    </td>
                    <td>
                      <Link href={`/decisions/${d.id}`} className="font-medium text-neutral-900 dark:text-neutral-100">
                        {d.title}
                      </Link>
                    </td>
                    <td className="text-neutral-600">{TYPE_LABEL[d.decision_type] ? t(TYPE_LABEL[d.decision_type]) : d.decision_type}</td>
                    <td className="text-neutral-600">{d.owner?.name ?? "—"}</td>
                    <td className="text-neutral-600">{d.due_date ? formatDateShort(d.due_date) : "—"}</td>
                    <td>
                      <span className={st.cls}>{t(st.label)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </RegisterShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">{value}</p>
    </div>
  );
}
