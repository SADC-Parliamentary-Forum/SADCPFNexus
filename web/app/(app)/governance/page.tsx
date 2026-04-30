"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { governanceApi, minutesApi, type GovernanceMeeting, type MeetingMinutesRecord } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

// ─── Constants ────────────────────────────────────────────────────────────────

const MEETING_TYPES = ["All", "ExCo", "Sub-Committee", "Plenary", "Technical", "Other"] as const;

const TYPE_STYLE: Record<string, string> = {
  "ExCo":          "bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/50",
  "Sub-Committee": "bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/50",
  "Plenary":       "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50",
  "Technical":     "bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50",
  "Other":         "bg-neutral-100 dark:bg-neutral-700/40 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-600",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeetingsMinutesPage() {
  const { toast } = useToast();

  const [meetings, setMeetings]     = useState<GovernanceMeeting[]>([]);
  const [minutes, setMinutes]       = useState<MeetingMinutesRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [typeFilter, setTypeFilter] = useState("All");
  const [search, setSearch]         = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, minRes] = await Promise.all([
        governanceApi.meetings(),
        minutesApi.list(),
      ]);
      setMeetings(mRes.data?.data ?? mRes.data ?? []);
      setMinutes(minRes.data?.data ?? minRes.data ?? []);
    } catch {
      toast("error", "Load failed", "Could not load meetings.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const minutesFor = (meetingTitle: string) =>
    minutes.filter((m) => m.title === meetingTitle);

  const filtered = meetings.filter((m) => {
    const matchType   = typeFilter === "All" || m.type === typeFilter;
    const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Meetings &amp; Minutes</h1>
          <p className="page-subtitle">Browse meeting records and attached minutes.</p>
        </div>
        <Link href="/governance/resolutions" className="btn-secondary text-sm">
          <span className="material-symbols-outlined text-sm mr-1">gavel</span>
          View Resolutions
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">search</span>
          <input
            className="form-input pl-9 text-sm"
            placeholder="Search meetings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {MEETING_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`filter-tab${typeFilter === t ? " active" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-300 dark:text-neutral-600">meeting_room</span>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">No meetings found.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Meeting</th>
                <th>Type</th>
                <th>Date</th>
                <th>Venue</th>
                <th>Minutes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const mins = minutesFor(m.title);
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="font-medium text-neutral-900 dark:text-neutral-100">{m.title}</div>
                    </td>
                    <td>
                      <span className={`badge border text-xs ${TYPE_STYLE[m.type] ?? TYPE_STYLE["Other"]}`}>
                        {m.type}
                      </span>
                    </td>
                    <td className="text-sm text-neutral-600 dark:text-neutral-400">
                      {m.date ? new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="text-sm text-neutral-600 dark:text-neutral-400">{m.responsible ?? "—"}</td>
                    <td>
                      {mins.length > 0 ? (
                        <span className="badge badge-success text-xs">{mins.length} attached</span>
                      ) : (
                        <span className="badge badge-muted text-xs">Pending</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button className="text-primary text-sm hover:underline">View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
