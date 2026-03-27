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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settingsApi.get()
      .then((res) => setSettings({ ...DEFAULTS, ...res.data }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Breadcrumb + actions — hidden when printing */}
      <div className="print:hidden flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Link href="/correspondence" className="hover:text-primary transition-colors">Correspondence</Link>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="text-neutral-900 font-medium">Letterhead Preview</span>
        </div>
        <button
          onClick={() => window.print()}
          className="btn-primary inline-flex items-center gap-1.5 text-sm"
        >
          <span className="material-symbols-outlined text-[16px]">print</span>
          Print
        </button>
      </div>

      {loading ? (
        <div className="h-[842px] bg-neutral-100 rounded-xl animate-pulse" />
      ) : (
        /* A4-ish letterhead preview */
        <div
          id="letterhead-preview"
          className="bg-white shadow-lg rounded-xl overflow-hidden print:shadow-none print:rounded-none"
          style={{ minHeight: "842px" }}
        >
          {/* Header */}
          <div style={{ borderBottom: "3px solid #1d85ed", padding: "28px 40px 22px", display: "flex", alignItems: "center", gap: "20px" }}>
            {settings.org_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.org_logo_url}
                alt={settings.org_abbreviation ?? ""}
                style={{ width: 64, height: 64, objectFit: "contain", flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: 64, height: 64, background: "#1d85ed", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ color: "#fff", fontWeight: 900, fontSize: 20 }}>
                  {(settings.org_abbreviation ?? "S").slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f1f3d" }}>{settings.org_name}</p>
              <p style={{ margin: "2px 0 4px", fontSize: 12, fontWeight: 600, color: "#1d85ed", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {settings.org_abbreviation}
              </p>
              {settings.letterhead_tagline && (
                <p style={{ margin: 0, fontSize: 11, color: "#6b7280", fontStyle: "italic" }}>{settings.letterhead_tagline}</p>
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

          {/* Signature line */}
          <div style={{ padding: "24px 40px 0", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ textAlign: "center", width: 200 }}>
              <div style={{ borderBottom: "1px solid #374151", height: 40 }} />
              <p style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Signature &amp; Date</p>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #e5e7eb", margin: "24px 40px 0", padding: "14px 0 24px" }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 6 }}>
              {settings.letterhead_phone && (
                <span style={{ fontSize: 11, color: "#9ca3af" }}>Tel: {settings.letterhead_phone}</span>
              )}
              {settings.letterhead_fax && (
                <span style={{ fontSize: 11, color: "#9ca3af" }}>Fax: {settings.letterhead_fax}</span>
              )}
              {settings.letterhead_website && (
                <span style={{ fontSize: 11, color: "#9ca3af" }}>Web: {settings.letterhead_website}</span>
              )}
            </div>
            {settings.org_address && (
              <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{settings.org_address}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
