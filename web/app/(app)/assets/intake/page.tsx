"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { assetsApi, type Asset } from "@/lib/api";
import { canManageAssets, getStoredUser } from "@/lib/auth";

export default function AssetsIntakePage() {
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = canManageAssets(getStoredUser());

  useEffect(() => {
    assetsApi.list({ status: "pending", per_page: 100 })
      .then((r) => setItems(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Intake / Pending Registration</h1>
          <p className="page-subtitle">GRN drafts awaiting classification and capitalisation. Consumables stay in Stock.</p>
        </div>
        <Link href="/assets" className="btn-secondary">Full register</Link>
      </div>
      {loading ? <p>Loading…</p> : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Est. value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={5}>No pending assets.</td></tr>
              )}
              {items.map((a) => (
                <tr key={a.id}>
                  <td>{a.asset_code}</td>
                  <td>{a.name}</td>
                  <td>{a.category}</td>
                  <td>{a.purchase_value ?? "—"}</td>
                  <td>
                    {canManage && (
                      <Link href={`/assets?status=pending`} className="btn-primary text-xs">Capitalise on register</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
