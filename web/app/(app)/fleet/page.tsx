"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, fleetApi, type FleetBooking, type FleetDriver, type FleetVehicle, type User } from "@/lib/api";

type Tab = "vehicles" | "drivers" | "calendar";

export default function FleetListPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("vehicles");
  const [error, setError] = useState<string | null>(null);

  const vehiclesQuery = useQuery({
    queryKey: ["fleet", "vehicles"],
    queryFn: () => fleetApi.listVehicles().then((r) => r.data.data ?? []),
  });
  const driversQuery = useQuery({
    queryKey: ["fleet", "drivers"],
    queryFn: () => fleetApi.listDrivers().then((r) => r.data.data ?? []),
  });
  const bookingsQuery = useQuery({
    queryKey: ["fleet", "bookings"],
    queryFn: () => fleetApi.listBookings().then((r) => r.data.data ?? []),
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users", "fleet-drivers"],
    queryFn: () => adminApi.listUsers({ per_page: 100 }).then((r) => r.data.data ?? []),
    enabled: tab === "drivers",
  });

  const vehicles = (vehiclesQuery.data ?? []) as FleetVehicle[];
  const drivers = (driversQuery.data ?? []) as FleetDriver[];
  const bookings = (bookingsQuery.data ?? []) as FleetBooking[];

  const [driverUserId, setDriverUserId] = useState("");
  const [licence, setLicence] = useState("");
  const [bookingAssetId, setBookingAssetId] = useState("");
  const [bookingStart, setBookingStart] = useState("");
  const [bookingEnd, setBookingEnd] = useState("");
  const [bookingPurpose, setBookingPurpose] = useState("");

  const createDriver = useMutation({
    mutationFn: () =>
      fleetApi.createDriver({
        user_id: Number(driverUserId),
        licence_number: licence || null,
        status: "active",
      }),
    onSuccess: () => {
      setError(null);
      setDriverUserId("");
      setLicence("");
      qc.invalidateQueries({ queryKey: ["fleet", "drivers"] });
    },
    onError: () => setError("Could not add driver."),
  });

  const createBooking = useMutation({
    mutationFn: () =>
      fleetApi.createBooking({
        asset_id: Number(bookingAssetId),
        starts_at: bookingStart,
        ends_at: bookingEnd,
        purpose: bookingPurpose || null,
      }),
    onSuccess: () => {
      setError(null);
      setBookingPurpose("");
      qc.invalidateQueries({ queryKey: ["fleet", "bookings"] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.errors?.starts_at?.[0] ?? "Could not create booking (check conflicts).";
      setError(msg);
    },
  });

  const calendarRows = useMemo(
    () =>
      [...bookings].sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))),
    [bookings],
  );

  function onDriver(e: FormEvent) {
    e.preventDefault();
    createDriver.mutate();
  }

  function onBooking(e: FormEvent) {
    e.preventDefault();
    createBooking.mutate();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Fleet"
        subtitle="Ops layer on Fixed Assets with category fleet — vehicles, drivers roster, and booking calendar. GPS uses a pluggable telematics provider when configured, or a manual override otherwise."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Fleet" }]} />}
      />

      <div className="flex flex-wrap gap-2">
        {(["vehicles", "drivers", "calendar"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={tab === t ? "btn-primary" : "btn-secondary"}
          >
            {t === "vehicles" ? "Vehicles" : t === "drivers" ? "Drivers" : "Booking calendar"}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {tab === "vehicles" && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <table className="data-table">
            <thead className="bg-neutral-50 text-left text-neutral-600 dark:bg-neutral-950/60 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-t border-neutral-100 dark:border-neutral-800 dark:text-neutral-200">
                  <td className="px-3 py-3 font-medium">{v.asset_code}</td>
                  <td className="px-3 py-3">{v.name}</td>
                  <td className="px-3 py-3">{v.status}</td>
                  <td className="px-3 py-3 text-right">
                    <Link href={`/fleet/${v.id}`} className="text-blue-700 underline dark:text-blue-400">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-neutral-500 dark:text-neutral-400">
                    {vehiclesQuery.isLoading ? "Loading fleet vehicles…" : "No fleet vehicles found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "drivers" && (
        <div className="space-y-4">
          <form onSubmit={onDriver} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-sm font-medium">Staff member</span>
              <select
                className="input w-full"
                required
                value={driverUserId}
                onChange={(e) => setDriverUserId(e.target.value)}
              >
                <option value="">Select staff…</option>
                {((usersQuery.data ?? []) as User[]).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Licence #</span>
              <input className="input w-full" value={licence} onChange={(e) => setLicence(e.target.value)} />
            </label>
            <div className="flex items-end">
              <button type="submit" className="btn-primary" disabled={createDriver.isPending}>
                Add driver
              </button>
            </div>
          </form>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <table className="data-table">
              <thead className="bg-neutral-50 text-left text-neutral-600 dark:bg-neutral-950/60 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Driver</th>
                  <th className="px-3 py-2 font-medium">Licence</th>
                  <th className="px-3 py-2 font-medium">Expires</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id} className="border-t border-neutral-100 dark:border-neutral-800 dark:text-neutral-200">
                    <td className="px-3 py-3">{d.user?.name ?? `User #${d.user_id}`}</td>
                    <td className="px-3 py-3">{d.licence_number ?? "—"}</td>
                    <td className="px-3 py-3">{d.licence_expires_on ?? "—"}</td>
                    <td className="px-3 py-3">{d.status}</td>
                  </tr>
                ))}
                {drivers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-neutral-500 dark:text-neutral-400">No drivers on roster yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "calendar" && (
        <div className="space-y-4">
          <form onSubmit={onBooking} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">Vehicle</span>
              <select className="input w-full" required value={bookingAssetId} onChange={(e) => setBookingAssetId(e.target.value)}>
                <option value="">Select…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.asset_code} — {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Purpose</span>
              <input className="input w-full" value={bookingPurpose} onChange={(e) => setBookingPurpose(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Starts</span>
              <input className="input w-full" type="datetime-local" required value={bookingStart} onChange={(e) => setBookingStart(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Ends</span>
              <input className="input w-full" type="datetime-local" required value={bookingEnd} onChange={(e) => setBookingEnd(e.target.value)} />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary" disabled={createBooking.isPending}>
                Book vehicle
              </button>
            </div>
          </form>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <table className="data-table">
              <thead className="bg-neutral-50 text-left text-neutral-600 dark:bg-neutral-950/60 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Vehicle</th>
                  <th className="px-3 py-2 font-medium">Start</th>
                  <th className="px-3 py-2 font-medium">End</th>
                  <th className="px-3 py-2 font-medium">Purpose</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {calendarRows.map((b) => (
                  <tr key={b.id} className="border-t border-neutral-100 dark:border-neutral-800 dark:text-neutral-200">
                    <td className="px-3 py-3">{b.asset?.asset_code ?? b.asset_id}</td>
                    <td className="px-3 py-3">{new Date(b.starts_at).toLocaleString()}</td>
                    <td className="px-3 py-3">{new Date(b.ends_at).toLocaleString()}</td>
                    <td className="px-3 py-3">{b.purpose ?? "—"}</td>
                    <td className="px-3 py-3">{b.status}</td>
                  </tr>
                ))}
                {calendarRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-neutral-500 dark:text-neutral-400">No bookings yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
