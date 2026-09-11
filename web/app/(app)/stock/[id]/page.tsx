"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { stockItemsApi, type StockItem } from "@/lib/api";
import { canIssueStock, canManageStock, getStoredUser } from "@/lib/auth";
import { StockMovementModal } from "@/components/stock/StockMovementModal";
import { StockItemFormModal } from "@/components/stock/StockItemFormModal";
import { stockCategoriesApi, type StockCategory } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

export default function StockItemDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [item, setItem] = useState<StockItem | null>(null);
  const [categories, setCategories] = useState<StockCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showMovement, setShowMovement] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [canIssue, setCanIssue] = useState(false);
  const [canManage, setCanManage] = useState(false);

  const load = () => {
    stockItemsApi.get(id)
      .then((res) => setItem(res.data.data))
      .catch(() => setError("Failed to load stock item."));
  };

  useEffect(() => {
    const user = getStoredUser();
    setCanIssue(canIssueStock(user));
    setCanManage(canManageStock(user));
    load();
    stockCategoriesApi.list().then((r) => setCategories(r.data.data ?? [])).catch(() => {});
  }, [id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!item) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={item.name}
        subtitle={`Balance ${item.current_balance} ${item.unit ?? ""} · Reorder ${item.reorder_level}${item.is_low_stock ? " · Low stock" : ""}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.stock", href: "/stock" },
              { label: item.item_code || item.name },
            ]}
          />
        }
        actions={
          <>
            <Link href="/stock" className="btn-secondary">Register</Link>
            {canManage && (
              <button type="button" className="btn-secondary" onClick={() => setShowEdit(true)}>Edit</button>
            )}
            {canIssue && (
              <button type="button" className="btn-primary" onClick={() => setShowMovement(true)}>Record movement</button>
            )}
          </>
        }
      />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Category</p>
          <p className="font-medium">{item.category?.name ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Location</p>
          <p className="font-medium">{item.location?.name ?? item.storage_location ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">Unit / value</p>
          <p className="font-medium">
            {item.unit_of_measure?.name ?? item.unit ?? "—"} · {item.stock_value != null ? Number(item.stock_value).toFixed(2) : "—"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 font-semibold text-sm">Issue / movement history</div>
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Reason</th>
              <th className="px-4 py-2">Issued to</th>
              <th className="px-4 py-2">Balance after</th>
            </tr>
          </thead>
          <tbody>
            {(item.transactions ?? []).map((t) => (
              <tr key={t.id} className="border-t border-neutral-100">
                <td className="px-4 py-2">{formatDateShort(t.transaction_date)}</td>
                <td className="px-4 py-2 capitalize">{t.type}</td>
                <td className="px-4 py-2">{t.quantity}</td>
                <td className="px-4 py-2">{t.reason_code ?? t.reason ?? "—"}</td>
                <td className="px-4 py-2">
                  {t.issued_to_user?.name ?? t.issued_to_department?.name ?? t.issued_to_other ?? "—"}
                </td>
                <td className="px-4 py-2">{t.balance_after}</td>
              </tr>
            ))}
            {(item.transactions ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-neutral-500 text-center">No movements yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showMovement && (
        <StockMovementModal
          items={[item]}
          presetItem={item}
          onClose={() => setShowMovement(false)}
          onSaved={() => { setShowMovement(false); load(); }}
        />
      )}
      {showEdit && (
        <StockItemFormModal
          categories={categories}
          item={item}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}
    </div>
  );
}
