"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { assetsApi, assetMovementsApi, type Asset, type TenantUserOption } from "@/lib/api";
import { AssetAssigneePicker } from "@/components/assets/AssetAssigneePicker";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const MOVEMENT_TYPES = [
  { id: "assign", labelKey: "assets.movement.type.assign", descKey: "assets.movement.desc.assign", icon: "person_add", color: "text-blue-700 bg-blue-50 border-blue-200", activeColor: "bg-blue-600 text-white border-blue-600" },
  { id: "transfer", labelKey: "assets.movement.type.transfer", descKey: "assets.movement.desc.transfer", icon: "swap_horiz", color: "text-blue-700 bg-blue-50 border-blue-200", activeColor: "bg-blue-600 text-white border-blue-600" },
  { id: "return", labelKey: "assets.movement.type.return", descKey: "assets.movement.desc.return", icon: "undo", color: "text-green-700 bg-green-50 border-green-200", activeColor: "bg-green-600 text-white border-green-600" },
  { id: "move", labelKey: "assets.movement.type.move", descKey: "assets.movement.desc.move", icon: "inventory_2", color: "text-neutral-700 bg-neutral-50 border-neutral-200", activeColor: "bg-neutral-600 text-white border-neutral-600" },
  { id: "check_out", labelKey: "assets.movement.type.check_out", descKey: "assets.movement.desc.check_out", icon: "logout", color: "text-amber-700 bg-amber-50 border-amber-200", activeColor: "bg-amber-500 text-white border-amber-500" },
  { id: "check_in", labelKey: "assets.movement.type.check_in", descKey: "assets.movement.desc.check_in", icon: "login", color: "text-green-700 bg-green-50 border-green-200", activeColor: "bg-green-600 text-white border-green-600" },
  { id: "send_for_repair", labelKey: "assets.movement.type.send_for_repair", descKey: "assets.movement.desc.send_for_repair", icon: "build", color: "text-amber-700 bg-amber-50 border-amber-200", activeColor: "bg-amber-500 text-white border-amber-500" },
  { id: "return_from_repair", labelKey: "assets.movement.type.return_from_repair", descKey: "assets.movement.desc.return_from_repair", icon: "home_repair_service", color: "text-green-700 bg-green-50 border-green-200", activeColor: "bg-green-600 text-white border-green-600" },
  { id: "mark_missing", labelKey: "assets.movement.type.mark_missing", descKey: "assets.movement.desc.mark_missing", icon: "help", color: "text-red-700 bg-red-50 border-red-200", activeColor: "bg-red-600 text-white border-red-600" },
  { id: "recover", labelKey: "assets.movement.type.recover", descKey: "assets.movement.desc.recover", icon: "restore", color: "text-green-700 bg-green-50 border-green-200", activeColor: "bg-green-600 text-white border-green-600" },
  { id: "dispose", labelKey: "assets.movement.type.dispose", descKey: "assets.movement.desc.dispose", icon: "delete_forever", color: "text-red-700 bg-red-50 border-red-200", activeColor: "bg-red-600 text-white border-red-600" },
  { id: "write_off", labelKey: "assets.movement.type.write_off", descKey: "assets.movement.desc.write_off", icon: "money_off", color: "text-red-700 bg-red-50 border-red-200", activeColor: "bg-red-600 text-white border-red-600" },
] as const;

function AssetSearch({ value, onSelect }: { value: Asset | null; onSelect: (a: Asset | null) => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState(value ? `${value.asset_code} — ${value.name}` : "");
  const [options, setOptions] = useState<Asset[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || (value && query.includes(value.asset_code))) { setOptions([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await assetsApi.list({ search: query, per_page: 8 });
        setOptions(r.data.data ?? []);
        setOpen(true);
      } catch { setOptions([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <label htmlFor="assets-movement-new-asset" className="block text-xs font-semibold text-neutral-700 mb-1">{t("assets.movement.asset")} <span className="text-red-500">*</span></label>
      <input id="assets-movement-new-asset" className="form-input" placeholder={t("assets.movement.searchAsset")} value={query}
        onChange={(e) => { setQuery(e.target.value); onSelect(null); }} autoComplete="off" />
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
          {options.map((a) => (
            <button key={a.id} type="button"
              className="w-full px-3 py-2.5 text-left hover:bg-neutral-50 flex items-center gap-3"
              onMouseDown={() => { onSelect(a); setQuery(`${a.asset_code} — ${a.name}`); setOpen(false); }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-[16px]">devices</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{a.asset_code} — {a.name}</p>
                <p className="text-xs text-neutral-400">{a.category} · {a.status}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewAssetMovementPageContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preloadAssetId = searchParams.get("asset_id");

  const [asset, setAsset] = useState<Asset | null>(null);
  const [movementType, setMovementType] = useState<(typeof MOVEMENT_TYPES)[number]["id"]>("transfer");
  const [fromUser, setFromUser] = useState<TenantUserOption | null>(null);
  const [toUser, setToUser] = useState<TenantUserOption | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [movementDate, setMovementDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-load asset from query param
  useEffect(() => {
    if (!preloadAssetId) return;
    assetsApi.get(parseInt(preloadAssetId)).then((r) => setAsset(r.data)).catch(() => {});
  }, [preloadAssetId]);

  const needsToUser = ["transfer", "assign"].includes(movementType);
  const canSubmit = asset && movementDate && (!needsToUser || toUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;
    setSubmitting(true);
    setError(null);
    try {
      await assetMovementsApi.create({
        asset_id: asset.id,
        from_user_id: fromUser?.id,
        to_user_id: toUser?.id,
        movement_type: movementType,
        reason: reason || undefined,
        notes: notes || undefined,
        movement_date: movementDate,
      });
      router.push("/assets");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string };
      const msg = Object.values(ax.response?.data?.errors ?? {}).flat()[0] ?? ax.response?.data?.message ?? t("common.error");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = MOVEMENT_TYPES.find((t) => t.id === movementType)!;

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/assets" className="text-neutral-400 hover:text-neutral-600 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <ModulePageHeader
        title={t("assets.movement.title")}
        subtitle={t("assets.movement.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.movement.title") }]} />}
      />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Movement type */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">moving</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">{t("assets.movement.typeHeading")}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {MOVEMENT_TYPES.map((kind) => (
              <button key={kind.id} type="button" onClick={() => setMovementType(kind.id)}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${movementType === kind.id ? kind.activeColor : "bg-white border-neutral-200 hover:border-neutral-300"}`}>
                <span className={`material-symbols-outlined text-[20px] mt-0.5 ${movementType === kind.id ? "" : kind.color.split(" ")[0]}`}>{kind.icon}</span>
                <div>
                  <p className="text-sm font-semibold">{t(kind.labelKey)}</p>
                  <p className={`text-xs mt-0.5 ${movementType === kind.id ? "opacity-80" : "text-neutral-500"}`}>{t(kind.descKey)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Asset & parties */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${selectedType.color.split(" ").slice(1).join(" ")}`}>
              <span className={`material-symbols-outlined text-[18px] ${selectedType.color.split(" ")[0]}`}>{selectedType.icon}</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">{t("assets.movement.details")}</h3>
          </div>

          <AssetSearch value={asset} onSelect={setAsset} />

          {asset && (
            <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
              <span className="material-symbols-outlined text-primary text-[20px]">devices</span>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{asset.name}</p>
                <p className="text-xs text-neutral-500">{asset.asset_code} · {asset.category} · {asset.status}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AssetAssigneePicker id="assets-movement-from-user" label={t("assets.movement.fromUser")} value={fromUser} onSelect={setFromUser} />
            {needsToUser && <AssetAssigneePicker id="assets-movement-to-user" label={t("assets.movement.toUser")} value={toUser} onSelect={setToUser} required />}
          </div>

          <div>
            <label htmlFor="assets-movement-new-movement-date" className="block text-xs font-semibold text-neutral-700 mb-1">{t("assets.movement.date")} <span className="text-red-500">*</span></label>
            <input id="assets-movement-new-movement-date" type="date" className="form-input" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
          </div>

          <div>
            <label htmlFor="assets-movement-new-reason" className="block text-xs font-semibold text-neutral-700 mb-1">{t("assets.movement.reason")}</label>
            <input id="assets-movement-new-reason" className="form-input" placeholder={t("assets.movement.reasonHint")} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <div>
            <label htmlFor="assets-movement-new-notes" className="block text-xs font-semibold text-neutral-700 mb-1">{t("assets.movement.notes")}</label>
            <textarea id="assets-movement-new-notes" rows={3} className="form-input resize-none" placeholder={t("assets.movement.notesHint")} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex justify-between">
          <Link href="/assets" className="btn-secondary px-5 py-2.5 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">close</span>
            {t("common.cancel")}
          </Link>
          <button type="submit" disabled={!canSubmit || submitting}
            className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">save</span>
            {submitting ? t("common.loading") : t("assets.movement.submit")}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewAssetMovementPage() {
  return (
    <Suspense fallback={<div className="w-full min-w-0 card p-6 text-sm text-neutral-500">…</div>}>
      <NewAssetMovementPageContent />
    </Suspense>
  );
}
