"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { catalogueApi, vendorsApi } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function CataloguePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const [vendorId, setVendorId] = useState("");
  const [itemName, setItemName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editReason, setEditReason] = useState("");

  const { data: vendors } = useQuery({
    queryKey: ["vendors", "catalogue"],
    queryFn: () => vendorsApi.list({ per_page: 100 }).then((r) => r.data.data ?? []),
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
      toast.success(t("procurement.catalogue.added"));
    },
    onError: (err: unknown) => {
      toast.error(t("procurement.catalogue.notAdded"), apiErrorMessage(err, t("procurement.catalogue.addFailed")));
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
      toast.success(t("procurement.catalogue.priceUpdated"));
    },
    onError: (err: unknown) => {
      toast.error(t("procurement.catalogue.priceNotUpdated"), apiErrorMessage(err, t("procurement.catalogue.priceUpdateFailed")));
    },
  });

  const vendorList = Array.isArray(vendors) ? vendors : [];

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("procurement.catalogue.title")}
        subtitle={t("procurement.catalogue.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("procurement.catalogue.title") }]} />}
      />

      <div className="card p-4 grid gap-3 sm:grid-cols-4 items-end">
        <div>
          <label htmlFor="procurement-catalogue-vendor" className="block text-xs font-semibold mb-1">{t("procurement.col.vendor")}</label>
          <select id="procurement-catalogue-vendor" className="form-input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">{t("procurement.select")}</option>
            {vendorList.map((v: { id: number; name: string }) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="procurement-catalogue-item" className="block text-xs font-semibold mb-1">{t("procurement.col.item")}</label>
          <input id="procurement-catalogue-item" className="form-input" value={itemName} onChange={(e) => setItemName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="procurement-catalogue-unit-price" className="block text-xs font-semibold mb-1">{t("procurement.col.unitPrice")}</label>
          <input id="procurement-catalogue-unit-price" type="number" className="form-input" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={!vendorId || !itemName || !unitPrice || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {t("common.add")}
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-neutral-400">{t("common.loading")}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500 border-b">
                <th className="px-4 py-3">{t("procurement.col.item")}</th>
                <th className="px-4 py-3">{t("procurement.col.vendor")}</th>
                <th className="px-4 py-3">{t("procurement.col.unit")}</th>
                <th className="px-4 py-3">{t("procurement.col.price")}</th>
                <th className="px-4 py-3">{t("procurement.col.actions")}</th>
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
                            placeholder={t("procurement.catalogue.changeReason")}
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
                            {t("common.save")}
                          </button>
                          <button type="button" className="btn-secondary text-xs" onClick={() => setEditingId(null)}>
                            {t("common.cancel")}
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
                          {t("procurement.catalogue.editPrice")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(data ?? []).length === 0 && (
                <TableEmpty colSpan={5} title={t("procurement.catalogue.empty")} />
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
