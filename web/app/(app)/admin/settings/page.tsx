"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useState, useEffect } from "react";
import { settingsApi, type SystemSettings } from "@/lib/api";
import { MONTHS_OF_YEAR, CURRENCIES, TIMEZONES } from "@/lib/constants";
import { useToast } from "@/components/ui/Toast";

const DEFAULTS: SystemSettings = {
  org_name: "SADC Parliamentary Forum",
  org_abbreviation: "SADC-PF",
  org_logo_url: "/sadcpf-logo.png",
  org_address: "129 Robert Mugabe Avenue, Windhoek, Namibia",
  fiscal_start_month: "January",
  default_currency: "NAD",
  timezone: "Africa/Windhoek",
  letterhead_tagline: "Enhancing Parliamentary Democracy in the SADC Region",
  letterhead_phone: "+264 61 287 2158",
  letterhead_fax: "+264 61 254 642",
  letterhead_website: "www.sadcpf.org",
};

type CredentialRow = {
  key: string;
  label: string;
  configured: boolean;
  driver?: string | null;
  secret_source: string;
  guidance: string;
  details?: Record<string, unknown>;
};

export default function AdminSettingsPage() {
  const { success, error, info } = useToast();
  const [settings, setSettings] = useState<SystemSettings>(DEFAULTS);
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    Promise.all([
      settingsApi.get().then((res) => setSettings({ ...DEFAULTS, ...res.data })).catch(() => {}),
      settingsApi.operatorCredentials().then((res) => setCredentials(res.data.data ?? [])).catch(() => setCredentials([])),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.update(settings);
      setSettings({ ...DEFAULTS, ...res.data });
      success("Settings saved.");
    } catch {
      error("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const MONTHS = MONTHS_OF_YEAR;

  return (
    <div className="space-y-6 max-w-3xl">
<div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/admin" className="hover:text-primary transition-colors">Admin</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">System Settings</span>
      </div>

      <ModulePageHeader
        title="System Settings"
        subtitle="Configure organisation details, fiscal year, and platform-wide settings."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "System Settings" }]} />}
      />

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-48 bg-neutral-100 rounded-xl" />
          <div className="h-32 bg-neutral-100 rounded-xl" />
        </div>
      ) : (
        <>
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <span className="material-symbols-outlined text-primary text-[18px]">corporate_fare</span>
              </div>
              <h2 className="text-sm font-semibold text-neutral-900">Organisation</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Organisation Name</label>
                <input className="form-input" value={settings.org_name} onChange={(e) => setSettings({ ...settings, org_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Abbreviation</label>
                <input className="form-input" value={settings.org_abbreviation} onChange={(e) => setSettings({ ...settings, org_abbreviation: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Logo URL</label>
                <input className="form-input" value={settings.org_logo_url} onChange={(e) => setSettings({ ...settings, org_logo_url: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Address</label>
                <textarea rows={2} className="form-input resize-none" value={settings.org_address} onChange={(e) => setSettings({ ...settings, org_address: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                <span className="material-symbols-outlined text-amber-600 text-[18px]">calendar_today</span>
              </div>
              <h2 className="text-sm font-semibold text-neutral-900">Fiscal Year & Locale</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Fiscal start month</label>
                <select className="form-input" value={settings.fiscal_start_month} onChange={(e) => setSettings({ ...settings, fiscal_start_month: e.target.value })}>
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Currency</label>
                <select className="form-input" value={settings.default_currency} onChange={(e) => setSettings({ ...settings, default_currency: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Timezone</label>
                <select className="form-input" value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}>
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
                <span className="material-symbols-outlined text-sky-700 text-[18px]">description</span>
              </div>
              <h2 className="text-sm font-semibold text-neutral-900">Letterhead</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Tagline</label>
                <input className="form-input" value={settings.letterhead_tagline ?? ""} onChange={(e) => setSettings({ ...settings, letterhead_tagline: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Phone</label>
                <input className="form-input" value={settings.letterhead_phone ?? ""} onChange={(e) => setSettings({ ...settings, letterhead_phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Fax</label>
                <input className="form-input" value={settings.letterhead_fax ?? ""} onChange={(e) => setSettings({ ...settings, letterhead_fax: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Website</label>
                <input className="form-input" value={settings.letterhead_website ?? ""} onChange={(e) => setSettings({ ...settings, letterhead_website: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                <span className="material-symbols-outlined text-emerald-700 text-[18px]">vpn_key</span>
              </div>
              <h2 className="text-sm font-semibold text-neutral-900">Operator credentials</h2>
            </div>
            <p className="text-xs text-neutral-500">
              Secrets stay in server env only. Non-secret org settings save above; integration keys are never shown here.
            </p>
            <ul className="divide-y divide-neutral-100">
              {credentials.map((row) => (
                <li key={row.key} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-neutral-900">{row.label}</div>
                    <div className="text-xs text-neutral-500">{row.guidance}</div>
                    {row.driver ? (
                      <div className="mt-1 text-xs text-neutral-400">Driver: {row.driver}</div>
                    ) : null}
                  </div>
                  <span
                    className={`mt-1 inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      row.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {row.configured ? "Configured" : "Not configured — set via server env"}
                  </span>
                </li>
              ))}
              {credentials.length === 0 ? (
                <li className="py-3 text-sm text-neutral-500">Credential status unavailable.</li>
              ) : null}
            </ul>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">save</span>
              )}
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
