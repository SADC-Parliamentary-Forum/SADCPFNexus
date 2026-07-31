"use client";

import { useEffect, useState } from "react";
import api, { assetMovementsApi, type AssetMovement } from "@/lib/api";

export default function AssetTransfersPage() {
  const [rows, setRows] = useState<AssetMovement[]>([]);

  useEffect(() => {
    assetMovementsApi.list({ movement_type: "transfer", per_page: 50 })
      .then((r) => setRows(r.data.data ?? []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Transfers</h1>
          <p className="page-subtitle">Custody transfers and movement log. Assignment history is immutable on the API.</p>
        </div>
        <a href="/assets/movement/new" className="btn-primary">Record movement</a>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Asset</th>
              <th>From</th>
              <th>To</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{m.movement_date}</td>
                <td>{m.asset?.asset_code ?? m.asset_id}</td>
                <td>{m.from_user?.name ?? "—"}</td>
                <td>{m.to_user?.name ?? "—"}</td>
                <td>{m.reason ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5}>No transfer movements yet. Use Register → assign/transfer actions.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
