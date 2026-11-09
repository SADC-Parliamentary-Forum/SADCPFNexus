"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { travelApi, type TravelRequest } from "@/lib/api";
import { canAccessRoute, getStoredUser } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { getListData } from "@/lib/listPagination";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { TRAVEL_HUB_CARDS, type TravelHubCard, type TravelHubSection } from "@/lib/travelHub";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/** Status badges; `label` is a catalog key translated where it renders. */
const statusConfig: Record<string, { label: string; cls: string }> = {
  approved:  { label: "travel.hub.status.approved",  cls: "badge-success" },
  submitted: { label: "travel.hub.status.submitted", cls: "badge-warning" },
  rejected:  { label: "travel.hub.status.rejected",  cls: "badge-danger"  },
  draft:     { label: "travel.hub.status.draft",     cls: "badge-muted"   },
  cancelled: { label: "travel.hub.status.cancelled", cls: "badge-muted"   },
  returned_for_correction: { label: "travel.hub.status.returned", cls: "badge-warning" },
};

const FILTERS = ["All", "Draft", "Submitted", "Approved", "Rejected"] as const;
const filterMap: Record<string, string | undefined> = {
  All: undefined, Draft: "draft", Submitted: "submitted", Approved: "approved", Rejected: "rejected",
};
const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = {
  All: "travel.hub.filter.all",
  Draft: "travel.hub.status.draft",
  Submitted: "travel.hub.status.submitted",
  Approved: "travel.hub.status.approved",
  Rejected: "travel.hub.status.rejected",
};

/** Section headings are catalog keys, translated where they render. */
const HUB_SECTIONS: { id: TravelHubSection; title: string; description: string; icon: string }[] = [
  { id: "queues", title: "travel.hub.section.queues.title", description: "travel.hub.section.queues.description", icon: "fact_check" },
  { id: "views", title: "travel.hub.section.views.title", description: "travel.hub.section.views.description", icon: "menu_book" },
  { id: "tools", title: "travel.hub.section.tools.title", description: "travel.hub.section.tools.description", icon: "tune" },
];

function StatCard({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const inner = (
    <div className="card p-5">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function FeatureCard({ card }: { card: TravelHubCard }) {
  const { t } = useI18n();
  return (
    <Link
      href={card.href}
      className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <span className="material-symbols-outlined mt-0.5 text-primary">{card.icon}</span>
      <span>
        <span className="block text-sm font-semibold text-neutral-900">{t(card.title)}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{t(card.purpose)}</span>
      </span>
    </Link>
  );
}

function TravelPageInner() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || undefined;
  const view = searchParams.get("view") || undefined;
  const user = getStoredUser();
  const [statusFilter, setStatusFilter] = useState<string>(
    view === "approved" || view === "upcoming" || view === "away" ? "Approved" : "All"
  );
  const [search, setSearch] = useState("");

  const canCreate = canAccessRoute(user, "/travel/create");
  const canRegister = canAccessRoute(user, "/travel/register");
  const canSeeAdmin = canAccessRoute(user, "/travel/dashboards/admin");
  const canSeeFinance = canAccessRoute(user, "/travel/dashboards/finance");

  const visibleCards = useMemo(
    () => TRAVEL_HUB_CARDS.filter((card) => canAccessRoute(user, card.href)),
    [user],
  );

  const { data: dash } = useQuery({
    queryKey: ["travel", "dashboard", "traveller"],
    queryFn: () => travelApi.dashboardTraveller().then((r) => r.data.data),
    staleTime: 30_000,
  });

  const { data: adminDash } = useQuery({
    queryKey: ["travel", "dashboard", "admin"],
    queryFn: () => travelApi.dashboardAdmin().then((r) => r.data.data),
    staleTime: 30_000,
    enabled: canSeeAdmin,
  });

  const { data: financeDash } = useQuery({
    queryKey: ["travel", "dashboard", "finance"],
    queryFn: () => travelApi.dashboardFinance().then((r) => r.data.data),
    staleTime: 30_000,
    enabled: canSeeFinance,
  });

  const financeCount = (key: string) => {
    const value = financeDash?.[key];
    return typeof value === "number" ? value : 0;
  };

  const listParams = useMemo(() => {
    const params: Record<string, string | number> = { per_page: 100 };
    const status = filterMap[statusFilter];
    if (status) params.status = status;
    if (scope === "mine") params.scope = "mine";
    return params;
  }, [statusFilter, scope]);

  const { data: requests = [], isLoading: loading, isError, refetch } = useQuery({
    queryKey: ["travel", "list", listParams, view],
    queryFn: () => travelApi.list(listParams).then((res) => getListData<TravelRequest>(res.data)),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let rows = requests;
    if (view === "upcoming") {
      rows = rows.filter((r) => r.status === "approved" && (r.departure_date ?? "") > today);
    } else if (view === "away") {
      rows = rows.filter(
        (r) =>
          r.status === "approved" &&
          (r.departure_date ?? "") <= today &&
          (r.return_date ?? "") >= today,
      );
    } else if (view === "approved") {
      rows = rows.filter((r) => r.status === "approved");
    }
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.reference_number,
        r.purpose,
        r.destination_city,
        r.destination_country,
        r.status,
        r.requester?.name,
        r.workflow_stage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [requests, view, search]);

  const destination = (r: TravelRequest) =>
    [r.destination_city, r.destination_country].filter(Boolean).join(", ") || r.destination_country || "—";

  const title = view === "upcoming" ? t("travel.hub.title.upcoming")
    : view === "away" ? t("travel.hub.title.away")
    : view === "approved" ? t("travel.hub.title.approved")
    : scope === "mine" ? t("travel.hub.title.mine")
    : t("travel.hub.title.admin");

  const subtitle = view || scope
    ? t("travel.hub.subtitle.filtered")
    : t("travel.hub.subtitle.hub");

  const crumbItems = view || scope
    ? [{ label: t("nav.travel"), href: "/travel" }, { label: title }]
    : [{ label: t("nav.travel") }];

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `travel-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        reference: r.reference_number,
        purpose: r.purpose,
        destination: destination(r),
        requester: r.requester?.name,
        status: r.status,
        departure_date: r.departure_date,
        return_date: r.return_date,
      })),
      [
        { key: "reference", header: t("travel.mission.col.reference") },
        { key: "purpose", header: t("salaryAdvances.certificate.purpose") },
        { key: "destination", header: t("travel.missions.col.destination") },
        { key: "requester", header: t("travel.certificate.requester") },
        { key: "status", header: t("travel.mission.col.status") },
        { key: "departure_date", header: t("travel.calendar.type.departure") },
        { key: "return_date", header: t("travel.calendar.type.return") },
      ],
    );
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={<PageBreadcrumbs items={crumbItems} />}
        actions={
          <>
            {canRegister ? (
              <Link href="/travel/register" className="btn-secondary text-sm">
                <span className="material-symbols-outlined text-[18px]">menu_book</span>
                {t("travel.hub.openRegister")}
              </Link>
            ) : null}
            {canCreate ? (
              <Link href="/travel/create" className="btn-primary text-sm">
                <span className="material-symbols-outlined text-[18px]">add</span>
                {t("travel.hub.newRequest")}
              </Link>
            ) : null}
          </>
        }
      />

      {dash && !view && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="travel-traveller-dashboard">
          <StatCard label={t("travel.hub.stat.drafts")} value={dash.drafts ?? 0} href="/travel?scope=mine" />
          <StatCard label={t("travel.hub.stat.pending")} value={dash.pending_approvals ?? 0} href="/travel?scope=mine" />
          <StatCard label={t("travel.hub.stat.upcoming")} value={dash.upcoming ?? 0} href="/travel?view=upcoming" />
          <StatCard label={t("travel.hub.stat.currentTrip")} value={dash.current_trip ?? 0} href="/travel?view=away" />
          <StatCard label={t("travel.hub.stat.retirementDue")} value={dash.retirement_due ?? 0} href="/travel/queues/retirement" />
          <StatCard label={t("travel.hub.stat.toilPending")} value={dash.toil_pending ?? 0} href="/travel/toil" />
          <StatCard label={t("travel.hub.stat.historical")} value={dash.historical ?? 0} href="/travel?view=approved" />
          <StatCard label={t("travel.hub.stat.docsPending")} value={dash.documents_pending ?? 0} />
        </div>
      )}

      {canSeeAdmin && adminDash ? (
        <FormSection
          title={t("travel.hub.adminReadiness")}
          description={t("travel.hub.adminReadinessHint")}
          icon="admin_panel_settings"
          dense
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="travel-hub-admin-dashboard">
            <StatCard label={t("travel.adminDash.kpi.needsItinerary.label")} value={adminDash.needs_itinerary ?? 0} href="/travel/queues/admin" />
            <StatCard
              label={t("travel.adminDash.kpi.bookings.label")}
              value={adminDash.bookings_pending ?? adminDash.tickets_pending ?? 0}
              href="/travel/queues/admin"
            />
            <StatCard label={t("travel.adminDash.kpi.visas.label")} value={adminDash.visas_pending ?? 0} href="/travel/dashboards/admin" />
            <StatCard label={t("travel.adminDash.kpi.accommodation.label")} value={adminDash.accommodation_pending ?? 0} href="/travel/queues/admin" />
          </div>
        </FormSection>
      ) : null}

      {canSeeFinance && financeDash ? (
        <FormSection
          title={t("travel.hub.financeQueues")}
          description={t("travel.hub.financeQueuesHint")}
          icon="account_balance"
          dense
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="travel-hub-finance-dashboard">
            <StatCard label={t("travel.financeDash.dsaPending")} value={financeCount("dsa_pending")} href="/travel/queues/finance" />
            <StatCard label={t("travel.financeDash.funds")} value={financeCount("funds_confirmation_pending")} href="/travel/queues/finance" />
            <StatCard label={t("travel.financeDash.advances")} value={financeCount("travel_advances")} href="/imprest?linked=travel" />
            <StatCard label={t("travel.financeDash.overdueRetirement")} value={financeCount("overdue_retirement")} href="/travel/queues/retirement" />
          </div>
        </FormSection>
      ) : null}

      {HUB_SECTIONS.map((section) => {
        const cards = visibleCards.filter((card) => card.section === section.id);
        if (cards.length === 0) return null;
        return (
          <FormSection key={section.id} title={t(section.title)} description={t(section.description)} icon={section.icon} dense>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <FeatureCard key={`${card.section}-${card.title}-${card.href}`} card={card} />
              ))}
            </div>
          </FormSection>
        );
      })}

      {isError && (
        <ErrorBanner message={t("travel.hub.loadFailed")} onRetry={() => void refetch()} />
      )}

      <FormSection
        title={t("travel.hub.requests")}
        description={t("travel.hub.requestsHint")}
        icon="list_alt"
        dense
        actions={
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t("travel.missions.export")}
          </button>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder={t("travel.hub.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`filter-tab ${statusFilter === f ? "active" : ""}`}
              >
                {t(FILTER_LABEL[f])}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>{t("travel.mission.col.reference")}</th>
                  <th>{t("salaryAdvances.certificate.purpose")}</th>
                  <th>{t("travel.missions.col.destination")}</th>
                  <th>{t("travel.certificate.requester")}</th>
                  <th>{t("travel.hub.col.stage")}</th>
                  <th>{t("travel.missions.col.dates")}</th>
                  <th>{t("travel.mission.col.status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const known = statusConfig[r.status];
                  const cfg = known
                    ? { label: t(known.label), cls: known.cls }
                    : { label: r.status || t("travel.hub.status.unknown"), cls: "badge-muted" };
                  const canEdit = r.status === "draft" || r.status === "returned_for_correction";
                  return (
                    <tr key={r.id}>
                      <td className="font-mono text-xs text-neutral-600">{r.reference_number ?? "—"}</td>
                      <td className="max-w-[220px] truncate font-medium text-neutral-900">{r.purpose ?? "—"}</td>
                      <td className="text-sm text-neutral-600">{destination(r)}</td>
                      <td className="whitespace-nowrap text-sm text-neutral-700">{r.requester?.name ?? "—"}</td>
                      <td>
                        <span className="badge badge-muted text-xs">
                          {r.workflow_stage || cfg.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-xs text-neutral-500">
                        {formatDateShort(r.departure_date)} – {formatDateShort(r.return_date)}
                      </td>
                      <td><span className={`badge text-xs ${cfg.cls}`}>{cfg.label}</span></td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/travel/${r.id}`} className="btn-secondary text-xs py-1 px-2">
                            {t("travel.missions.view")}
                          </Link>
                          {canEdit && (
                            <Link href={`/travel/create?edit=${r.id}`} className="btn-secondary text-xs py-1 px-2">
                              {t("common.edit")}
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="flight"
            title={t("travel.hub.empty")}
            description={t("travel.hub.emptyHint")}
            action={
              canCreate ? (
                <Link href="/travel/create" className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  {t("travel.hub.newRequest")}
                </Link>
              ) : null
            }
          />
        )}
      </FormSection>
    </div>
  );
}

export default function TravelPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">{t("travel.hub.loading")}</div>}>
      <TravelPageInner />
    </Suspense>
  );
}
