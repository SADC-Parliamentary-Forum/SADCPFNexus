"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fleetApi } from "@/lib/api";

export default function FleetVehicleDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
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

  const data = detailQuery.data;
  const vehicle = data?.vehicle;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/fleet" className="text-sm text-blue-700 underline">
          ← Fleet
        </Link>
        <h1 className="page-title mt-2">{vehicle ? `${vehicle.asset_code} — ${vehicle.name}` : "Fleet vehicle"}</h1>
        <p className="page-subtitle">Trip / mileage, fuel, and service due for this Fixed Asset vehicle.</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {detailQuery.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}

      {data && (
        <>
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
