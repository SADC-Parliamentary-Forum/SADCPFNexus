"use client";

import { useEffect, useState } from "react";
import { platformAuditApi, type PlatformAuditEvent } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const OUTCOME_BADGE: Record<string, string> = {
  success: "badge-success",
  failed: "badge-danger",
  denied: "badge-danger",
  cancelled: "badge-muted",
};

type Props = {
  subjectType: string;
  subjectId: number | string;
  title?: string;
};

/**
 * Reusable record-level Platform Audit Trail timeline (append-only evidence).
 * Distinct from Internal Audit engagements/findings.
 */
export function AuditTimeline({ subjectType, subjectId, title = "Audit Trail" }: Props) {
  const [events, setEvents] = useState<PlatformAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    platformAuditApi
      .recordHistory(subjectType, subjectId, { per_page: 50 })
      .then((res) => {
        if (!cancelled) setEvents(res.data?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Audit timeline unavailable for this record.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectType, subjectId]);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <span className="material-symbols-outlined text-primary text-[20px]">history</span>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{title}</h3>
          <p className="text-[11px] text-neutral-400">Append-only platform evidence — not editable.</p>
        </div>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading audit events…</p>}
      {error && <p className="text-sm text-amber-700">{error}</p>}
      {!loading && !error && events.length === 0 && (
        <p className="text-sm text-neutral-500">No platform audit events recorded for this record yet.</p>
      )}

      {!loading && events.length > 0 && (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-100" />
          <div className="space-y-4">
            {events.map((e) => (
              <div key={e.uuid} className="flex items-start gap-4">
                <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-white">
                  <span className="material-symbols-outlined text-[16px] text-primary">event</span>
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{e.event_key}</p>
                    <span className={`badge ${OUTCOME_BADGE[e.outcome] ?? "badge-muted"}`}>{e.outcome}</span>
                    {e.migration_status && (
                      <span className="badge badge-muted">{e.migration_status}</span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {e.occurred_at ? formatDateShort(e.occurred_at) : "—"}
                    {e.actor_snapshot?.display_name ? ` · ${e.actor_snapshot.display_name}` : ""}
                    {e.acting_appointment_id ? " · acting" : ""}
                    {e.delegation_id ? " · delegated" : ""}
                  </p>
                  {e.reason && <p className="text-xs text-neutral-600 mt-1">{e.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
