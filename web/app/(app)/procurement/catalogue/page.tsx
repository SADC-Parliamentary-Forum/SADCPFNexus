"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { catalogueApi, vendorsApi } from "@/lib/api";

export default function CataloguePage() {
  const qc = useQueryClient();
  const [vendorId, setVendorId] = useState("");
  const [itemName, setItemName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editReason, setEditReason] = useState("");

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

  const updateMut = useMutation({
    mutationFn: () =>
      catalogueApi.update(Number(editingId), {
        unit_price: Number(editPrice),
        change_reason: editReason || "Price update",
      }),
    onSuccess: () => {
      setEditingId(null);
      setEditPrice("");
      setEditReason("");
      qc.invalidateQueries({ queryKey: ["procurement", "catalogue"] });
    },
  });

  const vendorList = Array.isArray(vendors) ? vendors : [];

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="page-title">Supplier Catalogue</h1>
        <p className="page-subtitle">Price/rate catalogue with version history on updates. Usable when linking PR/stock items.</p>
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
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((row) => {
                const id = Number(row.id);
                const editing = editingId === id;
                return (
                  <tr key={String(row.id)} className="border-b border-neutral-50">
                    <td className="px-4 py-3">{String(row.item_name)}</td>
                    <td className="px-4 py-3">{String((row.vendor as { name?: string } | undefined)?.name ?? "")}</td>
                    <td className="px-4 py-3">{String(row.unit)}</td>
                    <td className="px-4 py-3">
                      {editing ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="number"
                            className="form-input text-sm"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                          />
                          <input
                            className="form-input text-xs"
                            placeholder="Change reason"
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                          />
                        </div>
                      ) : (
                        <>
                          {String(row.unit_price)} {String(row.currency ?? "NAD")}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editing ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-primary text-xs"
                            disabled={!editPrice || updateMut.isPending}
                            onClick={() => updateMut.mutate()}
                          >
                            Save
                          </button>
                          <button type="button" className="btn-secondary text-xs" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => {
                            setEditingId(id);
                            setEditPrice(String(row.unit_price ?? ""));
                            setEditReason("");
                          }}
                        >
                          Edit price
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(data ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-400">No catalogue items.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
