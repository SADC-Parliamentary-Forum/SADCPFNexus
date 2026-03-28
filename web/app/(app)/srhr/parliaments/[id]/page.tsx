"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import Link from "next/link";
import { parliamentsApi, type Parliament } from "@/lib/api";

export default function ParliamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [parliament, setParliament] = useState<Parliament | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    parliamentsApi
      .get(Number(id))
      .then((res) => setParliament(res.data.data))
      .catch(() => setError("Parliament not found."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="h-6 bg-neutral-100 rounded animate-pulse w-1/3" />
        <div className="card p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 bg-neutral-100 rounded animate-pulse w-2/3" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !parliament) {
    return (
      <div className="card p-8 text-center text-sm text-red-600">
        {error ?? "Parliament not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/srhr" className="hover:text-primary">SRHR</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/srhr/parliaments" className="hover:text-primary">Parliaments</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-800 font-medium">{parliament.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">{parliament.name}</h1>
          <p className="page-subtitle">{parliament.country_name}{parliament.city ? ` · ${parliament.city}` : ""}</p>
        </div>
        <span className={`badge ${parliament.is_active ? "badge-success" : "badge-muted"}`}>
          {parliament.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Details card */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-neutral-400">info</span>
          Contact Details
        </h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          {[
            { label: "Country Code", value: parliament.country_code },
            { label: "City",         value: parliament.city ?? "—" },
            { label: "Contact",      value: parliament.contact_name ?? "—" },
            { label: "Email",        value: parliament.contact_email ?? "—" },
            { label: "Phone",        value: parliament.contact_phone ?? "—" },
            { label: "Website",      value: parliament.website_url
              ? <a href={parliament.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{parliament.website_url}</a>
              : "—" },
          ].map((field) => (
            <div key={field.label}>
              <dt className="text-xs text-neutral-500 mb-0.5">{field.label}</dt>
              <dd className="font-medium text-neutral-900">{field.value}</dd>
            </div>
          ))}
        </dl>
        {parliament.notes && (
          <div className="mt-4 pt-4 border-t border-neutral-100">
            <p className="text-xs text-neutral-500 mb-1">Notes</p>
            <p className="text-sm text-neutral-700">{parliament.notes}</p>
          </div>
        )}
      </div>

      {/* Active Deployments */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">transfer_within_a_station</span>
            <h3 className="text-sm font-semibold text-neutral-900">
              Active Deployments
              {(parliament.active_deployments_count ?? 0) > 0 && (
                <span className="ml-2 badge badge-primary">{parliament.active_deployments_count}</span>
              )}
            </h3>
          </div>
          <Link href={`/srhr/deployments/new?parliament_id=${parliament.id}`} className="btn-primary text-xs px-3 py-1.5">
            + New Deployment
          </Link>
        </div>
        {!parliament.active_deployments || parliament.active_deployments.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-neutral-400">
            No active deployments at this parliament.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {parliament.active_deployments.map((dep) => (
              <div key={dep.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-blue-700">
                    {dep.employee?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{dep.employee?.name}</p>
                  <p className="text-xs text-neutral-500">{dep.employee?.job_title ?? "SRHR Researcher"}</p>
                </div>
                <Link href={`/srhr/deployments/${dep.id}`} className="text-xs text-primary hover:underline flex-shrink-0">
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
