"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fleetApi } from "@/lib/api";

export default function FleetVehicleDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
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
    },
    onError: () => setError("Could not create trip log."),
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
    },
    onError: () => setError("Could not create fuel log."),
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
    },
    onError: () => setError("Could not create service schedule."),
  });

  const updateGps = useMutation({
    mutationFn: () =>
      fleetApi.updateGps(id, {
        gps_lat: Number(gps.lat),
        gps_lng: Number(gps.lng),
      }),
    onSuccess: () => {
      setError(null);
      setGpsToast("Last-known GPS saved (manual override).");
      invalidate();
    },
    onError: () => setError("Could not save GPS location."),
  });

  const updateTelematics = useMutation({
    mutationFn: () =>
      fleetApi.updateTelematics(id, {
        telematics_device_id: deviceId.trim() || null,
      }),
    onSuccess: () => {
      setError(null);
      setGpsToast("Telematics device mapping saved.");
      invalidate();
    },
    onError: () => setError("Could not save telematics device id."),
  });

  const mapsHref =
    vehicle?.gps_lat != null && vehicle?.gps_lng != null
      ? `https://www.openstreetmap.org/?mlat=${vehicle.gps_lat}&mlon=${vehicle.gps_lng}#map=15/${vehicle.gps_lat}/${vehicle.gps_lng}`
      : null;

  const providerLabel = telematics?.enabled
    ? `Provider: ${telematics.driver}`
    : "Provider: disabled (manual stub)";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/fleet" className="text-sm text-blue-700 underline">
          ← Fleet
        </Link>
        <h1 className="page-title mt-2">{vehicle ? `${vehicle.asset_code} — ${vehicle.name}` : "Fleet vehicle"}</h1>
        <p className="page-subtitle">Trip / mileage, fuel, service due, GPS, and telematics mapping for this Fixed Asset vehicle.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {gpsToast && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{gpsToast}</div>
      )}
      {detailQuery.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}

      {data && (
        <>
          <section className="card space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">GPS & telematics</h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {providerLabel}
                  {telematics?.webhook_configured ? " · webhook configured" : ""}
                  {telematics?.schedule_enabled ? " · scheduled sync on" : ""}
                </p>
              </div>
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                {telematics?.enabled ? telematics.driver : "Stub / manual"}
              </span>
            </div>
            {vehicle?.gps_lat != null && vehicle?.gps_lng != null ? (
              <p className="text-sm text-neutral-700">
                Current:{" "}
                <span className="font-mono">
                  {Number(vehicle.gps_lat).toFixed(5)}, {Number(vehicle.gps_lng).toFixed(5)}
                </span>
                {vehicle.gps_recorded_at ? (
                  <span className="text-neutral-500"> · recorded {String(vehicle.gps_recorded_at).slice(0, 19).replace("T", " ")}</span>
                ) : null}
                {vehicle.telematics_synced_at ? (
                  <span className="text-neutral-500">
                    {" "}
                    · last sync {String(vehicle.telematics_synced_at).slice(0, 19).replace("T", " ")}
                    {vehicle.telematics_sync_status ? ` (${vehicle.telematics_sync_status})` : ""}
                  </span>
                ) : null}
                {mapsHref ? (
                  <>
                    {" "}
                    ·{" "}
                    <a href={mapsHref} target="_blank" rel="noreferrer" className="text-primary underline">
                      Open map
                    </a>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="text-sm text-neutral-500">No last-known location recorded yet.</p>
            )}
            {vehicle?.telematics_sync_error ? (
              <p className="text-xs text-red-700">Last sync error: {vehicle.telematics_sync_error}</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className="input sm:col-span-1"
                placeholder="Telematics device id"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary"
                disabled={updateTelematics.isPending}
                onClick={() => updateTelematics.mutate()}
              >
                {updateTelematics.isPending ? "Saving…" : "Save device id"}
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              Manual coordinates remain editable when the provider is disabled, or as an override.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="input"
                placeholder="Latitude (e.g. -22.5609)"
                value={gps.lat}
                onChange={(e) => setGps({ ...gps, lat: e.target.value })}
                inputMode="decimal"
              />
              <input
                className="input"
                placeholder="Longitude (e.g. 17.0658)"
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
              {updateGps.isPending ? "Saving…" : "Save last-known GPS"}
            </button>
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <section className="card space-y-2 p-4">
              <h2 className="font-semibold">Log trip</h2>
              <input className="input" type="datetime-local" value={trip.started_at} onChange={(e) => setTrip({ ...trip, started_at: e.target.value })} />
              <input className="input" type="datetime-local" value={trip.ended_at} onChange={(e) => setTrip({ ...trip, ended_at: e.target.value })} />
              <input className="input" placeholder="Start odometer km" value={trip.start_odometer_km} onChange={(e) => setTrip({ ...trip, start_odometer_km: e.target.value })} />
              <input className="input" placeholder="End odometer km" value={trip.end_odometer_km} onChange={(e) => setTrip({ ...trip, end_odometer_km: e.target.value })} />
              <input className="input" placeholder="Purpose" value={trip.purpose} onChange={(e) => setTrip({ ...trip, purpose: e.target.value })} />
              <button type="button" className="btn-primary" disabled={createTrip.isPending || !trip.started_at} onClick={() => createTrip.mutate()}>
                Save trip
              </button>
            </section>

            <section className="card space-y-2 p-4">
              <h2 className="font-semibold">Log fuel</h2>
              <input className="input" type="datetime-local" value={fuel.logged_at} onChange={(e) => setFuel({ ...fuel, logged_at: e.target.value })} />
              <input className="input" placeholder="Litres" value={fuel.litres} onChange={(e) => setFuel({ ...fuel, litres: e.target.value })} />
              <input className="input" placeholder="Cost (NAD)" value={fuel.cost_amount} onChange={(e) => setFuel({ ...fuel, cost_amount: e.target.value })} />
              <input className="input" placeholder="Odometer km" value={fuel.odometer_km} onChange={(e) => setFuel({ ...fuel, odometer_km: e.target.value })} />
              <input className="input" placeholder="Station" value={fuel.station} onChange={(e) => setFuel({ ...fuel, station: e.target.value })} />
              <button type="button" className="btn-primary" disabled={createFuel.isPending || !fuel.logged_at || !fuel.litres} onClick={() => createFuel.mutate()}>
                Save fuel
              </button>
            </section>

            <section className="card space-y-2 p-4">
              <h2 className="font-semibold">Service schedule</h2>
              <input className="input" placeholder="Service type" value={service.service_type} onChange={(e) => setService({ ...service, service_type: e.target.value })} />
              <input className="input" placeholder="Interval km" value={service.interval_km} onChange={(e) => setService({ ...service, interval_km: e.target.value })} />
              <input className="input" placeholder="Interval days" value={service.interval_days} onChange={(e) => setService({ ...service, interval_days: e.target.value })} />
              <input className="input" type="date" value={service.last_service_at} onChange={(e) => setService({ ...service, last_service_at: e.target.value })} />
              <input className="input" placeholder="Last service odometer" value={service.last_service_odometer_km} onChange={(e) => setService({ ...service, last_service_odometer_km: e.target.value })} />
              <button type="button" className="btn-primary" disabled={createService.isPending} onClick={() => createService.mutate()}>
                Save schedule
              </button>
            </section>
          </div>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Recent trips</h2>
            <ul className="space-y-1 text-sm">
              {data.trips.map((t) => (
                <li key={t.id}>
                  {t.started_at} — {t.purpose || "Trip"} ({t.distance_km ?? "?"} km)
                </li>
              ))}
              {data.trips.length === 0 && <li className="text-neutral-500">No trips yet.</li>}
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Fuel logs</h2>
            <ul className="space-y-1 text-sm">
              {data.fuel_logs.map((f) => (
                <li key={f.id}>
                  {f.logged_at} — {f.litres} L {f.station ? `@ ${f.station}` : ""}
                </li>
              ))}
              {data.fuel_logs.length === 0 && <li className="text-neutral-500">No fuel logs yet.</li>}
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Service due</h2>
            <ul className="space-y-1 text-sm">
              {data.service_schedules.map((s) => (
                <li key={s.id}>
                  {s.service_type}: next {s.next_due_at || "—"} / {s.next_due_odometer_km ?? "—"} km
                </li>
              ))}
              {data.service_schedules.length === 0 && <li className="text-neutral-500">No service schedules yet.</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
