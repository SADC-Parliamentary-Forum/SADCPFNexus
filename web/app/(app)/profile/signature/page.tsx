"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import SignaturePad from "signature_pad";
import { saamApi, type SignatureProfile } from "@/lib/api";
import api from "@/lib/api";

type Tab = "full" | "initials";
type InputMode = "draw" | "upload";

export default function SignatureSetupPage() {
  const [tab, setTab] = useState<Tab>("full");
  const [mode, setMode] = useState<InputMode>("draw");
  const [profiles, setProfiles] = useState<SignatureProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const loadProfiles = useCallback(() => {
    saamApi.getProfile()
      .then((res) => setProfiles(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  // Initialise SignaturePad when switching to draw mode
  useEffect(() => {
    if (mode !== "draw" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(ratio, ratio);

    sigPadRef.current = new SignaturePad(canvas, {
      minWidth: 1,
      maxWidth: 2.5,
      penColor: "#0f1f3d",
      backgroundColor: "rgba(255,255,255,0)",
    });

    return () => { sigPadRef.current?.off(); };
  }, [mode, tab]);

  function clearPad() {
    sigPadRef.current?.clear();
  }

  async function saveDraw() {
    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      showToast("error", "Please draw a signature first.");
      return;
    }
    setSaving(true);
    try {
      const dataUrl = sigPadRef.current.toDataURL("image/png");
      await saamApi.draw(tab, dataUrl);
      showToast("success", "Signature saved.");
      loadProfiles();
    } catch {
      showToast("error", "Failed to save signature.");
    } finally {
      setSaving(false);
    }
  }

  async function saveUpload() {
    if (!uploadFile) {
      showToast("error", "Please choose a file.");
      return;
    }
    setSaving(true);
    try {
      await saamApi.upload(tab, uploadFile);
      showToast("success", "Signature uploaded.");
      setUploadFile(null);
      setUploadPreview(null);
      loadProfiles();
    } catch {
      showToast("error", "Failed to upload signature.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeSignature(type: Tab) {
    if (!confirm(`Revoke your ${type} signature? This action cannot be undone.`)) return;
    try {
      await saamApi.revoke(type);
      showToast("success", "Signature revoked.");
      loadProfiles();
    } catch {
      showToast("error", "Failed to revoke signature.");
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  const currentProfile = profiles.find((p) => p.type === tab);
  const hasActive = currentProfile?.status === "active" && currentProfile.active_version;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/profile" className="hover:text-primary transition-colors">Profile</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">My Signature</span>
      </div>

      <div>
        <h1 className="page-title">Digital Signature</h1>
        <p className="page-subtitle">Set up your institutional signature and initials for workflow approvals.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(["full", "initials"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setMode("draw"); setUploadFile(null); setUploadPreview(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t === "full" ? "Full Signature" : "Initials"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-48 bg-neutral-100 rounded-xl animate-pulse" />
      ) : (
        <>
          {/* Active signature display */}
          {hasActive && (
            <div className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                    Active {tab === "full" ? "Signature" : "Initials"}
                  </p>
                  <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-4 inline-block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/v1/saam/signature-image/${currentProfile!.active_version!.id}`}
                      alt="active signature"
                      className="max-h-16 max-w-[200px] object-contain"
                      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.12))" }}
                    />
                  </div>
                  <p className="text-xs text-neutral-400 mt-2">
                    Version {currentProfile!.active_version!.version_no} · Active since{" "}
                    {new Date(currentProfile!.active_version!.effective_from).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => revokeSignature(tab)}
                  className="text-xs font-semibold text-red-500 hover:underline flex-shrink-0"
                >
                  Revoke
                </button>
              </div>
            </div>
          )}

          {/* Input mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode("draw")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                mode === "draw"
                  ? "bg-primary text-white border-primary"
                  : "border-neutral-200 text-neutral-600 hover:border-primary hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">draw</span>
              Draw
            </button>
            <button
              onClick={() => setMode("upload")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                mode === "upload"
                  ? "bg-primary text-white border-primary"
                  : "border-neutral-200 text-neutral-600 hover:border-primary hover:text-primary"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">upload</span>
              Upload
            </button>
          </div>

          {/* Draw mode */}
          {mode === "draw" && (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                  Draw your {tab === "full" ? "signature" : "initials"} below
                </p>
                <button onClick={clearPad} className="text-xs text-neutral-400 hover:text-neutral-600">
                  Clear
                </button>
              </div>
              <div className="border-2 border-dashed border-neutral-200 rounded-xl overflow-hidden bg-neutral-50 relative" style={{ height: 160 }}>
                <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
                <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                  <div className="w-3/4 border-t border-neutral-300" />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={saveDraw}
                  disabled={saving}
                  className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-60"
                >
                  {saving ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">save</span>
                  )}
                  {saving ? "Saving…" : "Save Signature"}
                </button>
              </div>
            </div>
          )}

          {/* Upload mode */}
          {mode === "upload" && (
            <div className="card p-5 space-y-4">
              <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                Upload {tab === "full" ? "signature" : "initials"} image (PNG, transparent bg preferred, max 500KB)
              </p>
              {uploadPreview ? (
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={uploadPreview} alt="preview" className="max-h-16 max-w-[160px] object-contain" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-700">{uploadFile?.name}</p>
                    <button onClick={() => { setUploadFile(null); setUploadPreview(null); }} className="text-xs text-red-500 hover:underline mt-0.5">Remove</button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-neutral-200 rounded-xl p-8 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                  <span className="material-symbols-outlined text-neutral-400 text-[32px]">image</span>
                  <span className="text-sm text-neutral-500">Click to choose PNG file</span>
                  <input type="file" accept=".png,image/png" className="hidden" onChange={onFileChange} />
                </label>
              )}
              <div className="flex justify-end">
                <button
                  onClick={saveUpload}
                  disabled={saving || !uploadFile}
                  className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-60"
                >
                  {saving ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">upload</span>
                  )}
                  {saving ? "Uploading…" : "Upload Signature"}
                </button>
              </div>
            </div>
          )}

          {/* Info note */}
          <div className="flex items-start gap-2 text-xs text-neutral-500 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
            <span>Your signature is stored securely and used only when you explicitly approve a document. It is never shared publicly and requires password re-authentication each time it is applied.</span>
          </div>
        </>
      )}
    </div>
  );
}
