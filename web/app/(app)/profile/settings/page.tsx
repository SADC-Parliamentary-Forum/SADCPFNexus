"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { TIMEZONES, DATE_FORMATS, CURRENCIES, LANGUAGES, PREFS_KEY } from "@/lib/constants";
import { useTheme } from "@/components/providers/ThemeProvider";

const NAV = [
  { label: "Profile",       href: "/profile",           icon: "person" },
  { label: "Preferences",   href: "/profile/settings",  icon: "tune"   },
  { label: "Security",      href: "/profile/security",  icon: "lock"   },
];

const SETTINGS_KEY = PREFS_KEY;

interface Prefs {
  // Notifications
  notifyTravelApproved: boolean;
  notifyLeaveApproved: boolean;
  notifyImprestDue: boolean;
  notifySystemAlerts: boolean;
  notifyEmail: boolean;
  notifyInApp: boolean;
  // Display
  dateFormat: string;
  timezone: string;
  currency: string;
  language: string;
  // Accessibility
  compactMode: boolean;
  highContrast: boolean;
}

const DEFAULT_PREFS: Prefs = {
  notifyTravelApproved: true,
  notifyLeaveApproved: true,
  notifyImprestDue: true,
  notifySystemAlerts: true,
  notifyEmail: true,
  notifyInApp: true,
  dateFormat: "DD/MM/YYYY",
  timezone: "Africa/Windhoek",
  currency: "NAD",
  language: "en",
  compactMode: false,
  highContrast: false,
};


function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100 dark:border-neutral-700/50 last:border-0">
      <div>
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{label}</p>
        {description && <p className="text-xs text-neutral-400 mt-0.5">{description}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${checked ? "bg-primary" : "bg-neutral-200"}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export default function ProfileSettingsPage() {
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);

  const set = <K extends keyof Prefs>(key: K, value: Prefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new Event("sadcpf:prefs-updated"));
    showToast("Preferences saved.");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {toast}
        </div>
      )}

      <div>
        <h1 className="page-title">Preferences & Settings</h1>
        <p className="page-subtitle">Customise notifications, display format, language, and accessibility options.</p>
      </div>

      {/* Sub nav */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-700">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${n.href === "/profile/settings" ? "border-primary text-primary" : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"}`}>
            <span className="material-symbols-outlined text-[16px]">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Notification preferences */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">notifications</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Notification Triggers</h3>
          </div>
          <Toggle checked={prefs.notifyTravelApproved} onChange={(v) => set("notifyTravelApproved", v)} label="Travel request approved or rejected" />
          <Toggle checked={prefs.notifyLeaveApproved} onChange={(v) => set("notifyLeaveApproved", v)} label="Leave request approved or rejected" />
          <Toggle checked={prefs.notifyImprestDue} onChange={(v) => set("notifyImprestDue", v)} label="Imprest retirement due reminder" description="Notified 3 days before deadline" />
          <Toggle checked={prefs.notifySystemAlerts} onChange={(v) => set("notifySystemAlerts", v)} label="System alerts and announcements" />
        </div>

        {/* Delivery channels */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50">
              <span className="material-symbols-outlined text-teal-600 text-[18px]">send</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Delivery Channels</h3>
          </div>
          <Toggle checked={prefs.notifyEmail} onChange={(v) => set("notifyEmail", v)} label="Email notifications" description="Receive notifications to your registered email" />
          <Toggle checked={prefs.notifyInApp} onChange={(v) => set("notifyInApp", v)} label="In-app notifications" description="Show notification badge and bell alerts" />
        </div>

        {/* Display & locale */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <span className="material-symbols-outlined text-amber-600 text-[18px]">language</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Display & Locale</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Language</label>
              <select className="form-input" value={prefs.language} onChange={(e) => set("language", e.target.value)}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Timezone</label>
              <select className="form-input" value={prefs.timezone} onChange={(e) => set("timezone", e.target.value)}>
                {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Date Format</label>
              <select className="form-input" value={prefs.dateFormat} onChange={(e) => set("dateFormat", e.target.value)}>
                {DATE_FORMATS.map((f) => <option key={f}>{f}</option>)}
              </select>
              <p className="text-[11px] text-neutral-400 mt-1">
                Preview: {(() => {
                  const d = new Date(2026, 2, 22); // 22 Mar 2026
                  const dd = String(d.getDate()).padStart(2, "0");
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const yyyy = String(d.getFullYear());
                  const mmm = "Mar";
                  switch (prefs.dateFormat) {
                    case "MM/DD/YYYY":  return `${mm}/${dd}/${yyyy}`;
                    case "YYYY-MM-DD":  return `${yyyy}-${mm}-${dd}`;
                    case "DD-MMM-YYYY": return `${dd}-${mmm}-${yyyy}`;
                    default:            return `${dd}/${mm}/${yyyy}`;
                  }
                })()}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Display Currency</label>
              <select className="form-input" value={prefs.currency} onChange={(e) => set("currency", e.target.value)}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Appearance / Dark mode */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-700">
              <span className="material-symbols-outlined text-neutral-600 dark:text-neutral-300 text-[18px]">dark_mode</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Appearance</h3>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Dark Mode</p>
              <p className="text-xs text-neutral-400 mt-0.5">Switch between light and dark interface theme</p>
            </div>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${theme === "dark" ? "bg-primary" : "bg-neutral-200"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${theme === "dark" ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`flex items-center gap-2.5 rounded-xl border-2 p-3 transition-all ${theme === "light" ? "border-primary bg-primary/5" : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${theme === "light" ? "text-primary" : "text-neutral-400"}`} style={{ fontVariationSettings: "'FILL' 1" }}>light_mode</span>
              <div className="text-left">
                <p className={`text-xs font-semibold ${theme === "light" ? "text-primary" : "text-neutral-600 dark:text-neutral-300"}`}>Light</p>
                <p className="text-[10px] text-neutral-400">Default theme</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`flex items-center gap-2.5 rounded-xl border-2 p-3 transition-all ${theme === "dark" ? "border-primary bg-primary/10" : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"}`}
            >
              <span className={`material-symbols-outlined text-[20px] ${theme === "dark" ? "text-primary" : "text-neutral-400"}`} style={{ fontVariationSettings: "'FILL' 1" }}>dark_mode</span>
              <div className="text-left">
                <p className={`text-xs font-semibold ${theme === "dark" ? "text-primary" : "text-neutral-600 dark:text-neutral-300"}`}>Dark</p>
                <p className="text-[10px] text-neutral-400">Easy on the eyes</p>
              </div>
            </button>
          </div>
        </div>

        {/* Accessibility */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
              <span className="material-symbols-outlined text-purple-600 text-[18px]">accessibility</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Accessibility</h3>
          </div>
          <Toggle checked={prefs.compactMode} onChange={(v) => set("compactMode", v)} label="Compact view" description="Reduce spacing for a denser layout" />
          <Toggle checked={prefs.highContrast} onChange={(v) => set("highContrast", v)} label="High contrast" description="Increase text contrast for better readability" />
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">save</span>
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
}
