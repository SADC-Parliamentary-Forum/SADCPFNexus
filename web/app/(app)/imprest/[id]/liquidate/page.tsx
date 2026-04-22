"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { imprestApi, type ImprestRequest } from "@/lib/api";
import { readStoredUser } from "@/lib/session";
import { formatDateShort } from "@/lib/utils";

function getStoredUser(): { id: number | null; roles: string[] } {
  const parsed = readStoredUser();
  return {
    id: typeof parsed?.id === "number" ? parsed.id : null,
    roles: Array.isArray(parsed?.roles) ? parsed.roles : [],
  };
}

function isImprestRequest(value: unknown): value is ImprestRequest {
  return typeof value === "object" && value !== null && "id" in value && "reference_number" in value;
}

function unwrapImprest(payload: unknown): ImprestRequest | null {
  if (isImprestRequest(payload)) return payload;
  if (typeof payload !== "object" || payload === null || !("data" in payload)) return null;

  const outer = (payload as { data?: unknown }).data;
  if (isImprestRequest(outer)) return outer;
  if (typeof outer !== "object" || outer === null || !("data" in outer)) return null;

  const inner = (outer as { data?: unknown }).data;
  return isImprestRequest(inner) ? inner : null;
}

export default function ImprestLiquidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const requestId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [amountSpent, setAmountSpent] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptsAttached, setReceiptsAttached] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: request, isLoading, isError } = useQuery({
    queryKey: ["imprest", requestId],
    queryFn: () => imprestApi.get(requestId).then((res) => unwrapImprest(res.data)),
    enabled: Number.isFinite(requestId) && requestId > 0,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      imprestApi.retire(requestId, {
        amount_liquidated: Number(amountSpent),
        notes: notes.trim() || undefined,
        receipts_attached: receiptsAttached,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["imprest", requestId] }),
        queryClient.invalidateQueries({ queryKey: ["imprest", "list"] }),
      ]);
      router.push(`/imprest/${requestId}`);
    },
    onError: (error: unknown) => {
      setSubmitError(
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to submit liquidation.",
      );
    },
  });

  if (!Number.isFinite(requestId) || requestId <= 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          Invalid imprest request ID.
        </div>
        <Link href="/imprest" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Imprest Requests
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-5 animate-pulse">
        <div className="h-4 w-48 rounded bg-neutral-100" />
        <div className="card p-6 space-y-3">
          <div className="h-6 w-56 rounded bg-neutral-100" />
          <div className="h-4 w-40 rounded bg-neutral-100" />
        </div>
        <div className="card p-6 space-y-3">
          <div className="h-4 w-24 rounded bg-neutral-100" />
          <div className="h-10 w-full rounded bg-neutral-100" />
          <div className="h-20 w-full rounded bg-neutral-100" />
        </div>
      </div>
    );
  }

  if (isError || !request) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
          Failed to load this imprest request.
        </div>
        <Link href="/imprest" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Imprest Requests
        </Link>
      </div>
    );
  }

  const approvedAmount = request.amount_approved ?? request.amount_requested;
  const enteredAmount = Number(amountSpent) || 0;
  const balance = approvedAmount - enteredAmount;
  const currentUser = getStoredUser();
  const hasElevatedAccess = currentUser.roles.some((role) =>
    ["Finance Controller", "Secretary General", "System Admin", "super-admin"].includes(role),
  );
  const canLiquidate =
    request.status === "approved" &&
    (
      hasElevatedAccess
      || currentUser.id == null
      || request.requester?.id == null
      || currentUser.id === request.requester.id
    );

  if (request.status === "liquidated") {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
          <Link href="/imprest" className="hover:text-primary transition-colors">Imprest</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href={`/imprest/${request.id}`} className="hover:text-primary transition-colors font-mono">{request.reference_number}</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-600">Liquidated</span>
        </nav>

        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
              <span className="material-symbols-outlined text-[24px] text-green-600">check_circle</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">Liquidation Submitted</h1>
              <p className="text-sm text-neutral-500">{request.reference_number}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Approved Amount</p>
              <p className="font-semibold text-neutral-900">{request.currency} {approvedAmount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Liquidated Amount</p>
              <p className="font-semibold text-neutral-900">{request.currency} {(request.amount_liquidated ?? 0).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href={`/imprest/${request.id}`} className="btn-primary inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              View Request
            </Link>
            <Link href="/imprest" className="btn-secondary inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to List
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (request.status !== "approved") {
    return (
      <div className="max-w-3xl mx-auto space-y-5">
        <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
          <Link href="/imprest" className="hover:text-primary transition-colors">Imprest</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href={`/imprest/${request.id}`} className="hover:text-primary transition-colors font-mono">{request.reference_number}</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-600">Liquidate</span>
        </nav>

        <div className="card p-6 space-y-3">
          <h1 className="text-xl font-bold text-neutral-900">Liquidation Not Available</h1>
          <p className="text-sm text-neutral-600">
            This request is currently <strong>{request.status}</strong>. Only approved imprest requests can be liquidated.
          </p>
          <Link href={`/imprest/${request.id}`} className="btn-secondary inline-flex items-center gap-1.5 w-fit">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Request
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Link href="/imprest" className="hover:text-primary transition-colors">Imprest</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href={`/imprest/${request.id}`} className="hover:text-primary transition-colors font-mono">{request.reference_number}</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-600">Liquidate</span>
      </nav>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Liquidate Imprest</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{request.purpose}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
            {request.reference_number}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Approved Amount</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{request.currency} {approvedAmount.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Liquidation Deadline</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{formatDateShort(request.expected_liquidation_date)}</p>
          </div>
        </div>

        {request.justification && (
          <div className="mt-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Original Justification</p>
            <p className="mt-1 text-sm text-neutral-700">{request.justification}</p>
          </div>
        )}
      </div>

      {!canLiquidate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          You can view this liquidation page, but only the requester or an authorised administrator can submit it.
        </div>
      )}

      <div className="card p-5 space-y-5">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">Liquidation Details</h2>
          <p className="text-sm text-neutral-500 mt-1">Submit the final amount spent and any supporting notes for Finance.</p>
        </div>

        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-600">
              Amount Spent ({request.currency}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-input"
              placeholder="0.00"
              value={amountSpent}
              onChange={(event) => setAmountSpent(event.target.value)}
            />
          </div>
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Balance</p>
            <p className={`mt-1 text-lg font-bold ${balance < 0 ? "text-red-600" : balance > 0 ? "text-blue-600" : "text-green-600"}`}>
              {request.currency} {Math.abs(balance).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {balance < 0 ? "Amount exceeds the approved imprest." : balance > 0 ? "Surplus to be returned." : "Fully liquidated."}
            </p>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-600">Notes / Explanation</label>
          <textarea
            rows={4}
            className="form-input resize-none"
            placeholder="Summarise how the imprest was used and note any surplus or overrun."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-neutral-300 accent-primary"
            checked={receiptsAttached}
            onChange={(event) => setReceiptsAttached(event.target.checked)}
          />
          <span className="text-sm text-neutral-700">
            I confirm that receipts and supporting documents are attached or will be submitted to Finance.
          </span>
        </label>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Link href={`/imprest/${request.id}`} className="btn-secondary inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Request
          </Link>
          <button
            type="button"
            disabled={!canLiquidate || submitMutation.isPending || amountSpent.trim() === ""}
            onClick={() => {
              setSubmitError(null);
              submitMutation.mutate();
            }}
            className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${submitMutation.isPending ? "animate-spin" : ""}`}>
              {submitMutation.isPending ? "progress_activity" : "check_circle"}
            </span>
            {submitMutation.isPending ? "Submitting..." : "Submit Liquidation"}
          </button>
        </div>
      </div>
    </div>
  );
}
