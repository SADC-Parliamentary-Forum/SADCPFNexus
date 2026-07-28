"use client";

import { useCallback, useEffect, useState } from "react";
import { stockIssuesApi, type StockIssue } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function StockIssuesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<StockIssue[]>([]);

  const load = useCallback(() => {
    stockIssuesApi.list({ per_page: 50 })
      .then((res) => setRows(res.data.data ?? []))
      .catch(() => toast("error", "Failed to load issues"));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const ack = async (id: number) => {
    try {
      await stockIssuesApi.acknowledge(id);
      toast("success", "Acknowledged");
      load();
    } catch {
      toast("error", "Acknowledge failed");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Issue Vouchers</h1>
        <p className="page-subtitle">Ledgered stock-out vouchers with recipient acknowledgement.</p>
      </div>
      <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2">Voucher</th>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Issued to</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-neutral-100">
              <td className="px-4 py-2 font-medium">{r.voucher_number}</td>
              <td className="px-4 py-2">{r.issue_date}</td>
              <td className="px-4 py-2">{r.issued_to_user?.name ?? "—"}</td>
              <td className="px-4 py-2">{r.status}</td>
              <td className="px-4 py-2">
                {r.status === "issued" && (
                  <button type="button" className="btn-secondary text-xs" onClick={() => ack(r.id)}>Acknowledge</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
