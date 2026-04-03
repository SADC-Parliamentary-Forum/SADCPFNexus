"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { procurementApi, type ProcurementRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NAD";

type RfqFilter = "all" | "open" | "in_progress" | "ready";

function rfqFilter(req: ProcurementRequest): RfqFilter {
  const quotes = req.quotes ?? [];
  if (quotes.length === 0) return "open";
  return "in_progress";
}

function rfqBadge(filter: RfqFilter) {
  if (filter === "open")        return { label: "Open",        cls: "badge-warning", icon: "hourglass_empty" };
  if (filter === "in_progress") return { label: "Quotes In",   cls: "badge-primary", icon: "rate_review"     };
  return                               { label: "Open",        cls: "badge-warning", icon: "hourglass_empty" };
}

const FILTERS: { key: RfqFilter | "awarded"; label: string }[] = [
  { key: "all",         label: "All"         },
  { key: "open",        label: "Open"        },
  { key: "in_progress", label: "Quotes In"   },
  { key: "awarded",     label: "Awarded"     },
];

export default function RfqListPage() {
  const [tab, setTab] = useState<RfqFilter | "awarded">("all");

  const { data: approvedData, isLoading: loadingApproved } = useQuery({
    queryKey: ["rfq-approved"],
    queryFn: () => procurementApi.list({ status: "approved", per_page: 100 }).then((r) => r.data),
  });

  const { data: awardedData, isLoading: loadingAwarded } = useQuery({
    queryKey: ["rfq-awarded"],
    queryFn: () => procurementApi.list({ status: "awarded", per_page: 100 }).then((r) => r.data),
  });

  const approved: ProcurementRequest[] = (approvedData as { data?: ProcurementRequest[] })?.data ?? [];
  const awarded: ProcurementRequest[]  = (awardedData as { data?: ProcurementRequest[] })?.data ?? [];

  const open        = approved.filter((r) => (r.quotes ?? []).length === 0);
  const inProgress  = approved.filter((r) => (r.quotes ?? []).length > 0);

  const displayed = (() => {
    if (tab === "awarded")     return awarded;
    if (tab === "open")        return open;
    if (tab === "in_progress") return inProgress;
    return [...approved, ...awarded];
  })();

  const isLoading = loadingApproved || loadingAwarded;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Requests for Quotation</h1>
          <p className="page-subtitle">Manage vendor solicitations and record received quotes</p>
        </div>
        <Link href="/procurement/create" className="btn-primary inline-flex items-center gap-1.5 text-sm">
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Procurement Request
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total RFQs",   value: approved.length + awarded.length, icon: "request_quote",  color: "text-primary",   bg: "bg-primary/10"  },
          { label: "Open",         value: open.length,                       icon: "hourglass_empty",color: "text-amber-600", bg: "bg-amber-50"    },
          { label: "Quotes In",    value: inProgress.length,                 icon: "rate_review",   color: "text-blue-600",  bg: "bg-blue-50"     },
          { label: "Awarded",      value: awarded.length,                    icon: "emoji_events",  color: "text-green-600", bg: "bg-green-50"    },
        ].map((k) => (
          <div key={k.label} className="card p-4 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.bg} flex-shrink-0`}>
              <span className={`material-symbols-outlined text-[22px] ${k.color}`}>{k.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{k.value}</p>
              <p className="text-xs text-neutral-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setTab(f.key)}
            className={`filter-tab ${tab === f.key ? "active" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-neutral-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-neutral-100 rounded" />
                <div className="h-4 w-56 bg-neutral-100 rounded" />
              </div>
              <div className="h-6 w-20 bg-neutral-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-neutral-300">request_quote</span>
          <p className="text-sm text-neutral-500">No RFQs found for this filter.</p>
          <p className="text-xs text-neutral-400">
            RFQs are created from approved procurement requests.{" "}
            <Link href="/procurement" className="text-primary hover:underline">View requests</Link>.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title</th>
                <th>Category</th>
                <th className="text-right">Est. Value</th>
                <th className="text-center">Quotes</th>
                <th>Deadline</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((req) => {
                const quotes  = req.quotes ?? [];
                const isAwarded = req.status === "awarded";
                const filter  = isAwarded ? ("awarded" as const) : rfqFilter(req);
                const badge   = isAwarded
                  ? { label: "Awarded", cls: "badge-success", icon: "emoji_events" }
                  : rfqBadge(filter);
                const lowest  = quotes.length > 0 ? Math.min(...quotes.map((q) => q.quoted_amount)) : null;
                return (
                  <tr key={req.id}>
                    <td>
                      <Link href={`/procurement/rfq/${req.id}`} className="font-mono text-xs text-primary hover:underline">
                        {req.reference_number}
                      </Link>
                    </td>
                    <td className="text-sm font-medium text-neutral-800 max-w-[200px] truncate">{req.title}</td>
                    <td>
                      <span className="text-xs capitalize text-neutral-600">{req.category}</span>
                    </td>
                    <td className="text-right text-sm font-semibold text-neutral-900">
                      {req.currency ?? DEFAULT_CURRENCY} {(req.estimated_value ?? 0).toLocaleString()}
                    </td>
                    <td className="text-center">
                      {quotes.length === 0 ? (
                        <span className="text-xs text-neutral-400">—</span>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-sm font-bold text-neutral-900">{quotes.length}</span>
                          {lowest != null && (
                            <span className="text-[10px] text-green-600 font-medium">
                              Low: {req.currency ?? DEFAULT_CURRENCY} {lowest.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="text-sm text-neutral-500">
                      {req.rfq_deadline ? formatDateShort(req.rfq_deadline) : "—"}
                    </td>
                    <td>
                      <span className={`badge ${badge.cls} inline-flex items-center gap-1`}>
                        <span className="material-symbols-outlined text-[11px]">{badge.icon}</span>
                        {badge.label}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/procurement/rfq/${req.id}`}
                        className="inline-flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors font-medium"
                      >
                        Manage
                        <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
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
  );
}
