"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, fleetApi, type FleetBooking, type FleetDriver, type FleetVehicle, type User } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Tab = "vehicles" | "drivers" | "calendar";

export default function FleetListPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
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
      toast.success(t("fleet.driverAdded"));
    },
    onError: (err: unknown) => {
      setError(t("fleet.addDriverFailed"));
      toast.error(t("fleet.driverNotAdded"), apiErrorMessage(err, t("fleet.addDriverFailed")));
    },
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
      toast.success(t("fleet.bookingCreated"));
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.errors?.starts_at?.[0] ?? t("fleet.bookingFailed");
      setError(msg);
      toast.error(t("fleet.bookingNotCreated"), msg);
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
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("fleet.title")}
        subtitle={t("fleet.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("fleet.title") }]} />}
      />

      <div className="flex flex-wrap gap-2">
        {(["vehicles", "drivers", "calendar"] as Tab[]).map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => setTab(tb)}
            className={tab === tb ? "btn-primary" : "btn-secondary"}
          >
            {tb === "vehicles" ? t("fleet.tab.vehicles") : tb === "drivers" ? t("fleet.tab.drivers") : t("fleet.tab.calendar")}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {tab === "vehicles" && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
          <table className="data-table">
            <thead className="bg-neutral-50 text-left text-neutral-600 dark:bg-neutral-950/60 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2 font-medium">{t("fleet.col.code")}</th>
                <th className="px-3 py-2 font-medium">{t("fleet.col.name")}</th>
                <th className="px-3 py-2 font-medium">{t("fleet.col.status")}</th>
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
                    <Link href={`/fleet/${v.id}`} className="btn-secondary text-xs">
                      {t("common.open")}
                    </Link>
                  </td>
                </tr>
              ))}
              {vehicles.length === 0 && (
                vehiclesQuery.isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-neutral-500 dark:text-neutral-400">
                      {t("fleet.loadingVehicles")}
                    </td>
                  </tr>
                ) : (
                  <TableEmpty colSpan={4} title={t("fleet.noVehicles")} />
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "drivers" && (
        <div className="space-y-4">
          <form onSubmit={onDriver} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 md:grid-cols-3">
            <label htmlFor="fleet-staff-member-setdriveruserid-e-target-value-sele" className="space-y-1">
              <span className="text-sm font-medium">{t("fleet.staffMember")}</span>
              <select id="fleet-staff-member-setdriveruserid-e-target-value-sele"
                className="input w-full"
                required
                value={driverUserId}
                onChange={(e) => setDriverUserId(e.target.value)}
              >
                <option value="">{t("fleet.selectStaff")}</option>
                {((usersQuery.data ?? []) as User[]).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="fleet-licence-setlicence-e-target-value" className="space-y-1">
              <span className="text-sm font-medium">{t("fleet.licenceNumber")}</span>
              <input id="fleet-licence-setlicence-e-target-value" className="input w-full" value={licence} onChange={(e) => setLicence(e.target.value)} />
            </label>
            <div className="flex items-end">
              <button type="submit" className="btn-primary" disabled={createDriver.isPending}>
                {t("fleet.addDriver")}
              </button>
            </div>
          </form>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <table className="data-table">
              <thead className="bg-neutral-50 text-left text-neutral-600 dark:bg-neutral-950/60 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("fleet.col.driver")}</th>
                  <th className="px-3 py-2 font-medium">{t("fleet.col.licence")}</th>
                  <th className="px-3 py-2 font-medium">{t("fleet.col.expires")}</th>
                  <th className="px-3 py-2 font-medium">{t("fleet.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d) => (
                  <tr key={d.id} className="border-t border-neutral-100 dark:border-neutral-800 dark:text-neutral-200">
                    <td className="px-3 py-3">{d.user?.name ?? t("fleet.userNumber", { id: d.user_id })}</td>
                    <td className="px-3 py-3">{d.licence_number ?? "—"}</td>
                    <td className="px-3 py-3">{d.licence_expires_on ?? "—"}</td>
                    <td className="px-3 py-3">{d.status}</td>
                  </tr>
                ))}
                {drivers.length === 0 && (
                  <TableEmpty colSpan={4} title={t("fleet.noDrivers")} />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "calendar" && (
        <div className="space-y-4">
          <form onSubmit={onBooking} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900 md:grid-cols-2">
            <label htmlFor="fleet-vehicle-setbookingassetid-e-target-value-select" className="space-y-1">
              <span className="text-sm font-medium">{t("fleet.col.vehicle")}</span>
              <select id="fleet-vehicle-setbookingassetid-e-target-value-select" className="input w-full" required value={bookingAssetId} onChange={(e) => setBookingAssetId(e.target.value)}>
                <option value="">{t("correspondence.mailMerge.select")}</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.asset_code} — {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="fleet-purpose-setbookingpurpose-e-target-value" className="space-y-1">
              <span className="text-sm font-medium">{t("fleet.col.purpose")}</span>
              <input id="fleet-purpose-setbookingpurpose-e-target-value" className="input w-full" value={bookingPurpose} onChange={(e) => setBookingPurpose(e.target.value)} />
            </label>
            <label htmlFor="fleet-starts-setbookingstart-e-target-value" className="space-y-1">
              <span className="text-sm font-medium">{t("fleet.starts")}</span>
              <input id="fleet-starts-setbookingstart-e-target-value" className="input w-full" type="datetime-local" required value={bookingStart} onChange={(e) => setBookingStart(e.target.value)} />
            </label>
            <label htmlFor="fleet-ends-setbookingend-e-target-value" className="space-y-1">
              <span className="text-sm font-medium">{t("fleet.ends")}</span>
              <input id="fleet-ends-setbookingend-e-target-value" className="input w-full" type="datetime-local" required value={bookingEnd} onChange={(e) => setBookingEnd(e.target.value)} />
            </label>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary" disabled={createBooking.isPending}>
                {t("fleet.bookVehicle")}
              </button>
            </div>
          </form>
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <table className="data-table">
              <thead className="bg-neutral-50 text-left text-neutral-600 dark:bg-neutral-950/60 dark:text-neutral-400">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("fleet.col.vehicle")}</th>
                  <th className="px-3 py-2 font-medium">{t("fleet.col.start")}</th>
                  <th className="px-3 py-2 font-medium">{t("fleet.col.end")}</th>
                  <th className="px-3 py-2 font-medium">{t("fleet.col.purpose")}</th>
                  <th className="px-3 py-2 font-medium">{t("fleet.col.status")}</th>
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
                  <TableEmpty colSpan={5} title={t("fleet.noBookings")} />
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
