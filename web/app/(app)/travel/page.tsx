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
import { EmptyState } from "@/components/ui/EmptyState";
import { TRAVEL_HUB_CARDS, type TravelHubCard, type TravelHubSection } from "@/lib/travelHub";

const statusConfig: Record<string, { label: string; cls: string }> = {
  approved:  { label: "Approved",  cls: "badge-success" },
  submitted: { label: "Submitted", cls: "badge-warning" },
  rejected:  { label: "Rejected",  cls: "badge-danger"  },
  draft:     { label: "Draft",     cls: "badge-muted"   },
  cancelled: { label: "Cancelled", cls: "badge-muted"   },
  returned_for_correction: { label: "Returned", cls: "badge-warning" },
};

const FILTERS = ["All", "Draft", "Submitted", "Approved", "Rejected"] as const;
const filterMap: Record<string, string | undefined> = {
  All: undefined, Draft: "draft", Submitted: "submitted", Approved: "approved", Rejected: "rejected",
};

const HUB_SECTIONS: { id: TravelHubSection; title: string; description: string; icon: string }[] = [
  { id: "queues", title: "Work queues", description: "Approvals, administration, finance, and retirement.", icon: "fact_check" },
  { id: "views", title: "Registers & views", description: "Calendar, missions, and who is away or upcoming.", icon: "menu_book" },
  { id: "tools", title: "Tools & policy", description: "Advances, TOIL, reports, visas, and DSA rates.", icon: "tune" },
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
  return (
    <Link
      href={card.href}
      className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <span className="material-symbols-outlined mt-0.5 text-primary">{card.icon}</span>
      <span>
        <span className="block text-sm font-semibold text-neutral-900">{card.title}</span>
        <span className="mt-0.5 block text-xs text-neutral-500">{card.purpose}</span>
      </span>
    </Link>
  );
}

function TravelPageInner() {
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

  const title = view === "upcoming" ? "Upcoming Travel"
    : view === "away" ? "Travellers Away"
    : view === "approved" ? "Approved Travel"
    : scope === "mine" ? "My Travel Requests"
    : "Travel Administration";

  const subtitle = view || scope
    ? "Manage travel requisitions, readiness, and retirement."
    : "Queues, registers, and tools in one place — without a long submenu.";

  const crumbItems = view || scope
    ? [{ label: "Travel", href: "/travel" }, { label: title }]
    : [{ label: "Travel" }];

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
        { key: "reference", header: "Reference" },
        { key: "purpose", header: "Purpose" },
        { key: "destination", header: "Destination" },
        { key: "requester", header: "Requester" },
        { key: "status", header: "Status" },
        { key: "departure_date", header: "Departure" },
        { key: "return_date", header: "Return" },
      ],
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={<PageBreadcrumbs items={crumbItems} />}
        actions={
          <>
            {canRegister ? (
              <Link href="/travel/register" className="btn-secondary text-sm">
                <span className="material-symbols-outlined text-[18px]">menu_book</span>
                Open register
              </Link>
            ) : null}
            {canCreate ? (
              <Link href="/travel/create" className="btn-primary text-sm">
                <span className="material-symbols-outlined text-[18px]">add</span>
                New request
              </Link>
            ) : null}
          </>
        }
      />

      {dash && !view && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="travel-traveller-dashboard">
          <StatCard label="Drafts" value={dash.drafts ?? 0} href="/travel?scope=mine" />
          <StatCard label="Pending" value={dash.pending_approvals ?? 0} href="/travel?scope=mine" />
          <StatCard label="Upcoming" value={dash.upcoming ?? 0} href="/travel?view=upcoming" />
          <StatCard label="Current trip" value={dash.current_trip ?? 0} href="/travel?view=away" />
          <StatCard label="Retirement due" value={dash.retirement_due ?? 0} href="/travel/queues/retirement" />
          <StatCard label="TOIL pending" value={dash.toil_pending ?? 0} href="/travel/toil" />
          <StatCard label="Historical" value={dash.historical ?? 0} href="/travel?view=approved" />
          <StatCard label="Docs pending" value={dash.documents_pending ?? 0} />
        </div>
      )}

      {canSeeAdmin && adminDash ? (
        <FormSection
          title="Administration readiness"
          description="Bookings, visas, and itineraries still waiting on logistics."
          icon="admin_panel_settings"
          dense
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="travel-hub-admin-dashboard">
            <StatCard label="Needs itinerary" value={adminDash.needs_itinerary ?? 0} href="/travel/queues/admin" />
            <StatCard
              label="Bookings to confirm"
              value={adminDash.bookings_pending ?? adminDash.tickets_pending ?? 0}
              href="/travel/queues/admin"
            />
            <StatCard label="Visas pending" value={adminDash.visas_pending ?? 0} href="/travel/dashboards/admin" />
            <StatCard label="Accommodation pending" value={adminDash.accommodation_pending ?? 0} href="/travel/queues/admin" />
          </div>
        </FormSection>
      ) : null}

      {canSeeFinance && financeDash ? (
        <FormSection
          title="Finance queues"
          description="DSA, advances, and retirement still with Finance."
          icon="account_balance"
          dense
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="travel-hub-finance-dashboard">
            <StatCard label="DSA pending" value={financeCount("dsa_pending")} href="/travel/queues/finance" />
            <StatCard label="Funds confirmation" value={financeCount("funds_confirmation_pending")} href="/travel/queues/finance" />
            <StatCard label="Travel advances" value={financeCount("travel_advances")} href="/imprest?linked=travel" />
            <StatCard label="Overdue retirement" value={financeCount("overdue_retirement")} href="/travel/queues/retirement" />
          </div>
        </FormSection>
      ) : null}

      {HUB_SECTIONS.map((section) => {
        const cards = visibleCards.filter((card) => card.section === section.id);
        if (cards.length === 0) return null;
        return (
          <FormSection key={section.id} title={section.title} description={section.description} icon={section.icon} dense>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <FeatureCard key={`${card.section}-${card.title}-${card.href}`} card={card} />
              ))}
            </div>
          </FormSection>
        );
      })}

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">Failed to load travel requests.</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      )}

      <FormSection
        title="Travel requests"
        description="Search by traveller name, reference, or destination."
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
            Export CSV
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
              placeholder="Search reference, purpose, destination…"
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
                {f}
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
                  <th>Reference</th>
                  <th>Purpose</th>
                  <th>Destination</th>
                  <th>Requester</th>
                  <th>Stage</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const cfg = statusConfig[r.status] ?? { label: r.status || "Unknown", cls: "badge-muted" };
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
                          <Link href={`/travel/${r.id}`} className="text-xs font-medium text-primary hover:underline">
                            View
                          </Link>
                          {canEdit && (
                            <Link href={`/travel/create?edit=${r.id}`} className="text-xs font-medium text-neutral-600 hover:underline">
                              Edit
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
            title="No travel requests found"
            description="Create a requisition or adjust the status filter."
            action={
              canCreate ? (
                <Link href="/travel/create" className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  New request
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
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">Loading travel…</div>}>
      <TravelPageInner />
    </Suspense>
  );
}
