"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { stockUnitsApi, type StockUnit } from "@/lib/api";
import { canConfigureStockCatalogue, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";

export default function StockUnitsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<StockUnit[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    stockUnitsApi.list()
      .then((res) => setItems(res.data.data ?? []))
      .catch(() => toast("error", "Failed to load units"))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    setCanManage(canConfigureStockCatalogue(getStoredUser()));
    load();
  }, [load]);

  const create = async () => {
    if (!code.trim() || !name.trim()) {
      toast("error", "Code and name are required");
      return;
    }
    try {
      await stockUnitsApi.create({ code: code.trim(), name: name.trim() });
      toast("success", "Unit created");
      setCode(""); setName("");
      load();
    } catch {
      toast("error", "Could not create unit");
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="Units of measure"
        subtitle="Controlled UoM for consumables (ream, box, pack, each…)."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Stock", href: "/stock" }, { label: "Units of measure" }]} />}
      />

      {canManage && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 grid md:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="stock-units-code" className="block text-xs font-semibold mb-1">Code</label>
            <input id="stock-units-code" className="form-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ream" />
          </div>
          <div>
            <label htmlFor="stock-units-name" className="block text-xs font-semibold mb-1">Name</label>
            <input id="stock-units-name" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ream" />
          </div>
          <button type="button" className="btn-primary" onClick={create}>Add unit</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="straighten"
            title="No units of measure yet"
            description="Add units such as ream, box, pack, or each so items can be measured consistently."
          />
        </div>
      ) : (
        <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-xs">{u.code}</td>
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2">{u.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Link href="/stock" className="btn-secondary text-sm">Back to stock register</Link>
    </div>
  );
}
