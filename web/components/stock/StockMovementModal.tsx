"use client";

import { useState } from "react";
import { stockTransactionsApi, type StockItem, type StockReasonCode } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type MovementType = "in" | "out" | "adjustment";

const TYPE_OPTIONS: { value: MovementType; label: string; help: string }[] = [
  { value: "in", label: "stock.movementModal.type.in", help: "stock.movementModal.type.inHelp" },
  { value: "out", label: "stock.movementModal.type.out", help: "stock.movementModal.type.outHelp" },
  { value: "adjustment", label: "stock.movementModal.type.adjustment", help: "stock.movementModal.type.adjustmentHelp" },
];

const REASON_OPTIONS: { value: StockReasonCode; label: string }[] = [
  { value: "receipt", label: "stock.movementModal.reason.receipt" },
  { value: "issue", label: "stock.movementModal.reason.issue" },
  { value: "shortage", label: "stock.movementModal.reason.shortage" },
  { value: "damaged", label: "stock.movementModal.reason.damaged" },
  { value: "expired", label: "stock.movementModal.reason.expired" },
  { value: "stocktake", label: "stock.movementModal.reason.stocktake" },
  { value: "other", label: "stock.movementModal.reason.other" },
];

interface ApiError {
  response?: { data?: { message?: string; errors?: Record<string, string[]> } };
}

function errorMessage(err: unknown, fallback: string): string {
  const e = err as ApiError;
  const errors = e?.response?.data?.errors;
  if (errors) {
    const first = Object.values(errors)[0];
    if (first?.[0]) return first[0];
  }
  return e?.response?.data?.message || fallback;
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
  const { t } = useI18n();
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
  const typeMeta = TYPE_OPTIONS.find((o) => o.value === type)!;

  const handleSave = async () => {
    const qty = Number(quantity);
    if (!itemId) { setError(t("stock.movementModal.err.selectItem")); return; }
    if (!quantity || Number.isNaN(qty)) { setError(t("stock.movementModal.err.quantity")); return; }
    if (type !== "adjustment" && qty < 1) { setError(t("stock.movementModal.err.minQuantity")); return; }
    if (type === "adjustment" && qty === 0) { setError(t("stock.movementModal.err.zeroAdjustment")); return; }

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
      toast("success", t("stock.movementModal.recorded"));
      onSaved();
    } catch (err: unknown) {
      const msg = errorMessage(err, t("stock.movementModal.err.failed"));
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
              <h3 className="font-semibold text-neutral-900 text-sm">{t("stock.movementModal.title")}</h3>
              {selectedItem && (
                <p className="text-xs text-neutral-400">
                  {t("stock.movementModal.onHand", { code: selectedItem.item_code, name: selectedItem.name, balance: selectedItem.current_balance })}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600" aria-label={t("common.close")}>
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
              <label htmlFor="stock-move-item" className="block text-xs font-semibold text-neutral-700 mb-1">{t("stock.movementModal.item")}</label>
              <select id="stock-move-item" className="form-input" value={itemId} onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">{t("stock.movementModal.selectItem")}</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{t("stock.movementModal.itemOption", { code: i.item_code, name: i.name, balance: i.current_balance })}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="stock-move-type" className="block text-xs font-semibold text-neutral-700 mb-1">{t("stock.movementModal.movementType")}</label>
            <select id="stock-move-type" className="form-input" value={type} onChange={(e) => setType(e.target.value as MovementType)}>
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
            </select>
            <p className="text-xs text-neutral-400 mt-1">{t(typeMeta.help)}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="stock-move-qty" className="block text-xs font-semibold text-neutral-700 mb-1">{t("stock.movementModal.quantity")}</label>
              <input
                id="stock-move-qty"
                type="number"
                className="form-input"
                placeholder={type === "adjustment" ? t("stock.movementModal.qtyAdjustPlaceholder") : t("stock.movementModal.qtyPlaceholder")}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="stock-move-date" className="block text-xs font-semibold text-neutral-700 mb-1">{t("stock.movementModal.date")}</label>
              <input id="stock-move-date" type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {type === "out" && (
            <div>
              <label htmlFor="stock-move-issued-to" className="block text-xs font-semibold text-neutral-700 mb-1">{t("stock.movementModal.issuedTo")}</label>
              <input
                id="stock-move-issued-to"
                className="form-input"
                placeholder={t("stock.movementModal.issuedToPlaceholder")}
                value={issuedTo}
                onChange={(e) => setIssuedTo(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="stock-move-reference" className="block text-xs font-semibold text-neutral-700 mb-1">{t("stock.movementModal.reference")}</label>
              <input id="stock-move-reference" className="form-input" placeholder={t("stock.movementModal.referencePlaceholder")} value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div>
              <label htmlFor="stock-move-reason-code" className="block text-xs font-semibold text-neutral-700 mb-1">{t("stock.movementModal.reasonCode")}</label>
              <select id="stock-move-reason-code" className="form-input" value={reasonCode} onChange={(e) => setReasonCode(e.target.value as StockReasonCode | "")}>
                <option value="">{t("stock.movementModal.optional")}</option>
                {REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{t(r.label)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="stock-move-reason" className="block text-xs font-semibold text-neutral-700 mb-1">{t("stock.movementModal.reasonNote")}</label>
            <input id="stock-move-reason" className="form-input" placeholder={t("stock.movementModal.reasonPlaceholder")} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100">
          <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">save</span>
            {saving ? t("stock.movementModal.saving") : t("stock.movementModal.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
