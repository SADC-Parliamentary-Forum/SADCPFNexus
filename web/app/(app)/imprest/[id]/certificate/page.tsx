"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { imprestApi, type ImprestRequest } from "@/lib/api";
import { PrintButton } from "@/components/ui/PrintButton";

export default function ImprestCertificatePage() {
  const params = useParams();
  const id = Number(params?.id);
  const [request, setRequest] = useState<ImprestRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Number.isNaN(id)) { setLoading(false); setError("Invalid request ID."); return; }
    imprestApi.certificate(id)
      .then((res) => setRequest((res.data as any).data ?? res.data))
      .catch(() => setError("Certificate not available. The request may not be approved yet."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="max-w-3xl mx-auto h-96 bg-neutral-50 rounded-xl animate-pulse" />;
  }

  if (error || !request) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-4 text-sm text-red-700">{error ?? "Certificate not found."}</div>
        <Link href={`/imprest/${id}`} className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>Back to Request
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
          <Link href="/imprest" className="hover:text-primary font-medium transition-colors">Imprest</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href={`/imprest/${id}`} className="hover:text-primary transition-colors font-mono">{request.reference_number}</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-600">Certificate</span>
        </nav>
        <PrintButton className="text-xs print:hidden" />
      </div>

      <div className="card p-8 print:shadow-none print:border-none">
        <div className="text-center border-b border-neutral-200 pb-6 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mx-auto mb-3">
            <span className="material-symbols-outlined text-green-600 text-[28px]">workspace_premium</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">SADC Parliamentary Forum</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Imprest Approval Certificate</p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1">
            <span className="material-symbols-outlined text-green-600 text-[14px]">verified</span>
            <span className="text-xs font-semibold text-green-700">Fully Approved</span>
          </div>
        </div>

        <div className="flex justify-between text-xs text-neutral-500 mb-6">
          <span>Ref: <span className="font-mono font-semibold text-neutral-700">{request.reference_number}</span></span>
          <span>Generated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
        </div>

        <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4 mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-2">Requester</p>
          <p className="text-base font-bold text-neutral-900">{request.requester?.name ?? "—"}</p>
          <p className="text-sm text-neutral-500">{request.purpose}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Amount Requested</p>
            <p className="text-sm font-bold text-primary">{request.currency} {request.amount_requested.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">Amount Approved</p>
            <p className="text-sm font-bold text-green-700">{request.currency} {(request.amount_approved ?? request.amount_requested).toLocaleString()}</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-3">Approval Chain</p>
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
                <tr><td colSpan={5} className="py-4 px-3 text-center text-xs text-neutral-400">No workflow steps recorded.</td></tr>
              ) : steps.map((step: any, idx: number) => {
                const h = history.find((e: any) => e.step_index === idx) ?? history[idx];
                return (
                  <tr key={step.id} className="border-b border-neutral-100">
                    <td className="py-2.5 px-3 text-neutral-600">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-neutral-900">{h?.user?.name ?? step.step_name ?? step.approver_type?.replace(/_/g, " ")}</td>
                    <td className="py-2.5 px-3">
                      {h ? (
                        <span className={`inline-flex text-[11px] font-semibold rounded-full px-2 py-0.5 ${h.action === "approve" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                          {h.action === "approve" ? "Approved" : h.action}
                        </span>
                      ) : <span className="text-xs text-neutral-400">—</span>}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600 text-xs">{h?.created_at ? new Date(h.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                    <td className="py-2.5 px-3 text-neutral-500 text-xs italic">{h?.comment ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-neutral-200 pt-5 text-center">
          <p className="text-xs text-neutral-400">This certificate confirms that the above imprest request was reviewed and approved through the SADC-PF approval workflow.</p>
          <p className="text-[11px] text-neutral-300 mt-1">SADCPFNexus · {request.reference_number}</p>
        </div>
      </div>

      <Link href={`/imprest/${id}`} className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors print:hidden">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>Back to Request
      </Link>
    </div>
  );
}
