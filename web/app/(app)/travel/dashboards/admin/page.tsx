"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { travelApi } from "@/lib/api";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

export default function TravelAdminDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["travel", "dashboard", "admin"],
    queryFn: () => travelApi.dashboardAdmin().then((r) => r.data.data),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <ModulePageHeader
        title="Administration Travel Dashboard"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Administration Travel Dashboard" }]} />}
      />
        <Link href="/travel/queues/admin" className="btn-primary">Admin queue</Link>
      </div>
      {isLoading && <p className="text-sm text-neutral-400">Loading…</p>}
      {isError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">Unable to load admin dashboard.</div>}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="travel-admin-dashboard">
          <Stat label="New approved" value={data.new_approved ?? 0} />
          <Stat label="Needs itinerary" value={data.needs_itinerary ?? 0} />
          <Stat label="Vehicle requests" value={data.vehicle_requests ?? 0} />
          <Stat label="Bookings pending" value={data.bookings_pending ?? 0} />
          <Stat label="Visas pending" value={data.visas_pending ?? 0} />
          <Stat label="Accommodation pending" value={data.accommodation_pending ?? 0} />
          <Stat label="Departing soon" value={data.departing_soon ?? 0} />
          <Stat label="Amendments open" value={data.amendments_open ?? 0} />
          <Stat label="Missions" value={data.missions ?? 0} />
          <Stat label="Readiness issues" value={data.readiness_issues ?? 0} />
        </div>
      )}
    </div>
  );
}
