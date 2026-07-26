"use client";

import { useEffect, useState } from "react";
import { travelApi } from "@/lib/api";

type ToilRow = {
  id: number;
  candidate_date: string;
  hours: number;
  reason: string | null;
  status: string;
  expires_at?: string | null;
  sg_extend_reason?: string | null;
  travel_request?: { id: number; reference_number: string };
  user?: { id: number; name: string };
};

const STATUS_LABEL: Record<string, string> = {
  pending_supervisor: "Pending supervisor",
  pending_hr: "Pending HR",
  credited: "Credited",
  rejected: "Rejected",
  expired: "Expired",
  extended: "Extended (SG)",
  // legacy (pre-migration)
  candidate: "Pending supervisor",
  ot_authorised: "Pending supervisor",
  duty_confirmed: "Pending HR",
  lapsed: "Expired",
};

export default function TravelToilPage() {
  const [rows, setRows] = useState<ToilRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    travelApi.listToil({ per_page: 50 })
      .then((r) => setRows((r.data.data as ToilRow[]) ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg(ok);
      load();
    } catch {
      setMsg("Action failed.");
    }
  };

  const extend = async (id: number) => {
    const reason = window.prompt("SG extension reason (required):");
    if (!reason?.trim()) {
      setMsg("Extension cancelled — reason is required.");
      return;
    }
    const expires = window.prompt("New expiry date (YYYY-MM-DD), or leave blank for +30 days:");
    await act(
      () => travelApi.toilExtend(id, {
        reason: reason.trim(),
        ...(expires?.trim() ? { expires_at: expires.trim() } : {}),
      }),
      "Expiry extended by SG — leave credit retained with new expiry.",
    );
  };

  const reject = async (id: number) => {
    const reason = window.prompt("Rejection reason (required):");
    if (!reason?.trim()) return;
    await act(() => travelApi.toilReject(id, reason.trim()), "Candidate rejected — no leave credited.");
  };

  const awaitsSupervisor = (s: string) =>
    s === "pending_supervisor" || s === "candidate" || s === "ot_authorised";
  const awaitsHr = (s: string) => s === "pending_hr" || s === "duty_confirmed";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Auto-TOIL approval queue</h1>
      <p className="text-sm text-neutral-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Weekend / public-holiday duty days are auto-calculated and notified to supervisor + HR.
        Leave credit is applied only after supervisor confirms duty and HR validates.
        Accrual expires 30 days from accrual date unless the Secretary General extends.
      </p>
      {msg && <p className="text-sm text-primary">{msg}</p>}
      {loading ? <p className="text-sm text-neutral-400">Loading…</p> : (
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Traveller</th>
              <th>Travel</th>
              <th>Hours</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-neutral-400">No TOIL candidates.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td>{r.candidate_date}</td>
                <td>{r.user?.name ?? "—"}</td>
                <td className="font-mono text-sm">{r.travel_request?.reference_number ?? "—"}</td>
                <td>{r.hours}</td>
                <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                <td>{r.expires_at ?? "—"}</td>
                <td className="space-x-2 text-xs">
                  {awaitsSupervisor(r.status) && (
                    <button
                      type="button"
                      className="btn-secondary py-1 px-2"
                      onClick={() => act(() => travelApi.toilConfirmDuty(r.id), "Duty confirmed — pending HR")}
                    >
                      Confirm duty
                    </button>
                  )}
                  {awaitsHr(r.status) && (
                    <button
                      type="button"
                      className="btn-primary py-1 px-2"
                      onClick={() => act(() => travelApi.toilHrValidate(r.id), "Credited to Leave accrual (no leave request auto-created)")}
                    >
                      HR validate &amp; credit
                    </button>
                  )}
                  {(r.status === "credited" || r.status === "extended" || r.status === "expired") && (
                    <button
                      type="button"
                      className="btn-secondary py-1 px-2"
                      onClick={() => extend(r.id)}
                    >
                      SG extend
                    </button>
                  )}
                  {awaitsSupervisor(r.status) || awaitsHr(r.status) ? (
                    <button
                      type="button"
                      className="btn-secondary py-1 px-2 text-red-700"
                      onClick={() => reject(r.id)}
                    >
                      Reject
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
