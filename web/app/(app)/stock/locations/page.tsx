"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { stockLocationsApi, type StockLocation } from "@/lib/api";
import { canManageStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function StockLocationsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<StockLocation[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    stockLocationsApi.list()
      .then((res) => setItems(res.data.data ?? []))
      .catch(() => toast("error", "Failed to load locations"))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    setCanManage(canManageStock(getStoredUser()));
    load();
  }, [load]);

  const create = async () => {
    if (!code.trim() || !name.trim()) {
      toast("error", "Code and name are required");
      return;
    }
    try {
      await stockLocationsApi.create({ code: code.trim(), name: name.trim(), description: description.trim() || undefined });
      toast("success", "Location created");
      setCode(""); setName(""); setDescription("");
      load();
    } catch {
      toast("error", "Could not create location");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">Store locations</h1>
        <p className="page-subtitle">Physical stores / cupboards for consumables inventory.</p>
      </div>

      {canManage && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 grid md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold mb-1">Code</label>
            <input className="form-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="MAIN" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Name</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Main store" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Description</label>
            <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button type="button" className="btn-primary" onClick={create}>Add location</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-xs">{l.code}</td>
                <td className="px-4 py-2">{l.name}</td>
                <td className="px-4 py-2 text-neutral-500">{l.description || "—"}</td>
                <td className="px-4 py-2">{l.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Link href="/stock" className="text-sm text-primary hover:underline">← Back to stock register</Link>
    </div>
  );
}
