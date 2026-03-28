"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { settingsApi, type SystemSettings } from "@/lib/api";

const DEFAULTS: Partial<SystemSettings> = {
  org_name: "SADC Parliamentary Forum",
  org_abbreviation: "SADC-PF",
  org_logo_url: "/sadcpf-logo.png",
  org_address: "129 Robert Mugabe Avenue, Windhoek, Namibia",
  letterhead_tagline: "Enhancing Parliamentary Democracy in the SADC Region",
  letterhead_phone: "+264 61 287 2158",
  letterhead_fax: "+264 61 254 642",
  letterhead_website: "www.sadcpf.org",
};

export default function LetterheadPage() {
  const [settings, setSettings] = useState<Partial<SystemSettings>>(DEFAULTS);
  const [form, setForm]         = useState<Partial<SystemSettings>>(DEFAULTS);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState(false);
  const [toast, setToast]       = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    settingsApi.get()
      .then((res) => {
        const merged = { ...DEFAULTS, ...res.data };
        setSettings(merged);
        setForm(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (field: keyof SystemSettings, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await settingsApi.update({
        org_name:           form.org_name,
        org_abbreviation:   form.org_abbreviation,
        org_address:        form.org_address,
        letterhead_tagline: form.letterhead_tagline,
        letterhead_phone:   form.letterhead_phone,
        letterhead_fax:     form.letterhead_fax,
        letterhead_website: form.letterhead_website,
      });
      const merged = { ...DEFAULTS, ...res.data };
      setSettings(merged);
      setForm(merged);
      setDirty(false);
      showToast("success", "Letterhead settings saved.");
    } catch {
      showToast("error", "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(settings);
    setDirty(false);
  };

  // Use form values for live preview
  const preview = form;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb + actions */}
      <div className="print:hidden flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Link href="/correspondence" className="hover:text-primary transition-colors">Correspondence</Link>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="text-neutral-900 font-medium">Letterhead Branding</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="btn-secondary inline-flex items-center gap-1.5 text-sm">
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print Preview
          </button>
          {dirty && (
            <button onClick={handleReset} className="btn-secondary text-sm">Discard</button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="btn-primary inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
          >
            {saving && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
            Save Changes
          </button>
        </div>
      </div>

      <div>
        <h1 className="page-title">Letterhead Branding</h1>
        <p className="page-subtitle">Configure the organisation identity used on official correspondence and printed documents. Changes appear immediately in the live preview.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
        {/* ── Edit panel ── */}
        <div className="print:hidden card p-5 space-y-5 sticky top-6">
          <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">edit</span>
            Organisation Identity
          </h2>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-9 bg-neutral-100 rounded-lg" />)}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Organisation Name</label>
                <input className="form-input" value={form.org_name ?? ""} onChange={(e) => set("org_name", e.target.value)} placeholder="e.g. SADC Parliamentary Forum" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Abbreviation / Short Name</label>
                <input className="form-input" value={form.org_abbreviation ?? ""} onChange={(e) => set("org_abbreviation", e.target.value)} placeholder="e.g. SADC-PF" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Tagline</label>
                <input className="form-input" value={form.letterhead_tagline ?? ""} onChange={(e) => set("letterhead_tagline", e.target.value)} placeholder="e.g. Enhancing Parliamentary Democracy…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Physical Address</label>
                <textarea className="form-input resize-none" rows={2} value={form.org_address ?? ""} onChange={(e) => set("org_address", e.target.value)} placeholder="129 Robert Mugabe Avenue, Windhoek" />
              </div>

              <hr className="border-neutral-100" />
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Contact Details</p>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Telephone</label>
                <input className="form-input" value={form.letterhead_phone ?? ""} onChange={(e) => set("letterhead_phone", e.target.value)} placeholder="+264 61 287 2158" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Fax</label>
                <input className="form-input" value={form.letterhead_fax ?? ""} onChange={(e) => set("letterhead_fax", e.target.value)} placeholder="+264 61 254 642" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Website</label>
                <input className="form-input" value={form.letterhead_website ?? ""} onChange={(e) => set("letterhead_website", e.target.value)} placeholder="www.sadcpf.org" />
              </div>

              {dirty && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  Unsaved changes — click Save Changes to apply.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Live preview ── */}
        <div>
          <p className="print:hidden text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">preview</span>
            Live Preview
          </p>

          {loading ? (
            <div className="h-[842px] bg-neutral-100 rounded-xl animate-pulse" />
          ) : (
            <div
              id="letterhead-preview"
              className="bg-white shadow-lg rounded-xl overflow-hidden print:shadow-none print:rounded-none"
              style={{ minHeight: "842px" }}
            >
              {/* Header */}
              <div style={{ borderBottom: "3px solid #1d85ed", padding: "28px 40px 22px", display: "flex", alignItems: "center", gap: "20px" }}>
                {preview.org_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.org_logo_url} alt={preview.org_abbreviation ?? ""} style={{ width: 64, height: 64, objectFit: "contain", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 64, height: 64, background: "#1d85ed", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: "#fff", fontWeight: 900, fontSize: 20 }}>{(preview.org_abbreviation ?? "S").slice(0, 2).toUpperCase()}</span>
                  </div>
                )}
                <div>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f1f3d" }}>{preview.org_name}</p>
                  <p style={{ margin: "2px 0 4px", fontSize: 12, fontWeight: 600, color: "#1d85ed", textTransform: "uppercase", letterSpacing: "0.06em" }}>{preview.org_abbreviation}</p>
                  {preview.letterhead_tagline && (
                    <p style={{ margin: 0, fontSize: 11, color: "#6b7280", fontStyle: "italic" }}>{preview.letterhead_tagline}</p>
                  )}
                </div>
              </div>

              {/* Blue banner */}
              <div style={{ background: "#1d85ed", padding: "10px 40px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.85)" }}>Date: ___________________________</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.85)" }}>Ref: ___________________________</span>
              </div>

              {/* Address fields */}
              <div style={{ padding: "28px 40px 0" }}>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>To:</p>
                  <div style={{ borderBottom: "1px solid #d1d5db", marginBottom: 10, height: 24 }} />
                  <div style={{ borderBottom: "1px solid #d1d5db", marginBottom: 10, height: 24 }} />
                  <div style={{ borderBottom: "1px solid #d1d5db", height: 24 }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0f1f3d", borderBottom: "2px solid #e5e7eb", paddingBottom: 8 }}>
                    Subject: _______________________________________________________________
                  </p>
                </div>
              </div>

              {/* Body lines */}
              <div style={{ padding: "8px 40px 0" }}>
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} style={{ borderBottom: "1px solid #f3f4f6", height: 32, marginBottom: 2 }} />
                ))}
              </div>

              {/* Signature */}
              <div style={{ padding: "24px 40px 0", display: "flex", justifyContent: "flex-end" }}>
                <div style={{ textAlign: "center", width: 200 }}>
                  <div style={{ borderBottom: "1px solid #374151", height: 40 }} />
                  <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Signature &amp; Date</p>
                </div>
              </div>

              {/* Footer */}
              <div style={{ borderTop: "1px solid #e5e7eb", margin: "24px 40px 0", padding: "14px 0 24px" }}>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 6 }}>
                  {preview.letterhead_phone && <span style={{ fontSize: 11, color: "#9ca3af" }}>Tel: {preview.letterhead_phone}</span>}
                  {preview.letterhead_fax   && <span style={{ fontSize: 11, color: "#9ca3af" }}>Fax: {preview.letterhead_fax}</span>}
                  {preview.letterhead_website && <span style={{ fontSize: 11, color: "#9ca3af" }}>Web: {preview.letterhead_website}</span>}
                </div>
                {preview.org_address && <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{preview.org_address}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
