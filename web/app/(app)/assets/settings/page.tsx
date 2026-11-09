"use client";

import Link from "next/link";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import api, { assetLifecycleApi, assetMetaApi } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";

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
  const toast = useToast();
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
        title="assets.settingsPage.title"
        subtitle="assets.settingsPage.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "assets.settingsPage.title" }]} />}
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
              toast.success(t("assets.settingsPage.recoverySaved"));
            } catch (err) {
              setRecoveryErr(t("assets.settings.recoveryFailed"));
              toast.error(t("assets.settingsPage.recoveryNotSaved"), apiErrorMessage(err, t("assets.settings.recoveryFailed")));
            } finally {
              setSaving(false);
            }
          }}
        >
          <label htmlFor="assets-settings-recovery-phone" className="text-sm">{t("assets.settings.recoveryPhone")}
            <input id="assets-settings-recovery-phone" className="form-input mt-1" required value={recovery.primary_phone} onChange={(e) => setRecovery({ ...recovery, primary_phone: e.target.value })} />
          </label>
          <label htmlFor="assets-settings-recovery-whatsapp" className="text-sm">{t("assets.settings.recoveryWhatsapp")}
            <input id="assets-settings-recovery-whatsapp" className="form-input mt-1" value={recovery.whatsapp} onChange={(e) => setRecovery({ ...recovery, whatsapp: e.target.value })} />
          </label>
          <label htmlFor="assets-settings-recovery-email" className="text-sm">{t("assets.settings.recoveryEmail")}
            <input id="assets-settings-recovery-email" className="form-input mt-1" type="email" value={recovery.email} onChange={(e) => setRecovery({ ...recovery, email: e.target.value })} />
          </label>
          <label htmlFor="assets-settings-recovery-hours" className="text-sm">{t("assets.settings.recoveryHours")}
            <input id="assets-settings-recovery-hours" className="form-input mt-1" value={recovery.office_hours} onChange={(e) => setRecovery({ ...recovery, office_hours: e.target.value })} />
          </label>
          <label htmlFor="assets-settings-recovery-address" className="text-sm sm:col-span-2">{t("assets.settings.recoveryAddress")}
            <input id="assets-settings-recovery-address" className="form-input mt-1" value={recovery.return_address} onChange={(e) => setRecovery({ ...recovery, return_address: e.target.value })} />
          </label>
          <label htmlFor="assets-settings-recovery-instructions" className="text-sm sm:col-span-2">{t("assets.settings.recoveryInstructions")}
            <textarea id="assets-settings-recovery-instructions" className="form-input mt-1" rows={3} value={recovery.instructions} onChange={(e) => setRecovery({ ...recovery, instructions: e.target.value })} />
          </label>
          <label htmlFor="assets-settings-recovery-reason" className="text-sm sm:col-span-2">{t("assets.settings.recoveryReason")}
            <input id="assets-settings-recovery-reason" className="form-input mt-1" value={recovery.reason} onChange={(e) => setRecovery({ ...recovery, reason: e.target.value })} />
          </label>
          <label htmlFor="assets-settings-show-phone" className="flex items-center gap-2 text-sm">
            <input id="assets-settings-show-phone" type="checkbox" checked={recovery.show_primary_phone} onChange={(e) => setRecovery({ ...recovery, show_primary_phone: e.target.checked })} />
            {t("assets.settings.showPhone")}
          </label>
          <label htmlFor="assets-settings-show-email" className="flex items-center gap-2 text-sm">
            <input id="assets-settings-show-email" type="checkbox" checked={recovery.show_email} onChange={(e) => setRecovery({ ...recovery, show_email: e.target.checked })} />
            {t("assets.settings.showEmail")}
          </label>
          <label htmlFor="assets-settings-show-whatsapp" className="flex items-center gap-2 text-sm">
            <input id="assets-settings-show-whatsapp" type="checkbox" checked={recovery.show_whatsapp} onChange={(e) => setRecovery({ ...recovery, show_whatsapp: e.target.checked })} />
            {t("assets.settings.showWhatsapp")}
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? t("common.loading") : t("common.save")}</button>
          </div>
        </form>
      </section>

      <section className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>{t("assets.settingsPage.categoriesTitle")}</h2>
        <p className="text-muted">{t("assets.settingsPage.categoriesHint")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/assets/categories" className="btn-secondary">{t("assets.categories.breadcrumb")}</Link>
          <Link href="/assets/labels" className="btn-secondary">{t("assets.register.printLabels")}</Link>
          <Link href="/assets/labels/templates" className="btn-secondary">{t("assets.labels.templatesTitle")}</Link>
        </div>
      </section>

      <section className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>{t("assets.settingsPage.policiesTitle")}</h2>
        <p className="text-muted">{t("assets.settingsPage.policiesHint")}</p>
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>{t("assets.settingsPage.colVersion")}</th><th>{t("assets.settingsPage.colThreshold")}</th><th>{t("assets.insurance.effectiveFrom")}</th><th>{t("assets.register.active")}</th></tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id}>
                <td>{p.version}</td>
                <td>{p.threshold_currency} {Number(p.threshold_amount).toFixed(2)}</td>
                <td>{p.effective_from}</td>
                <td>{p.is_active ? t("assets.maintenance.yes") : t("assets.maintenance.no")}</td>
              </tr>
            ))}
            {policies.length === 0 && <TableEmpty colSpan={4} title={t("assets.settingsPage.noPolicies")} />}
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
            try {
              await assetMetaApi.createLocation({ code, name, location_type: "room", is_active: true });
              toast.success(t("assets.settingsPage.locationSaved"), `${code} — ${name}`);
              form.reset();
            } catch (err) {
              toast.error(t("assets.settingsPage.locationNotSaved"), apiErrorMessage(err, t("assets.settingsPage.locationSaveFailed")));
              return;
            }
            const r = await assetMetaApi.locations().catch(() => null);
            if (r) setLocations(r.data.data ?? []);
          }}
        >
          <input name="code" className="form-input" placeholder={t("assets.view.fieldCode")} required />
          <input name="name" className="form-input" placeholder={t("assets.import.colName")} required />
          <button type="submit" className="btn-secondary">{t("common.save")}</button>
        </form>
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>{t("assets.view.fieldCode")}</th><th>{t("assets.import.colName")}</th><th>{t("assets.settingsPage.colBuilding")}</th></tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>{l.code}</td>
                <td>{l.name}</td>
                <td>{l.building ?? "—"}</td>
              </tr>
            ))}
            {locations.length === 0 && <TableEmpty colSpan={3} title={t("assets.settingsPage.noLocations")} />}
          </tbody>
        </table>
      </section>
    </div>
  );
}
