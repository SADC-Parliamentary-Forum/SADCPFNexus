"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saamApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type SigType = "full" | "initials";

const MAX_BYTES = 512 * 1024; // 512 KB — backend limit

export default function UploadSignaturePage() {
  const { success, error: showErrorToast, info } = useToast();
  const router = useRouter();
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sigType, setSigType] = useState<SigType>("full");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);


  function handleFile(f: File) {
    setError(null);
    if (!["image/png", "image/svg+xml"].includes(f.type)) {
      setError(t("saam.upload.typeError"));
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(t("saam.upload.tooLarge", { size: (f.size / 1024).toFixed(0) }));
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
      setError(t("saam.upload.required"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saamApi.upload(sigType, file);
      success(t("saam.upload.uploaded"));
      setTimeout(() => router.push("/saam"), 1000);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? t("saam.upload.uploadFailed");
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("saam.upload.title")}
        subtitle={t("saam.upload.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "SAAM", href: "/saam" },
              { label: t("saam.uploadSignature") },
            ]}
          />
        }
      />

      {/* Type selector */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <p className="text-xs font-semibold text-neutral-700 mb-3">{t("saam.draw.type")}</p>
          <div className="flex gap-2">
            {(["full", "initials"] as SigType[]).map((st) => (
              <button
                key={st}
                onClick={() => setSigType(st)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sigType === st
                    ? "bg-primary text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {st === "full" ? "draw" : "text_fields"}
                </span>
                {st === "full" ? t("saam.sigType.full") : t("saam.sigType.initials")}
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
                {t("saam.upload.dragDrop")}{" "}
                <span className="text-primary underline">{t("saam.upload.browse")}</span>
              </p>
              <p className="text-xs text-neutral-400 mt-1">{t("saam.upload.formats")}</p>
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
                <p className="text-xs font-semibold text-neutral-700">{t("saam.upload.preview")}</p>
                <button
                  onClick={clearFile}
                  className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                  {t("assignments.detail.remove")}
                </button>
              </div>
              <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white flex items-center justify-center p-4 min-h-[120px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt={t("saam.upload.previewAlt")}
                  className="max-h-[100px] max-w-full object-contain"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span className="material-symbols-outlined text-[14px] text-green-500">
                  check_circle
                </span>
                <span className="font-medium truncate">{file?.name}</span>
                <span className="text-neutral-400 flex-shrink-0">
                  {t("saam.upload.size", { size: ((file?.size ?? 0) / 1024).toFixed(0) })}
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
          {t("common.back")}
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
          {saving ? t("leave.detail.uploading") : t("saam.uploadSignature")}
        </button>
      </div>
    </div>
  );
}
