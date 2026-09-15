"use client";

import Link from "next/link";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import api, { assetLifecycleApi, assetMetaApi } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Policy = {
  id: number;
  version: string;
  threshold_amount: number;
  threshold_currency: string;
  effective_from: string;
  is_active: boolean;
};

type Location = { id: number; code: string; name: string; building?: string | null };

export default function AssetSettingsPage() {
  const { t } = useI18n();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [recovery, setRecovery] = useState({
    primary_phone: "",
    whatsapp: "",
    email: "",
    return_address: "",
    office_hours: "",
    instructions: "",
    reason: "",
    show_primary_phone: true,
    show_email: true,
    show_whatsapp: true,
  });
  const [recoveryMsg, setRecoveryMsg] = useState("");
  const [recoveryErr, setRecoveryErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ data: Policy[] }>("/assets-meta/capitalisation-policies")
      .then((r) => setPolicies(r.data.data ?? []))
      .catch(() => setPolicies([]));
    api.get<{ data: Location[] }>("/assets-meta/locations")
      .then((r) => setLocations(r.data.data ?? []))
      .catch(() => setLocations([]));
    assetLifecycleApi.recoveryContact()
      .then((r) => {
        const row = (r.data.data ?? {}) as Record<string, unknown>;
        setRecovery((prev) => ({
          ...prev,
          primary_phone: String(row.primary_phone ?? ""),
          whatsapp: String(row.whatsapp ?? ""),
          email: String(row.email ?? ""),
          return_address: String(row.return_address ?? ""),
          office_hours: String(row.office_hours ?? ""),
          instructions: String(row.instructions ?? ""),
          show_primary_phone: row.show_primary_phone !== false,
          show_email: row.show_email !== false,
          show_whatsapp: row.show_whatsapp !== false,
        }));
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="page-header">
        <ModulePageHeader
        title="Asset Settings"
        subtitle="Versioned capitalisation policy and structured locations"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Asset Settings" }]} />}
      />
      </div>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-semibold">{t("assets.settings.recoveryTitle")}</h2>
        <p className="text-sm text-neutral-600">{t("assets.settings.recoverySubtitle")}</p>
        {recoveryMsg && <p className="text-sm text-emerald-700">{recoveryMsg}</p>}
        {recoveryErr && <p role="alert" className="text-sm text-red-700">{recoveryErr}</p>}
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setRecoveryErr("");
            setRecoveryMsg("");
            try {
              await assetLifecycleApi.updateRecoveryContact(recovery);
              setRecoveryMsg(t("assets.settings.recoverySaved"));
            } catch {
              setRecoveryErr(t("assets.settings.recoveryFailed"));
            } finally {
              setSaving(false);
            }
          }}
        >
          <label className="text-sm">{t("assets.settings.recoveryPhone")}
            <input className="form-input mt-1" required value={recovery.primary_phone} onChange={(e) => setRecovery({ ...recovery, primary_phone: e.target.value })} />
          </label>
          <label className="text-sm">{t("assets.settings.recoveryWhatsapp")}
            <input className="form-input mt-1" value={recovery.whatsapp} onChange={(e) => setRecovery({ ...recovery, whatsapp: e.target.value })} />
          </label>
          <label className="text-sm">{t("assets.settings.recoveryEmail")}
            <input className="form-input mt-1" type="email" value={recovery.email} onChange={(e) => setRecovery({ ...recovery, email: e.target.value })} />
          </label>
          <label className="text-sm">{t("assets.settings.recoveryHours")}
            <input className="form-input mt-1" value={recovery.office_hours} onChange={(e) => setRecovery({ ...recovery, office_hours: e.target.value })} />
          </label>
          <label className="text-sm sm:col-span-2">{t("assets.settings.recoveryAddress")}
            <input className="form-input mt-1" value={recovery.return_address} onChange={(e) => setRecovery({ ...recovery, return_address: e.target.value })} />
          </label>
          <label className="text-sm sm:col-span-2">{t("assets.settings.recoveryInstructions")}
            <textarea className="form-input mt-1" rows={3} value={recovery.instructions} onChange={(e) => setRecovery({ ...recovery, instructions: e.target.value })} />
          </label>
          <label className="text-sm sm:col-span-2">{t("assets.settings.recoveryReason")}
            <input className="form-input mt-1" value={recovery.reason} onChange={(e) => setRecovery({ ...recovery, reason: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={recovery.show_primary_phone} onChange={(e) => setRecovery({ ...recovery, show_primary_phone: e.target.checked })} />
            {t("assets.settings.showPhone")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={recovery.show_email} onChange={(e) => setRecovery({ ...recovery, show_email: e.target.checked })} />
            {t("assets.settings.showEmail")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={recovery.show_whatsapp} onChange={(e) => setRecovery({ ...recovery, show_whatsapp: e.target.checked })} />
            {t("assets.settings.showWhatsapp")}
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? t("common.loading") : t("common.save")}</button>
          </div>
        </form>
      </section>

      <section className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Categories and labels</h2>
        <p className="text-muted">Add and edit asset classes, then print Avery or thermal QR labels.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/assets/categories" className="btn-secondary">Categories</Link>
          <Link href="/assets/labels" className="btn-secondary">Print labels</Link>
          <Link href="/assets/labels/templates" className="btn-secondary">Label templates</Link>
        </div>
      </section>

      <section className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Capitalisation policies</h2>
        <p className="text-muted">Threshold is not hard-coded — historical assets keep the policy at acquisition.</p>
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>Version</th><th>Threshold</th><th>Effective from</th><th>Active</th></tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id}>
                <td>{p.version}</td>
                <td>{p.threshold_currency} {Number(p.threshold_amount).toFixed(2)}</td>
                <td>{p.effective_from}</td>
                <td>{p.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {policies.length === 0 && <TableEmpty colSpan={4} title="No policies — default USD 250 is created on first capitalisation." />}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ padding: "1rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>{t("assets.settings.locationsTitle")}</h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const code = (form.elements.namedItem("code") as HTMLInputElement).value;
            const name = (form.elements.namedItem("name") as HTMLInputElement).value;
            await assetMetaApi.createLocation({ code, name, location_type: "room", is_active: true });
            const r = await assetMetaApi.locations();
            setLocations(r.data.data ?? []);
            form.reset();
          }}
        >
          <input name="code" className="form-input" placeholder="Code" required />
          <input name="name" className="form-input" placeholder="Name" required />
          <button type="submit" className="btn-secondary">{t("common.save")}</button>
        </form>
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>Code</th><th>Name</th><th>Building</th></tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>{l.code}</td>
                <td>{l.name}</td>
                <td>{l.building ?? "—"}</td>
              </tr>
            ))}
            {locations.length === 0 && <TableEmpty colSpan={3} title="No locations configured." />}
          </tbody>
        </table>
      </section>
    </div>
  );
}
