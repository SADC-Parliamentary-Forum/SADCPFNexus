"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saamApi } from "@/lib/api";

type SigType = "full" | "initials";

const MAX_BYTES = 512 * 1024; // 512 KB — backend limit

export default function UploadSignaturePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sigType, setSigType] = useState<SigType>("full");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  function handleFile(f: File) {
    setError(null);
    if (!["image/png", "image/svg+xml"].includes(f.type)) {
      setError("Only PNG and SVG files are accepted.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`File is too large (${(f.size / 1024).toFixed(0)} KB). Maximum is 512 KB.`);
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function save() {
    if (!file) {
      setError("Please select a file before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saamApi.upload(sigType, file);
      showToast("Signature uploaded successfully.");
      setTimeout(() => router.push("/saam"), 1000);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to upload signature. Please try again.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-5">
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white bg-green-600 shadow-lg">
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-2">
          <Link href="/saam" className="hover:text-neutral-600 transition-colors">
            SAAM
          </Link>
          <span className="material-symbols-outlined text-[12px]">chevron_right</span>
          <span className="text-neutral-600 font-medium">Upload Signature</span>
        </div>
        <h1 className="page-title">Upload Your Signature</h1>
        <p className="page-subtitle">
          Upload a PNG or SVG image of your signature. Max file size: 512 KB.
        </p>
      </div>

      {/* Type selector */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-700 mb-3">Signature Type</p>
          <div className="flex gap-2">
            {(["full", "initials"] as SigType[]).map((t) => (
              <button
                key={t}
                onClick={() => setSigType(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sigType === t
                    ? "bg-primary text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {t === "full" ? "draw" : "text_fields"}
                </span>
                {t === "full" ? "Full Signature" : "Initials"}
              </button>
            ))}
          </div>
        </div>

        {/* Upload area */}
        <div className="px-5 py-4 space-y-4">
          {!preview ? (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-neutral-300 hover:border-neutral-400 bg-neutral-50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <div className="mx-auto w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
                <span
                  className="material-symbols-outlined text-neutral-400 text-[24px]"
                  style={{ fontVariationSettings: "'FILL' 0" }}
                >
                  upload_file
                </span>
              </div>
              <p className="text-sm font-medium text-neutral-700">
                Drag &amp; drop or{" "}
                <span className="text-primary underline">browse file</span>
              </p>
              <p className="text-xs text-neutral-400 mt-1">PNG, SVG · max 512 KB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.svg,image/png,image/svg+xml"
                className="hidden"
                onChange={onInputChange}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-neutral-700">Preview</p>
                <button
                  onClick={clearFile}
                  className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                  Remove
                </button>
              </div>
              <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white flex items-center justify-center p-4 min-h-[120px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Signature preview"
                  className="max-h-[100px] max-w-full object-contain"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="material-symbols-outlined text-[14px] text-green-500">
                  check_circle
                </span>
                <span className="font-medium truncate">{file?.name}</span>
                <span className="text-neutral-400 flex-shrink-0">
                  ({((file?.size ?? 0) / 1024).toFixed(0)} KB)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <span
            className="material-symbols-outlined text-[16px] flex-shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            error
          </span>
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link href="/saam" className="btn-secondary text-sm">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back
        </Link>
        <button
          onClick={save}
          disabled={saving || !file}
          className="btn-primary text-sm disabled:opacity-60"
        >
          {saving ? (
            <span className="material-symbols-outlined text-[16px] animate-spin">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined text-[16px]">upload</span>
          )}
          {saving ? "Uploading…" : "Upload Signature"}
        </button>
      </div>
    </div>
  );
}
