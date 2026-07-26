"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  budgetReservationsApi,
  procurementApi,
  type BudgetReservation,
  type ProcurementRequest,
} from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import BudgetLinePicker from "@/components/budget/BudgetLinePicker";

function getListData<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

export default function ProcurementBudgetPage() {
  const qc = useQueryClient();
  const user = getStoredUser();
  const canFinance =
    isSystemAdmin(user) ||
    hasPermission(user, ["finance.approve", "finance.admin", "procurement.admin"]);

  const [reserveFor, setReserveFor] = useState<ProcurementRequest | null>(null);
  const [budgetLineId, setBudgetLineId] = useState<number | null>(null);
  const [reservedAmount, setReservedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const hodApprovedQuery = useQuery({
    queryKey: ["procurement", "budget", "hod-approved"],
    queryFn: () =>
      procurementApi.list({ status: "hod_approved", per_page: 100 }).then((res) => getListData<ProcurementRequest>(res.data)),
    staleTime: 20_000,
  });

  const awaitingApprovalQuery = useQuery({
    queryKey: ["procurement", "budget", "budget-reserved"],
    queryFn: () =>
      procurementApi.list({ status: "budget_reserved", per_page: 100 }).then((res) => getListData<ProcurementRequest>(res.data)),
    staleTime: 20_000,
  });

  const reservationsQuery = useQuery({
    queryKey: ["procurement", "budget-reservations"],
    queryFn: () =>
      budgetReservationsApi.list({ per_page: 100 }).then((res) => getListData<BudgetReservation>(res.data)),
    staleTime: 20_000,
  });

  const reserveMut = useMutation({
    mutationFn: (payload: {
      requestId: number;
      budget_line_id: number;
      reserved_amount: number;
      notes?: string;
    }) =>
      budgetReservationsApi.reserve(payload.requestId, {
        budget_line_id: payload.budget_line_id,
        reserved_amount: payload.reserved_amount,
        notes: payload.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procurement", "budget"] });
      qc.invalidateQueries({ queryKey: ["procurement", "budget-reservations"] });
      setReserveFor(null);
      setBudgetLineId(null);
      setReservedAmount("");
      setNotes("");
      setFormError(null);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data
          ?.message ??
        (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors
          ?.budget_line_id?.[0] ??
        (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors?.amount?.[0] ??
        "Failed to reserve budget.";
      setFormError(msg);
    },
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => procurementApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procurement", "budget"] });
    },
  });

  const needsReservation = hodApprovedQuery.data ?? [];
  const awaitingApproval = awaitingApprovalQuery.data ?? [];
  const reservations = reservationsQuery.data ?? [];

  const openReserve = (req: ProcurementRequest) => {
    setReserveFor(req);
    setBudgetLineId(null);
    setReservedAmount(String(req.estimated_value ?? ""));
    setNotes("");
    setFormError(null);
  };

  if (!canFinance) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 max-w-xl">
        Finance access is required to confirm budget reservations.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="page-title">Budget Confirmation</h1>
        <p className="page-subtitle">Finance queue: reserve budget for HOD-approved requests, then approve for procurement.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Needs reservation</p>
          <p className="text-2xl font-bold text-neutral-900">{needsReservation.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500">Awaiting procurement approval</p>
          <p className="text-2xl font-bold text-neutral-900">{awaitingApproval.length}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-800">HOD approved — reserve budget</h2>
        <div className="card overflow-x-auto">
          {needsReservation.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-400 text-center">No requests awaiting budget reservation.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Title</th>
                  <th>Est. value</th>
                  <th>HOD reviewed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {needsReservation.map((req) => (
                  <tr key={req.id}>
                    <td className="font-mono text-xs">{req.reference_number}</td>
                    <td className="font-medium">{req.title}</td>
                    <td className="font-mono text-sm">
                      {req.currency} {Number(req.estimated_value).toLocaleString()}
                    </td>
                    <td className="text-xs text-neutral-500">
                      {req.hod_reviewed_at ? formatDateShort(req.hod_reviewed_at) : "—"}
                    </td>
                    <td className="whitespace-nowrap">
                      <button type="button" className="btn-primary text-xs py-1.5 px-3" onClick={() => openReserve(req)}>
                        Reserve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-800">Budget reserved — approve request</h2>
        <div className="card overflow-x-auto">
          {awaitingApproval.length === 0 ? (
            <p className="px-5 py-8 text-sm text-neutral-400 text-center">No budget-reserved requests awaiting approval.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Title</th>
                  <th>Reserved</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {awaitingApproval.map((req) => {
                  const active = reservations.find(
                    (r) => r.procurement_request_id === req.id && !r.released_at
                  );
                  return (
                    <tr key={req.id}>
                      <td className="font-mono text-xs">{req.reference_number}</td>
                      <td className="font-medium">{req.title}</td>
                      <td className="text-sm font-mono">
                        {active
                          ? `${active.currency} ${Number(active.reserved_amount).toLocaleString()} (${active.budget_line})`
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap flex gap-2">
                        <Link href={`/procurement/${req.id}`} className="text-xs text-primary hover:underline">
                          View
                        </Link>
                        <button
                          type="button"
                          className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                          disabled={approveMut.isPending}
                          onClick={() => approveMut.mutate(req.id)}
                        >
                          Approve
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {reserveFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReserveFor(null)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold">Reserve Budget</h2>
            <p className="text-xs text-neutral-500">{reserveFor.reference_number} — {reserveFor.title}</p>
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
            )}
            <div>
              <BudgetLinePicker
                value={budgetLineId}
                amount={reservedAmount ? parseFloat(reservedAmount) : null}
                required
                onChange={(id) => setBudgetLineId(id)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Reserved amount</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="form-input"
                value={reservedAmount}
                onChange={(e) => setReservedAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Notes (optional)</label>
              <textarea className="form-input h-20 resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setReserveFor(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1 disabled:opacity-50"
                disabled={reserveMut.isPending || !budgetLineId || !reservedAmount}
                onClick={() =>
                  reserveMut.mutate({
                    requestId: reserveFor.id,
                    budget_line_id: budgetLineId!,
                    reserved_amount: parseFloat(reservedAmount),
                    notes: notes.trim() || undefined,
                  })
                }
              >
                {reserveMut.isPending ? "Saving…" : "Confirm reservation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
