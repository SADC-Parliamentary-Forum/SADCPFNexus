"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { travelApi, type TravelMission } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { getListData } from "@/lib/listPagination";

export default function TravelMissionsPage() {
  const [rows, setRows] = useState<TravelMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await travelApi.listMissions({ per_page: 100 });
      setRows(getListData<TravelMission>(res.data));
    } catch {
      setError("Failed to load missions.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((m) => {
      const hay = [m.title, m.destination_city, m.destination_country]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const stats = useMemo(() => {
    const travellers = rows.reduce((n, m) => n + (m.requests_count ?? m.summary?.travellers ?? 0), 0);
    const ready = rows.reduce((n, m) => n + (m.summary?.ready ?? 0), 0);
    const pending = rows.reduce((n, m) => n + (m.summary?.pending ?? 0), 0);
    return { missions: rows.length, travellers, ready, pending };
  }, [rows]);

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `travel-missions-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((m) => ({
        title: m.title,
        destination: [m.destination_city, m.destination_country].filter(Boolean).join(", "),
        start_date: m.start_date ?? "",
        end_date: m.end_date ?? "",
        travellers: m.requests_count ?? m.summary?.travellers ?? 0,
        ready: m.summary?.ready ?? "",
        pending: m.summary?.pending ?? "",
      })),
      [
        { key: "title", header: "Mission" },
        { key: "destination", header: "Destination" },
        { key: "start_date", header: "Start" },
        { key: "end_date", header: "End" },
        { key: "travellers", header: "Travellers" },
        { key: "ready", header: "Ready" },
        { key: "pending", header: "Pending" },
      ],
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Link href="/travel" className="transition-colors hover:text-neutral-700">
              Travel
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">Missions</span>
          </div>
          <h1 className="page-title">Travel Mission Readiness</h1>
          <p className="page-subtitle">
            Group readiness for travellers, tickets, visa, hotel, and Finance DSA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <Link href="/pif" className="btn-secondary text-sm">
            Browse PIF
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">{error}</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Missions", value: stats.missions, icon: "groups", color: "text-primary", bg: "bg-primary/10" },
            { label: "Travellers", value: stats.travellers, icon: "person", color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Ready", value: stats.ready, icon: "check_circle", color: "text-green-600", bg: "bg-green-50" },
            { label: "Pending", value: stats.pending, icon: "pending", color: "text-neutral-600", bg: "bg-neutral-100" },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-500">{s.label}</p>
                  <p className="mt-0.5 text-lg font-bold text-neutral-900">{s.value}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg}`}>
                  <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-4">
        <div className="relative max-w-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[20px]">
            search
          </span>
          <input
            type="search"
            className="form-input pl-10"
            placeholder="Search missions or destinations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden" data-testid="travel-missions-table">
        {loading ? (
          <div className="space-y-3 p-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <span className="material-symbols-outlined mb-2 block text-[40px] text-neutral-300">flight</span>
            <p className="text-sm font-semibold text-neutral-600">
              {rows.length === 0 ? "No missions yet" : "No matches for your search"}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {rows.length === 0
                ? "Create via PIF send-to-travel, or wait for grouped travel packages."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Destination</th>
                  <th>Dates</th>
                  <th>Travellers</th>
                  <th>Readiness</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const travellers = m.requests_count ?? m.summary?.travellers ?? 0;
                  const ready = m.summary?.ready;
                  const pending = m.summary?.pending;
                  return (
                    <tr key={m.id}>
                      <td className="font-medium text-neutral-900">{m.title}</td>
                      <td className="text-sm text-neutral-600">
                        {[m.destination_city, m.destination_country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="whitespace-nowrap text-sm text-neutral-600">
                        {m.start_date ? formatDateShort(String(m.start_date).slice(0, 10)) : "—"}
                        {" → "}
                        {m.end_date ? formatDateShort(String(m.end_date).slice(0, 10)) : "—"}
                      </td>
                      <td>{travellers}</td>
                      <td className="text-xs text-neutral-600">
                        {ready != null || pending != null ? (
                          <span>
                            <span className="badge badge-success text-xs mr-1">{ready ?? 0} ready</span>
                            <span className="badge badge-warning text-xs">{pending ?? 0} pending</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/travel/missions/${m.id}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
