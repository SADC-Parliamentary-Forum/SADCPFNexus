"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { travelApi, type TravelRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { PrintButton } from "@/components/ui/PrintButton";

export default function TravelCertificatePage() {
  const params = useParams();
  const id = Number(params?.id);
  const [request, setRequest] = useState<TravelRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setLoading(false);
      setError("Invalid request ID.");
      return;
    }
    travelApi.certificate(id)
      .then((res) => setRequest((res.data as any).data ?? res.data))
      .catch(() => setError("Certificate not available. The request may not be approved yet."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-4 w-48 bg-neutral-100 rounded" />
        <div className="h-96 bg-neutral-50 rounded-xl" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-700">
          {error ?? "Certificate not found."}
        </div>
        <Link href={`/travel/${id}`} className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Request
        </Link>
      </div>
    );
  }

  const approvalRequest = (request as any).approval_request;
  const history = approvalRequest?.history ?? [];
  const steps = approvalRequest?.workflow?.steps ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
          <Link href="/travel" className="hover:text-primary font-medium transition-colors">Travel</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href={`/travel/${id}`} className="hover:text-primary transition-colors font-mono">{request.reference_number}</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-600">Certificate</span>
        </nav>
        <PrintButton className="text-xs print:hidden" />
        <a
          href={travelApi.pdfUrl(id)}
          className="btn-secondary text-xs print:hidden inline-flex items-center gap-1"
          data-testid="travel-pdf-download"
        >
          <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
          Download PDF (Parts A–D)
        </a>
      </div>

      {/* Certificate */}
      <div className="card p-8 print:shadow-none print:border-none">
        {/* Header */}
        <div className="text-center border-b border-neutral-200 pb-6 mb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <span className="material-symbols-outlined text-green-600 text-[28px]">workspace_premium</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">SADC Parliamentary Forum</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Travel Requisition / Authorisation Form (Parts A–D)</p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1">
            <span className="material-symbols-outlined text-green-600 text-[14px]">verified</span>
            <span className="text-xs font-semibold text-green-700">Authorisation record</span>
          </div>
        </div>

        {/* Reference */}
        <div className="flex justify-between text-xs text-neutral-500 mb-6">
          <span>Ref: <span className="font-mono font-semibold text-neutral-700">{request.reference_number}</span></span>
          <span>Generated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
        </div>

        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-700 mb-2">Part A — Traveller &amp; Mission</h2>
        {/* Requester */}
        <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4 mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-2">Requester</p>
          <p className="text-base font-bold text-neutral-900">{request.requester?.name ?? "—"}</p>
          <p className="text-sm text-neutral-500">{[request.requester?.job_title, request.requester?.employee_number].filter(Boolean).join(" · ")}</p>
          <p className="text-sm text-neutral-600 mt-2">{request.purpose}</p>
        </div>

        {/* Trip Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Destination</p>
            <p className="text-sm font-semibold text-neutral-900">
              {[request.destination_city, request.destination_country].filter(Boolean).join(", ") || request.destination_country}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Travel Period</p>
            <p className="text-sm font-semibold text-neutral-900">
              {formatDateShort(request.departure_date)} → {formatDateShort(request.return_date)}
            </p>
          </div>
          <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Purpose</p>
            <p className="text-sm font-semibold text-neutral-900">{request.purpose}</p>
          </div>
          <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Estimated DSA</p>
            <p className="text-sm font-bold text-primary">
              {request.currency ?? ""}{" "}
              {request.estimated_dsa == null || Number.isNaN(Number(request.estimated_dsa))
                ? "—"
                : Number(request.estimated_dsa).toLocaleString()}
            </p>
          </div>
        </div>

        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-700 mb-2">Part B — Itinerary</h2>
        <div className="rounded-xl border border-neutral-100 p-4 mb-6 text-sm text-neutral-700">
          {(request.itineraries?.length ?? 0) === 0 ? (
            <p>{formatDateShort(request.departure_date)} → {formatDateShort(request.return_date)} · {[request.destination_city, request.destination_country].filter(Boolean).join(", ") || "—"}</p>
          ) : (
            <ul className="space-y-1">
              {(request.itineraries ?? []).map((leg) => (
                <li key={leg.id}>{formatDateShort(leg.travel_date)} · {leg.from_location} → {leg.to_location} ({leg.transport_mode})</li>
              ))}
            </ul>
          )}
        </div>

        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-700 mb-2">Part C — DSA Calculation</h2>
        <div className="rounded-xl border border-neutral-100 p-4 mb-6 text-sm">
          <p>
            Finance DSA total:{" "}
            <strong>
              {request.currency ?? ""}{" "}
              {(() => {
                const amt = request.finance_dsa_total ?? request.actual_dsa ?? request.estimated_dsa;
                return amt == null || Number.isNaN(Number(amt)) ? "—" : Number(amt).toLocaleString();
              })()}
            </strong>
          </p>
          <p className="text-neutral-500 mt-1 capitalize">Status: {request.finance_status ?? "awaiting"}</p>
          {(request.dsa_lines?.length ?? 0) > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-neutral-600">
              {request.dsa_lines!.map((line, idx) => (
                <li key={line.id ?? idx}>
                  {String(line.date).slice(0, 10)} · Type {line.rate_type} · payable {line.daily_payable ?? line.daily_rate}
                  {line.is_personal ? " (personal)" : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-700 mb-2">Part D — Funding &amp; Authorisation</h2>
        {/* Approval Chain */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-3">Approval Chain</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500">Step</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500">Approver</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500">Action</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500">Date</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-500">Comment</th>
                </tr>
              </thead>
              <tbody>
                {steps.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 px-3 text-center text-xs text-neutral-400">No workflow steps recorded.</td>
                  </tr>
                ) : steps.map((step: any, idx: number) => {
                  const histEntry = history.find((h: any) => h.step_index === idx) ?? history[idx];
                  return (
                    <tr key={step.id} className="border-b border-neutral-100">
                      <td className="py-2.5 px-3 text-neutral-600">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-neutral-900">
                        {histEntry?.user?.name ?? step.step_name ?? step.approver_type?.replace(/_/g, " ")}
                      </td>
                      <td className="py-2.5 px-3">
                        {histEntry ? (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                            histEntry.action === "approve" ? "bg-green-50 text-green-700" :
                            histEntry.action === "reject"  ? "bg-red-50 text-red-700" :
                            "bg-amber-50 text-amber-700"
                          }`}>
                            {histEntry.action === "approve" ? "Approved" : histEntry.action === "reject" ? "Rejected" : histEntry.action}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-600 text-xs">
                        {histEntry?.created_at ? new Date(histEntry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500 text-xs italic">{histEntry?.comment ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 pt-5 text-center">
          <p className="text-xs text-neutral-400">
            This certificate confirms that the above travel request was reviewed and approved through the SADC-PF approval workflow.
          </p>
          <p className="text-[11px] text-neutral-300 mt-1">SADCPFNexus · {request.reference_number}</p>
        </div>
      </div>

      <Link href={`/travel/${id}`} className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors print:hidden">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Request
      </Link>
    </div>
  );
}
