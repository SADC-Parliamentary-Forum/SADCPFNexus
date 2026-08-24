"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { stockEventPacksApi, stockItemsApi } from "@/lib/api";

type PackLine = { stock_item_id: string; quantity: string };

export default function StockEventPacksPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("Plenary welcome pack");
  const [lines, setLines] = useState<PackLine[]>([{ stock_item_id: "", quantity: "10" }]);
  const [barcode, setBarcode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const packs = useQuery({
    queryKey: ["stock", "event-packs"],
    queryFn: () => stockEventPacksApi.list().then((r) => r.data.data ?? []),
  });
  const items = useQuery({
    queryKey: ["stock", "items"],
    queryFn: () => stockItemsApi.list({ per_page: 100 }).then((r) => r.data.data ?? []),
  });

  const create = useMutation({
    mutationFn: () =>
      stockEventPacksApi.create({
        name,
        event_type: "plenary",
        lines: lines
          .filter((line) => Number(line.stock_item_id) > 0)
          .map((line) => ({ stock_item_id: Number(line.stock_item_id), quantity: Number(line.quantity) || 1 })),
      }),
    onSuccess: () => {
      setMsg("Pack saved. Instantiate creates a draft request only.");
      qc.invalidateQueries({ queryKey: ["stock", "event-packs"] });
    },
  });

  const instantiate = useMutation({
    mutationFn: (id: number) => stockEventPacksApi.instantiate(id, { purpose: name }),
    onSuccess: () => {
      setMsg("Draft stock request created. Nothing was issued.");
      qc.invalidateQueries({ queryKey: ["stock"] });
    },
  });

  const duplicate = useMutation({
    mutationFn: (id: number) => stockEventPacksApi.duplicate(id),
    onSuccess: () => {
      setMsg("Pack copied. Instantiate still drafts a request only.");
      qc.invalidateQueries({ queryKey: ["stock", "event-packs"] });
    },
  });

  const addFromBarcode = useMutation({
    mutationFn: () => stockEventPacksApi.barcodeLookup([barcode.trim()]),
    onSuccess: (res) => {
      const matched = res.data.data.matched[0];
      if (!matched) {
        setMsg(`No stock item for barcode ${barcode}.`);
        return;
      }
      setLines((prev) => [...prev, { stock_item_id: String(matched.id), quantity: "1" }]);
      setBarcode("");
      setMsg(`Added ${String(matched.name)} from barcode. Pack is not issued.`);
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Event packs"
        subtitle="Reusable kits of consumables. Instantiating a pack drafts a stock request — it never auto-issues stock."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Stock", href: "/stock" }, { label: "Event packs" }]} />}
      />
      {msg && <p className="text-sm text-green-700">{msg}</p>}

      <form
        className="card grid gap-3 p-4"
        data-testid="stock-event-pack-form"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pack name" />
        {lines.map((line, index) => (
          <div key={`${index}-${line.stock_item_id}`} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
            <select
              className="form-input"
              value={line.stock_item_id}
              required={index === 0}
              onChange={(e) => setLines((prev) => prev.map((row, i) => (i === index ? { ...row, stock_item_id: e.target.value } : row)))}
            >
              <option value="">Select item</option>
              {(items.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <input
              className="form-input"
              type="number"
              min="1"
              value={line.quantity}
              onChange={(e) => setLines((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: e.target.value } : row)))}
            />
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)))}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={() => setLines((prev) => [...prev, { stock_item_id: "", quantity: "1" }])}>
            Add line
          </button>
          <button type="submit" className="btn-primary" disabled={create.isPending}>Save pack</button>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="event-pack-barcode-add">
          <input className="form-input flex-1" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Add line by barcode" />
          <button type="button" className="btn-secondary text-sm" disabled={!barcode.trim() || addFromBarcode.isPending} onClick={() => addFromBarcode.mutate()}>
            Add from barcode
          </button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-2">Pack</th><th className="p-2">Lines</th><th className="p-2">Action</th></tr></thead>
          <tbody>
            {(packs.data ?? []).map((pack) => (
              <tr key={String(pack.id)} className="border-t border-neutral-200">
                <td className="p-2">{String(pack.name)}</td>
                <td className="p-2">{Array.isArray(pack.lines) ? pack.lines.length : 0}</td>
                <td className="p-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={() => instantiate.mutate(Number(pack.id))}>
                    Create draft request
                  </button>
                  <button type="button" className="btn-secondary text-sm" onClick={() => duplicate.mutate(Number(pack.id))}>
                    Duplicate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
