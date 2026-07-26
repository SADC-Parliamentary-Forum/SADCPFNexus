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
  travel_request?: { id: number; reference_number: string };
  user?: { id: number; name: string };
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Potential Leave-in-Lieu (TOIL)</h1>
      <p className="text-sm text-neutral-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Travel date ≠ automatic TOIL. Candidates require OT authorisation → supervisor duty confirm → HR validate.
        Credit creates a Leave accrual with 30-day expiry — never an auto leave request.
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
                <td>{r.status}</td>
                <td>{r.expires_at ?? "—"}</td>
                <td className="space-x-2 text-xs">
                  {r.status === "candidate" && (
                    <button type="button" className="btn-secondary py-1 px-2" onClick={() => act(() => travelApi.toilAuthoriseOt(r.id), "OT authorised")}>Authorise OT</button>
                  )}
                  {r.status === "ot_authorised" && (
                    <button type="button" className="btn-secondary py-1 px-2" onClick={() => act(() => travelApi.toilConfirmDuty(r.id), "Duty confirmed")}>Confirm duty</button>
                  )}
                  {(r.status === "duty_confirmed" || r.status === "ot_authorised") && (
                    <button type="button" className="btn-primary py-1 px-2" onClick={() => act(() => travelApi.toilHrValidate(r.id), "Credited (no leave auto-created)")}>HR validate</button>
                  )}
                  {r.status === "credited" && (
                    <button type="button" className="btn-secondary py-1 px-2" onClick={() => act(() => travelApi.toilExtend(r.id), "Expiry extended by SG")}>SG extend</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
