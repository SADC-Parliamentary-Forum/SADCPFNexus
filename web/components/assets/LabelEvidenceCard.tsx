"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { assetLabelsApi, type AssetLabelEvidence } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { formatDateShort } from "@/lib/utils";

const MAX_EDGE_PX = 2000;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/** Shrink a camera photo to a JPEG of at most MAX_EDGE_PX on its longest side. */
async function shrinkPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
  } catch {
    // Formats the browser cannot decode go up as-is; the server checks the real type.
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Evidence that the printed label is stuck on the device: a photo of it in place,
 * who applied it, when, and an optional note on where it is.
 */
export function LabelEvidenceCard({
  assetId,
  assetTag,
  canCapture,
  focusRequested,
  onChanged,
}: {
  assetId: number;
  assetTag: string;
  canCapture: boolean;
  /** Set when arriving from a scan's "Photograph label" action. */
  focusRequested?: boolean;
  onChanged?: () => void;
}) {
  const { t } = useI18n();
  const [evidence, setEvidence] = useState<AssetLabelEvidence | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ blob: Blob; url: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const takeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await assetLabelsApi.evidence(assetId);
      setEvidence(res.data.data);
      let next: string | null = null;
      if (res.data.data.label?.photo) {
        const img = await assetLabelsApi.evidencePhoto(assetId);
        next = URL.createObjectURL(img.data);
      }
      setPhotoUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return next;
      });
    } catch {
      setEvidence(null);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  useEffect(() => () => {
    if (draft) URL.revokeObjectURL(draft.url);
  }, [draft]);

  useEffect(() => {
    if (!focusRequested || !evidence?.label) return;
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    takeRef.current?.focus();
  }, [focusRequested, evidence]);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");
    if (file.type && !file.type.startsWith("image/")) {
      setError(t("assets.labelEvidence.notImage"));
      return;
    }
    setPreparing(true);
    const blob = await shrinkPhoto(file);
    setPreparing(false);
    setDraft({ blob, url: URL.createObjectURL(blob) });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const type = ACCEPTED.includes(draft.blob.type) ? draft.blob.type : "image/jpeg";
      const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
      await assetLabelsApi.uploadEvidence(assetId, draft.blob, note.trim() || undefined, `label-${assetTag}.${ext}`);
      setDraft(null);
      setNote("");
      setNotice(t("assets.labelEvidence.saved"));
      await load();
      onChanged?.();
    } catch (err) {
      setError(apiErrorMessage(err, t("assets.labelEvidence.saveFailed")));
    } finally {
      setBusy(false);
    }
  }

  const label = evidence?.label ?? null;
  const status = evidence?.label_status ?? "never_printed";

  return (
    <section ref={sectionRef} className="card space-y-3 p-4" aria-labelledby="label-evidence-title" data-testid="label-evidence">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="label-evidence-title" className="text-sm font-semibold">{t("assets.labelEvidence.title")}</h2>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700" data-testid="label-evidence-status">
          {t(`assets.labels.state.${status}`)}
        </span>
      </div>

      {!label ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
          <span>{t("assets.labelEvidence.neverPrinted")}</span>
          {canCapture ? (
            <Link href={`/assets/labels?asset=${assetId}`} className="btn-secondary px-3 py-1 text-xs">
              {t("assets.labelEvidence.printLabel")}
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <p className="text-xs text-neutral-500">
            {t("assets.labelEvidence.version", { version: label.label_version })}
            {label.printed_at
              ? ` · ${t("assets.labelEvidence.printedBy", { name: label.printed_by?.name ?? "—", date: formatDateShort(label.printed_at) })}`
              : null}
          </p>

          {status === "reprint_required" ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t("assets.labelEvidence.reprintNeeded")}</p>
          ) : null}

          {photoUrl ? (
            <figure className="space-y-2">
              <img
                src={photoUrl}
                alt={t("assets.labelEvidence.photoAlt", { tag: assetTag })}
                className="max-h-80 w-full rounded-lg border border-neutral-200 bg-neutral-50 object-contain"
                data-testid="label-evidence-photo"
              />
              <figcaption className="space-y-0.5 text-xs text-neutral-600">
                {label.applied_at ? (
                  <p>{t("assets.labelEvidence.appliedBy", { name: label.applied_by?.name ?? "—", date: formatDateShort(label.applied_at) })}</p>
                ) : null}
                {label.placement_note ? <p>{t("assets.labelEvidence.where", { note: label.placement_note })}</p> : null}
              </figcaption>
            </figure>
          ) : status !== "reprint_required" ? (
            <p className="text-sm text-neutral-600">{t("assets.labelEvidence.awaiting")}</p>
          ) : null}

          {canCapture ? (
            <div className="space-y-3">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={pick}
                aria-hidden="true"
                tabIndex={-1}
                data-testid="label-evidence-input"
              />
              {draft ? (
                <div className="space-y-2 rounded-lg border border-neutral-200 p-3">
                  <img src={draft.url} alt="" className="max-h-64 w-full rounded object-contain" />
                  <div className="space-y-1">
                    <label htmlFor={`label-note-${assetId}`} className="block text-xs font-medium text-neutral-700">
                      {t("assets.labelEvidence.noteLabel")}
                    </label>
                    <input
                      id={`label-note-${assetId}`}
                      className="form-input"
                      maxLength={255}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={t("assets.labelEvidence.notePlaceholder")}
                      data-testid="label-evidence-note"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-primary" onClick={save} disabled={busy} data-testid="label-evidence-save">
                      {busy ? t("common.loading") : t("assets.labelEvidence.save")}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setDraft(null)} disabled={busy}>
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  ref={takeRef}
                  type="button"
                  className={photoUrl ? "btn-secondary" : "btn-primary"}
                  onClick={() => inputRef.current?.click()}
                  disabled={preparing}
                  data-testid="label-evidence-take"
                >
                  <span className="material-symbols-outlined mr-1 align-middle text-[18px]" aria-hidden="true">photo_camera</span>
                  {preparing
                    ? t("assets.labelEvidence.preparing")
                    : photoUrl
                      ? t("assets.labelEvidence.replacePhoto")
                      : t("assets.labelEvidence.takePhoto")}
                </button>
              )}
            </div>
          ) : null}
        </>
      )}

      {notice ? <p role="status" className="text-sm text-green-700">{notice}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
