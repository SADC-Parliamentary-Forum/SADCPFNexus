"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import { assetsApi, type Asset } from "@/lib/api";

export default function MyAssetsPage() {
  const [items, setItems] = useState<Asset[]>([]);

  useEffect(() => {
    assetsApi.list({ assigned_to: "me", per_page: 100 }).then((r) => setItems(r.data.data ?? []));
  }, []);

  async function acknowledge(id: number) {
    await assetsApi.acknowledge?.(id);
    const r = await assetsApi.list({ assigned_to: "me", per_page: 100 });
    setItems(r.data.data ?? []);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="page-header">
        <ModulePageHeader
        title="My Assigned Assets"
        subtitle="Acknowledge custody for items assigned to you"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "My Assigned Assets" }]} />}
      />
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tag / Code</th>
              <th>Name</th>
              <th>Status</th>
              <th>Acknowledged</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{(a as Asset & { tag_number?: string }).tag_number || a.asset_code}</td>
                <td>{a.name}</td>
                <td>{a.status}</td>
                <td>{(a as Asset & { acknowledgement_at?: string }).acknowledgement_at ? "Yes" : "No"}</td>
                <td>
                  {!(a as Asset & { acknowledgement_at?: string }).acknowledgement_at && (
                    <button className="btn-primary text-xs" onClick={() => acknowledge(a.id)}>Acknowledge</button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5}>No assets assigned to you.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
