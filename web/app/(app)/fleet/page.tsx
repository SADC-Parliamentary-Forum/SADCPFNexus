"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fleetApi, type FleetVehicle } from "@/lib/api";

export default function FleetListPage() {
  const query = useQuery({
    queryKey: ["fleet", "vehicles"],
    queryFn: () => fleetApi.listVehicles().then((r) => r.data.data ?? []),
  });

  const vehicles = (query.data ?? []) as FleetVehicle[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Fleet</h1>
        <p className="page-subtitle">
          Ops layer on Fixed Assets with category <code>fleet</code> (or <code>vehicles</code>). Trips, fuel, and service due —
          not a full ERP fleet system.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={v.id} className="border-t border-neutral-100">
                <td className="px-3 py-3 font-medium">{v.asset_code}</td>
                <td className="px-3 py-3">{v.name}</td>
                <td className="px-3 py-3">{v.status}</td>
                <td className="px-3 py-3 text-right">
                  <Link href={`/fleet/${v.id}`} className="text-blue-700 underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-neutral-500">
                  {query.isLoading
                    ? "Loading fleet vehicles…"
                    : "No fleet vehicles found. Register assets with category code fleet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
