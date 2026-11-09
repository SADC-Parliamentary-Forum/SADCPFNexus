"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { stockEventPacksApi, stockItemsApi } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type PackLine = { stock_item_id: string; quantity: string };

export default function StockEventPacksPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
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
      setMsg(t("stock.eventPacks.saved"));
      qc.invalidateQueries({ queryKey: ["stock", "event-packs"] });
      toast.success(t("stock.eventPacks.savedToast"));
    },
    onError: (err: unknown) => {
      toast.error(t("stock.eventPacks.notSaved"), apiErrorMessage(err, t("stock.eventPacks.saveFailed")));
    },
  });

  const instantiate = useMutation({
    mutationFn: (id: number) => stockEventPacksApi.instantiate(id, { purpose: name }),
    onSuccess: () => {
      setMsg(t("stock.eventPacks.instantiated"));
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success(t("stock.eventPacks.instantiatedToast"));
    },
    onError: (err: unknown) => {
      toast.error(t("stock.eventPacks.instantiateNotCreated"), apiErrorMessage(err, t("stock.eventPacks.instantiateFailed")));
    },
  });

  const duplicate = useMutation({
    mutationFn: (id: number) => stockEventPacksApi.duplicate(id),
    onSuccess: () => {
      setMsg(t("stock.eventPacks.copied"));
      qc.invalidateQueries({ queryKey: ["stock", "event-packs"] });
      toast.success(t("stock.eventPacks.copiedToast"));
    },
    onError: (err: unknown) => {
      toast.error(t("stock.eventPacks.notCopied"), apiErrorMessage(err, t("stock.eventPacks.copyFailed")));
    },
  });

  const addFromBarcode = useMutation({
    mutationFn: () => stockEventPacksApi.barcodeLookup([barcode.trim()]),
    onSuccess: (res) => {
      const matched = res.data.data.matched[0];
      if (!matched) {
        setMsg(t("stock.eventPacks.barcodeNotFound", { barcode }));
        return;
      }
      setLines((prev) => [...prev, { stock_item_id: String(matched.id), quantity: "1" }]);
      setBarcode("");
      setMsg(t("stock.eventPacks.barcodeAdded", { name: String(matched.name) }));
    },
  });

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("stock.eventPacks.title")}
        subtitle={t("stock.eventPacks.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.common.stock"), href: "/stock" }, { label: t("stock.eventPacks.title") }]} />}
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
        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("stock.eventPacks.namePlaceholder")} />
        {lines.map((line, index) => (
          <div key={`${index}-${line.stock_item_id}`} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
            <select
              className="form-input"
              value={line.stock_item_id}
              required={index === 0}
              onChange={(e) => setLines((prev) => prev.map((row, i) => (i === index ? { ...row, stock_item_id: e.target.value } : row)))}
            >
              <option value="">{t("stock.eventPacks.selectItem")}</option>
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
              {t("stock.eventPacks.remove")}
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={() => setLines((prev) => [...prev, { stock_item_id: "", quantity: "1" }])}>
            {t("stock.eventPacks.addLine")}
          </button>
          <button type="submit" className="btn-primary" disabled={create.isPending}>{t("stock.eventPacks.save")}</button>
        </div>
        <div className="flex flex-wrap gap-2" data-testid="event-pack-barcode-add">
          <input className="form-input flex-1" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder={t("stock.eventPacks.barcodePlaceholder")} />
          <button type="button" className="btn-secondary text-sm" disabled={!barcode.trim() || addFromBarcode.isPending} onClick={() => addFromBarcode.mutate()}>
            {t("stock.eventPacks.addFromBarcode")}
          </button>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-2">{t("stock.common.pack")}</th><th className="p-2">{t("stock.common.lines")}</th><th className="p-2">{t("stock.common.action")}</th></tr></thead>
          <tbody>
            {(packs.data ?? []).map((pack) => (
              <tr key={String(pack.id)} className="border-t border-neutral-200">
                <td className="p-2">{String(pack.name)}</td>
                <td className="p-2">{Array.isArray(pack.lines) ? pack.lines.length : 0}</td>
                <td className="p-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={() => instantiate.mutate(Number(pack.id))}>
                    {t("stock.eventPacks.createDraft")}
                  </button>
                  <button type="button" className="btn-secondary text-sm" onClick={() => duplicate.mutate(Number(pack.id))}>
                    {t("stock.eventPacks.duplicate")}
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
