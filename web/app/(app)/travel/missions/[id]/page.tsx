"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { travelApi, type TravelMission } from "@/lib/api";

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${ok ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
      <span className="material-symbols-outlined text-[13px]">{ok ? "check_circle" : "pending"}</span>
      {label}
    </span>
  );
}

export default function TravelMissionDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const [mission, setMission] = useState<TravelMission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setLoading(false);
      setError("Invalid mission ID.");
      return;
    }
    travelApi.getMission(id)
      .then((r) => setMission((r.data as any).data ?? r.data))
      .catch(() => setError("Failed to load mission readiness."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-neutral-400">Loading mission…</div>;
  if (error || !mission) {
    return (
    <div className="space-y-3">
        <p className="text-sm text-red-600">{error ?? "Not found"}</p>
        <Link href="/travel/missions" className="text-sm text-primary">Back to Missions</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5" data-testid="travel-mission-readiness">
      <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Link href="/travel/missions" className="hover:text-primary">Missions</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-700">{mission.title}</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{mission.title}</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {[mission.destination_city, mission.destination_country].filter(Boolean).join(", ") || "—"}
          {" · "}
          {(mission.start_date ?? "—").toString().slice(0, 10)} → {(mission.end_date ?? "—").toString().slice(0, 10)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400">Travellers</p>
          <p className="text-2xl font-semibold mt-1">{mission.summary?.travellers ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400">Ready</p>
          <p className="text-2xl font-semibold mt-1 text-green-700">{mission.summary?.ready ?? 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400">Pending</p>
          <p className="text-2xl font-semibold mt-1 text-amber-700">{mission.summary?.pending ?? 0}</p>
        </div>
      </div>

      <table className="data-table w-full">
        <thead>
          <tr>
            <th>Traveller</th>
            <th>Reference</th>
            <th>Status</th>
            <th>Readiness</th>
          </tr>
        </thead>
        <tbody>
          {(mission.travellers ?? []).length === 0 ? (
            <tr><td colSpan={4} className="py-8 text-center text-neutral-400">No travellers linked.</td></tr>
          ) : (mission.travellers ?? []).map((t) => (
            <tr key={t.travel_request_id}>
              <td>{t.traveller ?? "—"}</td>
              <td>
                <Link className="text-primary font-mono text-sm" href={`/travel/${t.travel_request_id}`}>
                  {t.reference_number}
                </Link>
              </td>
              <td className="capitalize text-sm">{t.status.replace(/_/g, " ")}</td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  <Flag ok={t.ticket} label="Ticket" />
                  <Flag ok={t.visa} label="Visa" />
                  <Flag ok={t.hotel} label="Hotel" />
                  <Flag ok={t.dsa} label="DSA" />
                  <Flag ok={t.ready} label={t.ready ? "Ready" : "Not ready"} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
