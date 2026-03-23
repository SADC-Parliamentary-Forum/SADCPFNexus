"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { procurementApi, type ProcurementRequest } from "@/lib/api";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  approved:  { label: "Approved",  cls: "text-green-700 bg-green-50 border-green-200",        icon: "check_circle"  },
  submitted: { label: "Pending",   cls: "text-amber-700 bg-amber-50 border-amber-200",        icon: "pending"       },
  rejected:  { label: "Rejected",  cls: "text-red-700 bg-red-50 border-red-200",              icon: "cancel"        },
  draft:     { label: "Draft",     cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "edit_note"     },
  awarded:   { label: "Awarded",   cls: "text-blue-700 bg-blue-50 border-blue-200",           icon: "emoji_events"  },
};

const categoryConfig: Record<string, { icon: string; color: string; bg: string }> = {
  goods:    { icon: "inventory_2",    color: "text-primary",  bg: "bg-primary/10"  },
  services: { icon: "handyman",       color: "text-purple-600", bg: "bg-purple-50" },
  works:    { icon: "construction",   color: "text-orange-600", bg: "bg-orange-50" },
};

function SectionIcon({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
      <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 bg-neutral-100 rounded" />
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="h-4 w-36 bg-neutral-100 rounded" />
    </div>
  );
}

export default function ProcurementDetailPage({ params }: { params: { id: string } }) {
  const [request, setRequest] = useState<ProcurementRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      setError("Invalid request ID");
      setLoading(false);
      return;
    }
    procurementApi.get(id)
      .then((res) => setRequest(res.data))
      .catch(() => setError("Failed to load procurement request."))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-4 w-48 bg-neutral-100 rounded animate-pulse" />
        <div className="h-7 w-64 bg-neutral-100 rounded animate-pulse" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-[20px] flex-shrink-0 mt-0.5">error_outline</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Error loading request</p>
            <p className="text-sm text-red-600 mt-0.5">{error ?? "Request not found."}</p>
          </div>
        </div>
        <Link href="/procurement" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Procurement
        </Link>
      </div>
    );
  }

  const s = statusConfig[request.status] ?? statusConfig.draft;
  const catInfo = categoryConfig[request.category] ?? { icon: "shopping_cart", color: "text-neutral-600", bg: "bg-neutral-100" };
  const items = request.items ?? [];
  const quotes = request.quotes ?? [];
  const totalItems = items.reduce((sum, i) => sum + (i.total_price ?? 0), 0);
  const currency = request.currency ?? "USD";

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Breadcrumb + title */}
      <div>
        <nav className="flex items-center gap-1.5 text-xs text-neutral-400 mb-3">
          <Link href="/procurement" className="hover:text-primary transition-colors font-medium">Procurement</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="font-mono text-neutral-500">{request.reference_number}</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${catInfo.color} bg-${catInfo.bg} border-neutral-200`}>
                <span className={`material-symbols-outlined text-[12px] ${catInfo.color}`}>{catInfo.icon}</span>
                {request.category}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                <span className="material-symbols-outlined text-[12px]">gavel</span>
                {request.procurement_method ?? "—"}
              </span>
            </div>
            <h1 className="text-xl font-bold text-neutral-900">{request.title}</h1>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold flex-shrink-0 ${s.cls}`}>
            <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
            {s.label}
          </span>
        </div>
      </div>

      {/* Requested By */}
      {request.requester && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="badge" color="text-primary" bg="bg-primary/10" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Requested By</h3>
            {request.submitted_at && (
              <span className="ml-auto text-xs text-neutral-400">
                {new Date(request.submitted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">
                {String(request.requester.name ?? "").split(" ").map((n) => n[0]).join("").slice(0, 2) || "—"}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">{request.requester.name}</p>
              <p className="text-xs text-neutral-400">
                {[request.requester.job_title, (request.requester as { employee_number?: string }).employee_number].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Requisition Details */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="shopping_cart" color="text-purple-600" bg="bg-purple-50" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Requisition Details</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">category</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Category</p>
            </div>
            <p className="font-medium text-neutral-900 capitalize">{request.category}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">gavel</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Procurement Method</p>
            </div>
            <p className="font-medium text-neutral-900 capitalize">{request.procurement_method ?? "—"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">account_tree</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Budget Line</p>
            </div>
            <p className="font-mono text-xs text-neutral-900">{request.budget_line ?? "—"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">calendar_today</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Required By</p>
            </div>
            <p className="font-medium text-neutral-900">{request.required_by_date ?? "—"}</p>
          </div>
        </div>
        {request.description && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">description</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Description</p>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{request.description}</p>
          </div>
        )}
        {request.justification && (
          <div className="mt-3 pt-3 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">chat_bubble</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Justification</p>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{request.justification}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <SectionIcon icon="list_alt" color="text-neutral-600" bg="bg-neutral-100" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Line Items</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wide">Total</span>
            <span className="text-sm font-bold text-primary">{currency} {totalItems.toLocaleString()}</span>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Description</th>
              <th className="text-center">Qty</th>
              <th className="text-right">Unit Price</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-neutral-400 py-8">No line items.</td>
              </tr>
            ) : items.map((item) => (
              <tr key={item.id}>
                <td>
                  <p className="font-medium text-neutral-900">{item.description}</p>
                  {item.unit && <p className="text-xs text-neutral-400">{item.unit}</p>}
                </td>
                <td className="text-center font-medium text-neutral-700">{item.quantity}</td>
                <td className="text-right text-neutral-600">{currency} {(item.estimated_unit_price ?? 0).toLocaleString()}</td>
                <td className="text-right font-bold text-neutral-900">{currency} {(item.total_price ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vendor Quotes */}
      {quotes.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="storefront" color="text-teal-600" bg="bg-teal-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Vendor Quotes</h3>
            <span className="ml-auto text-xs text-neutral-400">{quotes.length} quote{quotes.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-2.5">
            {[...quotes].sort((a, b) => (a.quoted_amount ?? 0) - (b.quoted_amount ?? 0)).map((q, i) => (
              <div key={q.id} className={`rounded-xl border p-4 ${q.is_recommended ? "border-primary/30 bg-primary/5" : "border-neutral-100 bg-neutral-50"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${q.is_recommended ? "bg-primary/10" : "bg-white border border-neutral-200"}`}>
                      <span className={`material-symbols-outlined text-[18px] ${q.is_recommended ? "text-primary" : "text-neutral-400"}`}>storefront</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-semibold text-neutral-900">{q.vendor_name}</p>
                        {q.is_recommended && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            <span className="material-symbols-outlined text-[11px]">star</span>
                            Recommended
                          </span>
                        )}
                        {i === 0 && !q.is_recommended && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                            <span className="material-symbols-outlined text-[11px]">trending_down</span>
                            Lowest
                          </span>
                        )}
                      </div>
                      {q.notes && <p className="text-xs text-neutral-500">{q.notes}</p>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wide">Quote</p>
                    <p className="text-base font-bold text-neutral-900">{q.currency ?? currency} {(q.quoted_amount ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Back link */}
      <Link href="/procurement" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Procurement
      </Link>
    </div>
  );
}
