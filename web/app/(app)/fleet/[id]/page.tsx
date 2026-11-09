"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fleetApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function FleetVehicleDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [gpsToast, setGpsToast] = useState<string | null>(null);
  const [gps, setGps] = useState({ lat: "", lng: "" });
  const [deviceId, setDeviceId] = useState("");
  const [trip, setTrip] = useState({
    started_at: "",
    ended_at: "",
    start_odometer_km: "",
    end_odometer_km: "",
    purpose: "",
    origin: "",
    destination: "",
  });
  const [fuel, setFuel] = useState({
    logged_at: "",
    litres: "",
    cost_amount: "",
    odometer_km: "",
    station: "",
  });
  const [service, setService] = useState({
    service_type: "service",
    interval_km: "10000",
    interval_days: "180",
    last_service_at: "",
    last_service_odometer_km: "",
    notes: "",
  });

  const detailQuery = useQuery({
    queryKey: ["fleet", "vehicles", id],
    enabled: Number.isFinite(id) && id > 0,
    queryFn: () => fleetApi.getVehicle(id).then((r) => r.data.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["fleet", "vehicles", id] });

  const data = detailQuery.data;
  const vehicle = data?.vehicle;
  const telematics = data?.telematics;

  useEffect(() => {
    if (!vehicle) return;
    setGps({
      lat: vehicle.gps_lat != null ? String(vehicle.gps_lat) : "",
      lng: vehicle.gps_lng != null ? String(vehicle.gps_lng) : "",
    });
    setDeviceId(vehicle.telematics_device_id != null ? String(vehicle.telematics_device_id) : "");
  }, [vehicle?.id, vehicle?.gps_lat, vehicle?.gps_lng, vehicle?.telematics_device_id]);

  const createTrip = useMutation({
    mutationFn: () =>
      fleetApi.createTrip(id, {
        started_at: trip.started_at,
        ended_at: trip.ended_at || null,
        start_odometer_km: trip.start_odometer_km ? Number(trip.start_odometer_km) : null,
        end_odometer_km: trip.end_odometer_km ? Number(trip.end_odometer_km) : null,
        purpose: trip.purpose || null,
        origin: trip.origin || null,
        destination: trip.destination || null,
      }),
    onSuccess: () => {
      setError(null);
      setTrip({ started_at: "", ended_at: "", start_odometer_km: "", end_odometer_km: "", purpose: "", origin: "", destination: "" });
      invalidate();
      toast.success(t("fleet.detail.tripLogged"));
    },
    onError: (err: unknown) => {
      setError(t("fleet.detail.tripFailed"));
      toast.error(t("fleet.detail.tripNotLogged"), apiErrorMessage(err, t("fleet.detail.tripFailed")));
    },
  });

  const createFuel = useMutation({
    mutationFn: () =>
      fleetApi.createFuelLog(id, {
        logged_at: fuel.logged_at,
        litres: Number(fuel.litres),
        cost_amount: fuel.cost_amount ? Number(fuel.cost_amount) : null,
        odometer_km: fuel.odometer_km ? Number(fuel.odometer_km) : null,
        station: fuel.station || null,
      }),
    onSuccess: () => {
      setError(null);
      setFuel({ logged_at: "", litres: "", cost_amount: "", odometer_km: "", station: "" });
      invalidate();
      toast.success(t("fleet.detail.fuelAdded"));
    },
    onError: (err: unknown) => {
      setError(t("fleet.detail.fuelFailed"));
      toast.error(t("fleet.detail.fuelNotAdded"), apiErrorMessage(err, t("fleet.detail.fuelFailed")));
    },
  });

  const createService = useMutation({
    mutationFn: () =>
      fleetApi.createServiceSchedule(id, {
        service_type: service.service_type,
        interval_km: service.interval_km ? Number(service.interval_km) : null,
        interval_days: service.interval_days ? Number(service.interval_days) : null,
        last_service_at: service.last_service_at || null,
        last_service_odometer_km: service.last_service_odometer_km
          ? Number(service.last_service_odometer_km)
          : null,
        notes: service.notes || null,
      }),
    onSuccess: () => {
      setError(null);
      invalidate();
      toast.success(t("fleet.detail.serviceAdded"));
    },
    onError: (err: unknown) => {
      setError(t("fleet.detail.serviceFailed"));
      toast.error(t("fleet.detail.serviceNotAdded"), apiErrorMessage(err, t("fleet.detail.serviceFailed")));
    },
  });

  const updateGps = useMutation({
    mutationFn: () =>
      fleetApi.updateGps(id, {
        gps_lat: Number(gps.lat),
        gps_lng: Number(gps.lng),
      }),
    onSuccess: () => {
      setError(null);
      setGpsToast(t("fleet.detail.gpsSavedManual"));
      invalidate();
      toast.success(t("fleet.detail.gpsSaved"));
    },
    onError: (err: unknown) => {
      setError(t("fleet.detail.gpsFailed"));
      toast.error(t("fleet.detail.gpsNotSaved"), apiErrorMessage(err, t("fleet.detail.gpsFailed")));
    },
  });

  const updateTelematics = useMutation({
    mutationFn: () =>
      fleetApi.updateTelematics(id, {
        telematics_device_id: deviceId.trim() || null,
      }),
    onSuccess: () => {
      setError(null);
      setGpsToast(t("fleet.detail.telematicsMapped"));
      invalidate();
      toast.success(t("fleet.detail.telematicsSaved"));
    },
    onError: (err: unknown) => {
      setError(t("fleet.detail.telematicsFailed"));
      toast.error(t("fleet.detail.telematicsNotSaved"), apiErrorMessage(err, t("fleet.detail.telematicsFailed")));
    },
  });

  const mapsHref =
    vehicle?.gps_lat != null && vehicle?.gps_lng != null
      ? `https://www.openstreetmap.org/?mlat=${vehicle.gps_lat}&mlon=${vehicle.gps_lng}#map=15/${vehicle.gps_lat}/${vehicle.gps_lng}`
      : null;

  const providerLabel = telematics?.enabled
    ? t("fleet.detail.provider", { driver: telematics.driver })
    : t("fleet.detail.providerDisabled");

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={vehicle ? `${vehicle.asset_code} — ${vehicle.name}` : t("fleet.detail.title")}
        subtitle={t("fleet.detail.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("fleet.title"), href: "/fleet" },
              { label: vehicle?.asset_code ?? t("fleet.col.vehicle") },
            ]}
          />
        }
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {gpsToast && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{gpsToast}</div>
      )}
      {detailQuery.isLoading && <p className="text-sm text-neutral-500">{t("common.loading")}</p>}

      {data && (
        <>
          <section className="card space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{t("fleet.detail.gpsTelematics")}</h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {providerLabel}
                  {telematics?.webhook_configured ? ` · ${t("fleet.detail.webhookConfigured")}` : ""}
                  {telematics?.schedule_enabled ? ` · ${t("fleet.detail.scheduledSync")}` : ""}
                </p>
              </div>
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                {telematics?.enabled ? telematics.driver : t("fleet.detail.stubManual")}
              </span>
            </div>
            {vehicle?.gps_lat != null && vehicle?.gps_lng != null ? (
              <p className="text-sm text-neutral-700">
                {t("fleet.detail.current")}{" "}
                <span className="font-mono">
                  {Number(vehicle.gps_lat).toFixed(5)}, {Number(vehicle.gps_lng).toFixed(5)}
                </span>
                {vehicle.gps_recorded_at ? (
                  <span className="text-neutral-500"> · {t("fleet.detail.recorded", { time: String(vehicle.gps_recorded_at).slice(0, 19).replace("T", " ") })}</span>
                ) : null}
                {vehicle.telematics_synced_at ? (
                  <span className="text-neutral-500">
                    {" "}
                    · {t("fleet.detail.lastSync", { time: String(vehicle.telematics_synced_at).slice(0, 19).replace("T", " ") })}
                    {vehicle.telematics_sync_status ? ` (${vehicle.telematics_sync_status})` : ""}
                  </span>
                ) : null}
                {mapsHref ? (
                  <>
                    {" "}
                    ·{" "}
                    <a href={mapsHref} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
                      {t("fleet.detail.openMap")}
                    </a>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="text-sm text-neutral-500">{t("fleet.detail.noLocation")}</p>
            )}
            {vehicle?.telematics_sync_error ? (
              <p className="text-xs text-red-700">{t("fleet.detail.syncError", { error: String(vehicle.telematics_sync_error) })}</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className="input sm:col-span-1"
                placeholder={t("fleet.detail.deviceId")}
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                disabled={updateTelematics.isPending}
                onClick={() => updateTelematics.mutate()}
              >
                {updateTelematics.isPending ? t("correspondence.saving") : t("fleet.detail.saveDeviceId")}
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              {t("fleet.detail.manualHint")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="input"
                placeholder={t("fleet.detail.latitude")}
                value={gps.lat}
                onChange={(e) => setGps({ ...gps, lat: e.target.value })}
                inputMode="decimal"
              />
              <input
                className="input"
                placeholder={t("fleet.detail.longitude")}
                value={gps.lng}
                onChange={(e) => setGps({ ...gps, lng: e.target.value })}
                inputMode="decimal"
              />
            </div>
            <button
              type="button"
              className="btn-secondary"
              disabled={updateGps.isPending || !gps.lat.trim() || !gps.lng.trim()}
              onClick={() => updateGps.mutate()}
            >
              {updateGps.isPending ? t("correspondence.saving") : t("fleet.detail.saveGps")}
            </button>
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <section className="card space-y-2 p-4">
              <h2 className="font-semibold">{t("fleet.detail.logTrip")}</h2>
              <label htmlFor="trip-started-at" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.startedAt")}</span>
                <input id="trip-started-at" className="input w-full" type="datetime-local" value={trip.started_at} onChange={(e) => setTrip({ ...trip, started_at: e.target.value })} />
              </label>
              <label htmlFor="trip-ended-at" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.endedAt")}</span>
                <input id="trip-ended-at" className="input w-full" type="datetime-local" value={trip.ended_at} onChange={(e) => setTrip({ ...trip, ended_at: e.target.value })} />
              </label>
              <label htmlFor="trip-start-odometer" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.startOdometer")}</span>
                <input id="trip-start-odometer" className="input w-full" type="number" min="0" placeholder={t("fleet.detail.startOdometer")} value={trip.start_odometer_km} onChange={(e) => setTrip({ ...trip, start_odometer_km: e.target.value })} />
              </label>
              <label htmlFor="trip-end-odometer" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.endOdometer")}</span>
                <input id="trip-end-odometer" className="input w-full" type="number" min="0" placeholder={t("fleet.detail.endOdometer")} value={trip.end_odometer_km} onChange={(e) => setTrip({ ...trip, end_odometer_km: e.target.value })} />
              </label>
              <label htmlFor="trip-purpose" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.col.purpose")}</span>
                <input id="trip-purpose" className="input w-full" placeholder={t("fleet.col.purpose")} value={trip.purpose} onChange={(e) => setTrip({ ...trip, purpose: e.target.value })} />
              </label>
              <button type="button" className="btn-primary" disabled={createTrip.isPending || !trip.started_at} onClick={() => createTrip.mutate()}>
                {t("fleet.detail.saveTrip")}
              </button>
            </section>

            <section className="card space-y-2 p-4">
              <h2 className="font-semibold">{t("fleet.detail.logFuel")}</h2>
              <label htmlFor="fuel-logged-at" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.loggedAt")}</span>
                <input id="fuel-logged-at" className="input w-full" type="datetime-local" value={fuel.logged_at} onChange={(e) => setFuel({ ...fuel, logged_at: e.target.value })} />
              </label>
              <label htmlFor="fuel-litres" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.litres")}</span>
                <input id="fuel-litres" className="input w-full" type="number" min="0" placeholder={t("fleet.detail.litres")} value={fuel.litres} onChange={(e) => setFuel({ ...fuel, litres: e.target.value })} />
              </label>
              <label htmlFor="fuel-cost" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.cost")}</span>
                <input id="fuel-cost" className="input w-full" type="number" min="0" placeholder={t("fleet.detail.cost")} value={fuel.cost_amount} onChange={(e) => setFuel({ ...fuel, cost_amount: e.target.value })} />
              </label>
              <label htmlFor="fuel-odometer" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.odometer")}</span>
                <input id="fuel-odometer" className="input w-full" type="number" min="0" placeholder={t("fleet.detail.odometer")} value={fuel.odometer_km} onChange={(e) => setFuel({ ...fuel, odometer_km: e.target.value })} />
              </label>
              <label htmlFor="fuel-station" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.station")}</span>
                <input id="fuel-station" className="input w-full" placeholder={t("fleet.detail.station")} value={fuel.station} onChange={(e) => setFuel({ ...fuel, station: e.target.value })} />
              </label>
              <button type="button" className="btn-primary" disabled={createFuel.isPending || !fuel.logged_at || !fuel.litres} onClick={() => createFuel.mutate()}>
                {t("fleet.detail.saveFuel")}
              </button>
            </section>

            <section className="card space-y-2 p-4">
              <h2 className="font-semibold">{t("fleet.detail.serviceSchedule")}</h2>
              <label htmlFor="service-type" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.serviceType")}</span>
                <input id="service-type" className="input w-full" placeholder={t("fleet.detail.serviceType")} value={service.service_type} onChange={(e) => setService({ ...service, service_type: e.target.value })} />
              </label>
              <label htmlFor="service-interval-km" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.intervalKm")}</span>
                <input id="service-interval-km" className="input w-full" type="number" min="0" placeholder={t("fleet.detail.intervalKm")} value={service.interval_km} onChange={(e) => setService({ ...service, interval_km: e.target.value })} />
              </label>
              <label htmlFor="service-interval-days" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.intervalDays")}</span>
                <input id="service-interval-days" className="input w-full" type="number" min="0" placeholder={t("fleet.detail.intervalDays")} value={service.interval_days} onChange={(e) => setService({ ...service, interval_days: e.target.value })} />
              </label>
              <label htmlFor="service-last-service-at" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.lastServiceDate")}</span>
                <input id="service-last-service-at" className="input w-full" type="date" value={service.last_service_at} onChange={(e) => setService({ ...service, last_service_at: e.target.value })} />
              </label>
              <label htmlFor="service-last-odometer" className="block space-y-1">
                <span className="text-sm font-medium">{t("fleet.detail.lastServiceOdometer")}</span>
                <input id="service-last-odometer" className="input w-full" type="number" min="0" placeholder={t("fleet.detail.lastServiceOdometer")} value={service.last_service_odometer_km} onChange={(e) => setService({ ...service, last_service_odometer_km: e.target.value })} />
              </label>
              <button type="button" className="btn-primary" disabled={createService.isPending} onClick={() => createService.mutate()}>
                {t("fleet.detail.saveSchedule")}
              </button>
            </section>
          </div>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">{t("fleet.detail.recentTrips")}</h2>
            <ul className="space-y-1 text-sm">
              {data.trips.map((tr) => (
                <li key={tr.id}>
                  {t("fleet.detail.tripRow", { start: String(tr.started_at), purpose: tr.purpose || t("fleet.detail.trip"), km: String(tr.distance_km ?? "?") })}
                </li>
              ))}
              {data.trips.length === 0 && <li className="text-neutral-500">{t("fleet.detail.noTrips")}</li>}
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">{t("fleet.detail.fuelLogs")}</h2>
            <ul className="space-y-1 text-sm">
              {data.fuel_logs.map((f) => (
                <li key={f.id}>
                  {f.logged_at} — {f.litres} L {f.station ? `@ ${f.station}` : ""}
                </li>
              ))}
              {data.fuel_logs.length === 0 && <li className="text-neutral-500">{t("fleet.detail.noFuel")}</li>}
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">{t("fleet.detail.serviceDue")}</h2>
            <ul className="space-y-1 text-sm">
              {data.service_schedules.map((s) => (
                <li key={s.id}>
                  {t("fleet.detail.serviceRow", { type: s.service_type, date: s.next_due_at || "—", km: String(s.next_due_odometer_km ?? "—") })}
                </li>
              ))}
              {data.service_schedules.length === 0 && <li className="text-neutral-500">{t("fleet.detail.noService")}</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
