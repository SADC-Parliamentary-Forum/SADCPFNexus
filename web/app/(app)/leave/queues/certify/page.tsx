"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";

type LeaveRow = {
  id: number;
  reference_number: string;
  status: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  current_stage?: string;
  current_holder?: string;
  recommendation_status?: string;
  requester?: { id: number; name: string };
};

export default function LeaveCertificationQueuePage() {
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await api.get<{ data: LeaveRow[] }>("/leave/requests", { params: { queue: "certify", per_page: 50 } });
    const body = r.data as { data?: LeaveRow[] };
    setRows(Array.isArray(body.data) ? body.data : []);
  }

  useEffect(() => {
    load().catch(() => setRows([]));
  }, []);

  async function certify(id: number) {
    await api.post(`/leave/requests/${id}/certify`, { action: "certify", comment: "Certified from queue" });
    setMsg(`Leave #${id} certified.`);
    await load();
  }

  return (
    <div className="page-container space-y-4">
      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Leave Certification Queue</h1>
          <p className="page-subtitle">Recommended requests awaiting Administration/HR certification.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/leave?queue=recommend" className="btn btn-secondary btn-sm">Recommend inbox</Link>
          <Link href="/leave/toil" className="btn btn-secondary btn-sm">TOIL credits</Link>
        </div>
      </div>
      {msg && <div className="alert alert-success">{msg}</div>}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Employee</th>
              <th>Type</th>
              <th>Dates</th>
              <th>Holder</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/leave/${r.id}`} className="text-primary hover:underline">{r.reference_number}</Link>
                </td>
                <td>{r.requester?.name ?? "—"}</td>
                <td>{r.leave_type}</td>
                <td>{r.start_date} → {r.end_date}</td>
                <td>{r.current_holder ?? "HR/Admin"}</td>
                <td>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => void certify(r.id)}>
                    Certify
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6}>No requests awaiting certification.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
