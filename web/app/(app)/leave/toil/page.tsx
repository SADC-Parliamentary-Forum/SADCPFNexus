"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateShort } from "@/lib/utils";

type ToilCredit = {
  id: number;
  credit_reference?: string;
  remaining_balance?: number;
  expiry_date?: string;
  days_until_expiry?: number;
  status?: string;
};

const STATUS_BADGE: Record<string, string> = {
  available: "badge-success",
  active: "badge-success",
  expired: "badge-muted",
  exhausted: "badge-muted",
  pending: "badge-warning",
};

export default function LeaveToilPage() {
  const [credits, setCredits] = useState<ToilCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<{ data: ToilCredit[] }>("/leave/toil")
      .then((r) => {
        if (cancelled) return;
        const body = r.data as { data?: ToilCredit[] };
        setCredits(Array.isArray(body.data) ? body.data : Array.isArray(r.data) ? (r.data as ToilCredit[]) : []);
      })
      .catch(() => {
        if (cancelled) return;
        setCredits([]);
        setError("Failed to load TOIL credits.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const expiring = credits.filter((c) => typeof c.days_until_expiry === "number" && c.days_until_expiry <= 30);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="TOIL / Leave-in-Lieu Credits"
        subtitle="Expiry monitoring — overdue credits are expired by the daily job."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Leave", href: "/leave" }, { label: "TOIL credits" }]} />}
        actions={
          <>
            <Link href="/leave/queues/certify" className="btn-secondary text-sm">
              <span className="material-symbols-outlined text-[18px]">fact_check</span>
              Certification queue
            </Link>
            <Link href="/leave/create" className="btn-primary text-sm">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Apply leave
            </Link>
          </>
        }
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      {expiring.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="material-symbols-outlined text-[18px]">schedule</span>
          {expiring.length} credit{expiring.length === 1 ? "" : "s"} expire within 30 days.
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : credits.length === 0 ? (
          <EmptyState
            icon="schedule"
            title="No TOIL credits"
            description="Credits appear here after overtime or leave-in-lieu is approved."
            action={
              <Link href="/leave" className="btn-secondary text-sm">
                Back to leave register
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Balance (days)</th>
                  <th>Expires</th>
                  <th>Days left</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {credits.map((c) => {
                  const urgent = typeof c.days_until_expiry === "number" && c.days_until_expiry <= 14;
                  const status = (c.status ?? "available").toLowerCase();
                  return (
                    <tr key={c.id} className={urgent ? "bg-amber-50/60" : undefined}>
                      <td className="font-mono text-xs text-neutral-700">{c.credit_reference ?? c.id}</td>
                      <td className="font-semibold text-neutral-900">{c.remaining_balance ?? "—"}</td>
                      <td className="text-neutral-600">{c.expiry_date ? formatDateShort(c.expiry_date) : "—"}</td>
                      <td className={urgent ? "font-semibold text-amber-800" : "text-neutral-600"}>
                        {c.days_until_expiry ?? "—"}
                      </td>
                      <td>
                        <span className={`badge capitalize ${STATUS_BADGE[status] ?? "badge-muted"}`}>
                          {status.replace(/_/g, " ")}
                        </span>
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
