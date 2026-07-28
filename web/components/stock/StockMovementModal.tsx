"use client";

import { useState } from "react";
import { stockTransactionsApi, type StockItem, type StockReasonCode } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type MovementType = "in" | "out" | "adjustment";

const TYPE_OPTIONS: { value: MovementType; label: string; help: string }[] = [
  { value: "in", label: "Stock In (Receipt)", help: "Increase the balance — replenishment or receipt." },
  { value: "out", label: "Stock Out (Issue)", help: "Decrease the balance — issued to a person or department." },
  { value: "adjustment", label: "Adjustment", help: "Correct the balance (use a negative quantity to reduce)." },
];

const REASON_OPTIONS: { value: StockReasonCode; label: string }[] = [
  { value: "receipt", label: "Receipt / replenishment" },
  { value: "issue", label: "Issue to staff / dept" },
  { value: "shortage", label: "Shortage" },
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
  { value: "stocktake", label: "Stocktake variance" },
  { value: "other", label: "Other" },
];

interface ApiError {
  response?: { data?: { message?: string; errors?: Record<string, string[]> } };
}

function errorMessage(err: unknown): string {
  const e = err as ApiError;
  const errors = e?.response?.data?.errors;
  if (errors) {
    const first = Object.values(errors)[0];
    if (first?.[0]) return first[0];
  }
  return e?.response?.data?.message || "Failed to record movement.";
}

export function StockMovementModal({
  items,
  presetItem,
  onClose,
  onSaved,
}: {
  items: StockItem[];
  presetItem?: StockItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [itemId, setItemId] = useState<number | "">(presetItem?.id ?? "");
  const [type, setType] = useState<MovementType>("in");
  const [quantity, setQuantity] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [reasonCode, setReasonCode] = useState<StockReasonCode | "">("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = presetItem ?? items.find((i) => i.id === itemId) ?? null;
  const typeMeta = TYPE_OPTIONS.find((t) => t.value === type)!;

  const handleSave = async () => {
    const qty = Number(quantity);
    if (!itemId) { setError("Select a stock item."); return; }
    if (!quantity || Number.isNaN(qty)) { setError("Enter a valid quantity."); return; }
    if (type !== "adjustment" && qty < 1) { setError("Quantity must be at least 1."); return; }
    if (type === "adjustment" && qty === 0) { setError("Adjustment quantity cannot be zero."); return; }

    setSaving(true);
    setError(null);
    try {
      await stockTransactionsApi.create({
        stock_item_id: Number(itemId),
        type,
        quantity: qty,
        issued_to_other: type === "out" && issuedTo.trim() ? issuedTo.trim() : null,
        reference: reference.trim() || null,
        reason: reason.trim() || null,
        reason_code: reasonCode || null,
        transaction_date: date,
      });
      toast("success", "Stock movement recorded");
      onSaved();
    } catch (err: unknown) {
      const msg = errorMessage(err);
      setError(msg);
      toast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">swap_vert</span>
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 text-sm">Record Stock Movement</h3>
              {selectedItem && (
                <p className="text-xs text-neutral-400">
                  {selectedItem.item_code} — {selectedItem.name} (on hand: {selectedItem.current_balance})
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">error_outline</span>{error}
            </div>
          )}

          {!presetItem && (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Stock Item *</label>
              <select className="form-input" value={itemId} onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select an item…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.item_code} — {i.name} (bal: {i.current_balance})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Movement Type *</label>
            <select className="form-input" value={type} onChange={(e) => setType(e.target.value as MovementType)}>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <p className="text-xs text-neutral-400 mt-1">{typeMeta.help}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Quantity *</label>
              <input
                type="number"
                className="form-input"
                placeholder={type === "adjustment" ? "e.g. -5 or 5" : "e.g. 10"}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Date *</label>
              <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {type === "out" && (
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Issued To</label>
              <input
                className="form-input"
                placeholder="Recipient name / department"
                value={issuedTo}
                onChange={(e) => setIssuedTo(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Reference</label>
              <input className="form-input" placeholder="GRN / requisition no." value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Reason code</label>
              <select className="form-input" value={reasonCode} onChange={(e) => setReasonCode(e.target.value as StockReasonCode | "")}>
                <option value="">Optional…</option>
                {REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Reason / Note</label>
            <input className="form-input" placeholder="Optional detail" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">save</span>
            {saving ? "Saving…" : "Record Movement"}
          </button>
        </div>
      </div>
    </div>
  );
}
