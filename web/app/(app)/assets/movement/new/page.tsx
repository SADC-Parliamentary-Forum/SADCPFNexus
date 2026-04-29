"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { assetsApi, assetMovementsApi, tenantUsersApi, type Asset, type TenantUserOption } from "@/lib/api";

const MOVEMENT_TYPES = [
  { id: "transfer",    label: "Transfer",    icon: "swap_horiz",        color: "text-blue-700 bg-blue-50 border-blue-200",    activeColor: "bg-blue-600 text-white border-blue-600",    desc: "Assign the asset to a different staff member." },
  { id: "maintenance", label: "Maintenance", icon: "build",             color: "text-amber-700 bg-amber-50 border-amber-200",  activeColor: "bg-amber-500 text-white border-amber-500", desc: "Send the asset for servicing or repair." },
  { id: "storage",     label: "Storage",     icon: "inventory_2",       color: "text-neutral-700 bg-neutral-50 border-neutral-200", activeColor: "bg-neutral-600 text-white border-neutral-600", desc: "Move the asset into storage or a storeroom." },
  { id: "return",      label: "Return",      icon: "undo",              color: "text-green-700 bg-green-50 border-green-200",  activeColor: "bg-green-600 text-white border-green-600",  desc: "Return the asset to the asset register pool." },
  { id: "disposal",    label: "Disposal",    icon: "delete_forever",    color: "text-red-700 bg-red-50 border-red-200",        activeColor: "bg-red-600 text-white border-red-600",      desc: "Record the asset as disposed, written-off, or donated." },
];

function AssetSearch({ value, onSelect }: { value: Asset | null; onSelect: (a: Asset | null) => void }) {
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
      <label className="block text-xs font-semibold text-neutral-700 mb-1">Asset <span className="text-red-500">*</span></label>
      <input className="form-input" placeholder="Search by code or name…" value={query}
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

function UserSearch({ label, value, onSelect, required }: { label: string; value: TenantUserOption | null; onSelect: (u: TenantUserOption | null) => void; required?: boolean }) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [options, setOptions] = useState<TenantUserOption[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || (value && query === value.name)) { setOptions([]); return; }
    const t = setTimeout(async () => {
      try { const r = await tenantUsersApi.list({ search: query }); setOptions(r.data.data ?? []); setOpen(true); } catch { setOptions([]); }
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
      <label className="block text-xs font-semibold text-neutral-700 mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input className="form-input" placeholder="Search by name or email…" value={query}
        onChange={(e) => { setQuery(e.target.value); onSelect(null); }} autoComplete="off" />
      {open && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden">
          {options.slice(0, 6).map((u) => (
            <button key={u.id} type="button"
              className="w-full px-3 py-2.5 text-left hover:bg-neutral-50 flex items-center gap-2"
              onMouseDown={() => { onSelect(u); setQuery(u.name); setOpen(false); }}>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">{u.name[0]}</div>
              <div>
                <p className="text-sm font-medium text-neutral-900">{u.name}</p>
                <p className="text-xs text-neutral-400">{u.job_title ?? u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewAssetMovementPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preloadAssetId = searchParams.get("asset_id");

  const [asset, setAsset] = useState<Asset | null>(null);
  const [movementType, setMovementType] = useState<"transfer" | "maintenance" | "disposal" | "storage" | "return">("transfer");
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

  const needsToUser = ["transfer"].includes(movementType);
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
      const msg = Object.values(ax.response?.data?.errors ?? {}).flat()[0] ?? ax.response?.data?.message ?? "Failed to record movement.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedType = MOVEMENT_TYPES.find((t) => t.id === movementType)!;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/assets" className="text-neutral-400 hover:text-neutral-600 transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h1 className="page-title">Record Asset Movement</h1>
          <p className="page-subtitle">Transfer, send for maintenance, or record a disposal of a managed asset.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Movement type */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">moving</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">Movement Type</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {MOVEMENT_TYPES.map((t) => (
              <button key={t.id} type="button" onClick={() => setMovementType(t.id as typeof movementType)}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${movementType === t.id ? t.activeColor : "bg-white border-neutral-200 hover:border-neutral-300"}`}>
                <span className={`material-symbols-outlined text-[20px] mt-0.5 ${movementType === t.id ? "" : t.color.split(" ")[0]}`}>{t.icon}</span>
                <div>
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className={`text-xs mt-0.5 ${movementType === t.id ? "opacity-80" : "text-neutral-500"}`}>{t.desc}</p>
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
            <h3 className="text-sm font-semibold text-neutral-900">Movement Details</h3>
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
            <UserSearch label="From (current holder)" value={fromUser} onSelect={setFromUser} />
            {needsToUser && <UserSearch label="To (new assignee)" value={toUser} onSelect={setToUser} required />}
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Movement Date <span className="text-red-500">*</span></label>
            <input type="date" className="form-input" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Reason</label>
            <input className="form-input" placeholder="e.g. Staff member changed role, asset sent for annual service…" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Notes</label>
            <textarea rows={3} className="form-input resize-none" placeholder="Additional notes for the asset register…" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
            Cancel
          </Link>
          <button type="submit" disabled={!canSubmit || submitting}
            className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40">
            <span className="material-symbols-outlined text-[18px]">save</span>
            {submitting ? "Recording…" : "Record Movement"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewAssetMovementPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto card p-6 text-sm text-neutral-500">Loading asset movement form...</div>}>
      <NewAssetMovementPageContent />
    </Suspense>
  );
}
