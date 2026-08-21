"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { travelApi } from "@/lib/api";

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  color,
  bg,
  href,
  hint,
}: {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  bg: string;
  href?: string;
  hint?: string;
}) {
  const inner = (
    <div
      className={`card flex items-center gap-3 p-4 ${href ? "cursor-pointer transition-shadow hover:shadow-md" : ""}`}
    >
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${bg}`}>
        <span className={`material-symbols-outlined text-[22px] ${color}`}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-tight text-neutral-900 dark:text-neutral-100">{value}</p>
        <p className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function KpiCardSkeleton() {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="h-11 w-11 flex-shrink-0 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-6 w-10 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
        <div className="h-3 w-20 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
      </div>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{title}</h2>
      <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{subtitle}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const QUEUE_HREF = "/travel/queues/admin";

export default function TravelAdminDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["travel", "dashboard", "admin"],
    queryFn: () => travelApi.dashboardAdmin().then((r) => r.data.data),
  });

  // bookings_pending / tickets_pending / readiness_issues are the same
  // underlying query on the backend (approved trips with no booking
  // committed yet) — shown once here as "Bookings to confirm" instead of
  // three identical numbers under different labels.
  const bookingsPending = data?.bookings_pending ?? data?.tickets_pending ?? data?.readiness_issues ?? 0;

  const needsAction = [
    {
      label: "Needs itinerary",
      value: data?.needs_itinerary ?? 0,
      icon: "route",
      color: "text-rose-600 dark:text-rose-300",
      bg: "bg-rose-50 dark:bg-rose-900/20",
      hint: "Submitted or approved requests with no itinerary added yet.",
    },
    {
      label: "Bookings to confirm",
      value: bookingsPending,
      icon: "confirmation_number",
      color: "text-orange-600 dark:text-orange-300",
      bg: "bg-orange-50 dark:bg-orange-900/20",
      hint: "Approved trips still waiting on a committed booking.",
    },
    {
      label: "Visas pending",
      value: data?.visas_pending ?? 0,
      icon: "badge",
      color: "text-amber-600 dark:text-amber-300",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      hint: "Visa required and not yet issued.",
    },
    {
      label: "Accommodation pending",
      value: data?.accommodation_pending ?? 0,
      icon: "hotel",
      color: "text-amber-600 dark:text-amber-300",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      hint: "Approved trips with no accommodation recorded.",
    },
    {
      label: "Amendments open",
      value: data?.amendments_open ?? 0,
      icon: "edit_note",
      color: "text-primary dark:text-primary",
      bg: "bg-primary/10",
      hint: "Pending changes awaiting review.",
    },
  ];

  const overview = [
    {
      label: "Departing soon",
      value: data?.departing_soon ?? 0,
      icon: "flight_takeoff",
      color: "text-primary",
      bg: "bg-primary/10",
      hint: "Approved trips departing in the next 14 days.",
    },
    {
      label: "New approved",
      value: data?.new_approved ?? 0,
      icon: "check_circle",
      color: "text-green-600 dark:text-green-300",
      bg: "bg-green-50 dark:bg-green-900/20",
      hint: "Approved in the last 7 days.",
    },
    {
      label: "Vehicle requests",
      value: data?.vehicle_requests ?? 0,
      icon: "directions_car",
      color: "text-sky-600 dark:text-sky-300",
      bg: "bg-sky-50 dark:bg-sky-900/20",
      hint: "Active requests needing a pool vehicle.",
    },
    {
      label: "Missions",
      value: data?.missions ?? 0,
      icon: "flag",
      color: "text-indigo-600 dark:text-indigo-300",
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
      hint: "Total missions on record.",
    },
    {
      label: "Cancellations",
      value: data?.cancellations ?? 0,
      icon: "cancel",
      color: "text-neutral-500 dark:text-neutral-400",
      bg: "bg-neutral-100 dark:bg-neutral-700/40",
      hint: "Cancelled travel requests.",
    },
  ];

  const totalNeedsAction = needsAction.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <ModulePageHeader
        title="Administration Travel Dashboard"
        subtitle="Logistics readiness across itineraries, bookings, visas, and accommodation for approved trips."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Travel", href: "/travel" }, { label: "Administration dashboard" }]} />}
        actions={
          <Link href={QUEUE_HREF} className="btn-primary flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">checklist</span>
            Open admin queue
          </Link>
        }
      />

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
          Unable to load the admin dashboard. Try refreshing the page.
        </div>
      )}

      {!isError && (
        <div className="space-y-6" data-testid="travel-admin-dashboard">
          <section className="space-y-3">
            <SectionHeading
              title="Needs action"
              subtitle="Approved or in-progress trips waiting on administration or logistics work."
            />
            {!isLoading && totalNeedsAction === 0 ? (
              <div className="card flex items-center gap-3 p-4 text-sm text-neutral-600 dark:text-neutral-300">
                <span className="material-symbols-outlined text-[20px] text-green-600 dark:text-green-400">
                  task_alt
                </span>
                Nothing outstanding — every approved trip is itineraried, booked, and documented.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
                  : needsAction.map((item) => (
                      <div key={item.label} title={item.hint}>
                        <KpiCard
                          label={item.label}
                          value={item.value}
                          icon={item.icon}
                          color={item.color}
                          bg={item.bg}
                          href={Number(item.value) > 0 ? QUEUE_HREF : undefined}
                        />
                      </div>
                    ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <SectionHeading title="Overview" subtitle="Wider trip and mission activity for context." />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)
                : overview.map((item) => (
                    <div key={item.label} title={item.hint}>
                      <KpiCard
                        label={item.label}
                        value={item.value}
                        icon={item.icon}
                        color={item.color}
                        bg={item.bg}
                      />
                    </div>
                  ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
