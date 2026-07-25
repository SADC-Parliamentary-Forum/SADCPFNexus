"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { catalogueApi, vendorsApi } from "@/lib/api";

export default function CataloguePage() {
  const qc = useQueryClient();
  const [vendorId, setVendorId] = useState("");
  const [itemName, setItemName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");

  const { data: vendors } = useQuery({
    queryKey: ["vendors", "catalogue"],
    queryFn: () => vendorsApi.list().then((r) => r.data.data ?? []),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["procurement", "catalogue"],
    queryFn: () => catalogueApi.list().then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () =>
      catalogueApi.create({
        vendor_id: Number(vendorId),
        item_name: itemName,
        unit_price: Number(unitPrice),
      }),
    onSuccess: () => {
      setItemName("");
      setUnitPrice("");
      qc.invalidateQueries({ queryKey: ["procurement", "catalogue"] });
    },
  });

  const vendorList = Array.isArray(vendors) ? vendors : [];

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="page-title">Supplier Catalogue</h1>
        <p className="page-subtitle">Price/rate catalogue with version history on updates.</p>
      </div>

      <div className="card p-4 grid gap-3 sm:grid-cols-4 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1">Vendor</label>
          <select className="form-input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Select…</option>
            {vendorList.map((v: { id: number; name: string }) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Item</label>
          <input className="form-input" value={itemName} onChange={(e) => setItemName(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">Unit price</label>
          <input type="number" className="form-input" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!vendorId || !itemName || !unitPrice || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          Add
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-neutral-400">Loading…</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Price</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => (
                <tr key={String(row.id)} className="border-b border-neutral-50">
                  <td className="px-4 py-3">{String(row.item_name)}</td>
                  <td className="px-4 py-3">{String((row.vendor as { name?: string } | undefined)?.name ?? "")}</td>
                  <td className="px-4 py-3">{String(row.unit)}</td>
                  <td className="px-4 py-3">{String(row.unit_price)} {String(row.currency ?? "NAD")}</td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-400">No catalogue items.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
