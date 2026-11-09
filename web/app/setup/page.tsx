"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  setupApi,
  profileApi,
  profileDocumentsApi,
  saamApi,
  setSetupCompleteCookie,
  type SetupOptions,
} from "@/lib/api";
import { Stepper } from "@/components/ui/Stepper";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import { readStoredUser, writeStoredUser } from "@/lib/session";
import { attachCanvasPassiveFalseTouchListeners } from "@/lib/attachCanvasPassiveFalseTouchListeners";
import { createFilePreviewUrl } from "@/lib/filePreview";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WizardState {
  // Step 1 – Identity
  name: string;
  email: string;
  employeeNumber: string;
  departmentId: number | null;
  positionId: number | null;
  // Step 2 – Personal Info
  phone: string;
  altContact: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  nextOfKin: string;
  dateOfBirth: string;
  nationality: string;
  gender: string;
  // Step 3 – Photo
  photoUploaded: boolean;
  // Step 4 – Signatures
  fullSigSaved: boolean;
  initialsSigSaved: boolean;
  sigConfirmed: boolean;
  // Step 6 – Preferences
  language: string;
  theme: string;
  notifEmail: boolean;
  notifInApp: boolean;
  // Step 7 – Review
  reviewConfirmed: boolean;
}

type SigMethod = "draw" | "upload" | null;

const SESSION_KEY = "sadcpf_setup_wizard";

const STEPS = [
  { label: "setup.step.identity" },
  { label: "setup.step.personal" },
  { label: "setup.step.photo" },
  { label: "setup.step.signatures" },
  { label: "setup.step.security" },
  { label: "setup.step.preferences" },
  { label: "setup.step.review" },
];

function getInitialState(): WizardState {
  return {
    name: "", email: "", employeeNumber: "", departmentId: null, positionId: null,
    phone: "", altContact: "", addressLine1: "", addressLine2: "", city: "", country: "",
    emergencyContactName: "", emergencyContactPhone: "", nextOfKin: "",
    dateOfBirth: "", nationality: "", gender: "",
    photoUploaded: false,
    fullSigSaved: false, initialsSigSaved: false, sigConfirmed: false,
    language: "en", theme: "light", notifEmail: true, notifInApp: true,
    reviewConfirmed: false,
  };
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StepCard({
  title, description, step, children,
}: { title: string; description?: string; step: number; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl bg-white dark:bg-[var(--dk-bg-surface)] border border-neutral-200 dark:border-neutral-700 shadow-sm p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
          {t("setup.stepOf", { step })}
        </p>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{title}</h2>
        {description && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function StepFooter({
  onBack, onNext, nextLabel, nextDisabled = false, saving = false,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  saving?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-700/50">
      {onBack ? (
        <button type="button" onClick={onBack} className="btn-secondary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t("common.back")}
        </button>
      ) : <div />}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || saving}
        className="btn-primary flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving
          ? <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          : nextLabel ?? t("common.next")
        }
        {!saving && <span className="material-symbols-outlined text-[16px]">arrow_forward</span>}
      </button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      <span className="material-symbols-outlined text-[16px] mt-0.5">error_outline</span>
      {message}
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
      {label}
      {required && <span className="text-red-500 dark:text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function ReviewSection({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div className="rounded-xl border border-neutral-100 dark:border-neutral-700/50 overflow-hidden">
      <div className="px-4 py-2.5 bg-neutral-50 dark:bg-white/5 border-b border-neutral-100 dark:border-neutral-700/50">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{title}</p>
      </div>
      <div className="divide-y divide-neutral-50 dark:divide-neutral-700/50">
        {items.map(([label, value]) => (
          <div key={label} className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
            <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{value || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormSection({
  title, description, children,
}: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/70 dark:bg-white/5 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
        {description && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

// ─── Setup Header ─────────────────────────────────────────────────────────────

function SetupHeader() {
  const { t } = useI18n();
  return (
    <div className="border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[var(--dk-bg-surface)] px-6 py-4">
      <div className="mx-auto max-w-3xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sadcpf-logo.jpg" alt="SADC-PF" className="h-8 w-auto object-contain shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">SADC-PF Nexus</p> {/* i18n-ignore */}
            <p className="text-xs text-neutral-400 dark:text-neutral-500">{t("setup.accountSetup")}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <p className="text-xs text-neutral-400 dark:text-neutral-500 hidden sm:block max-w-[200px] md:max-w-none text-right">
            {t("setup.headerHint")}
          </p>
          <a
            href="/login?signout=1"
            className="text-sm font-medium text-primary hover:text-primary-hover underline-offset-4 hover:underline whitespace-nowrap"
          >
            {t("nav.signOut")}
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Signature Canvas (embedded, smaller variant of draw/page.tsx) ────────────

function SignatureCanvas({
  type,
  onSaved,
}: {
  type: "full" | "initials";
  onSaved: () => void;
}) {
  const toast = useToast();
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPos = useCallback((canvas: HTMLCanvasElement, e: MouseEvent | TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const te = e as unknown as TouchEvent;
    const pt = te.touches?.[0] ?? te.changedTouches?.[0];
    if (pt) {
      return {
        x: (pt.clientX - rect.left) * scaleX,
        y: (pt.clientY - rect.top) * scaleY,
      };
    }
    const me = e as MouseEvent;
    return {
      x: (me.clientX - rect.left) * scaleX,
      y: (me.clientY - rect.top) * scaleY,
    };
  }, []);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  useEffect(() => {
    function getPaintCtx() {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      return { canvas, ctx };
    }
    return attachCanvasPassiveFalseTouchListeners(canvasRef, {
      lastPos,
      getPos,
      getPaintCtx,
      setHasStrokes,
    });
  }, [getPos]);

  function startDraw(e: React.MouseEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(canvas, e.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
  }

  function onDraw(e: React.MouseEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    const pos = getPos(canvas, e.nativeEvent);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasStrokes(true);
  }

  function endDraw(e: React.MouseEvent) {
    e.preventDefault();
    setIsDrawing(false);
    lastPos.current = null;
  }

  function clearCanvas() {
    initCanvas();
    setHasStrokes(false);
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) { setError(t("setup.drawFirst")); return; }
    setSaving(true);
    setError(null);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      await saamApi.draw(type, dataUrl);
      toast.success(type === "full" ? t("setup.sigSaved") : t("setup.initialsSaved"));
      onSaved();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("correspondence.saveFailed"));
      toast.error(type === "full" ? t("setup.sigNotSaved") : t("setup.initialsNotSaved"), apiErrorMessage(e, t("correspondence.saveFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <ErrorBanner message={error} />}
      <div className="rounded-xl border-2 border-dashed border-neutral-200 overflow-hidden bg-white touch-none">
        <canvas
          ref={canvasRef}
          width={600}
          height={150}
          className="w-full cursor-crosshair"
          aria-label={t("setup.canvasLabel")}
          onMouseDown={startDraw}
          onMouseMove={onDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
        />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={clearCanvas} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">refresh</span>
          {t("setup.clear")}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasStrokes || saving}
          className="btn-primary py-1.5 px-4 text-sm flex items-center gap-1.5 disabled:opacity-40"
        >
          {saving
            ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
            : <span className="material-symbols-outlined text-[16px]">save</span>}
          {saving ? t("correspondence.saving") : t("setup.saveSignature")}
        </button>
      </div>
    </div>
  );
}

// ─── Signature Upload ─────────────────────────────────────────────────────────

function SignatureUpload({ type, onSaved }: { type: "full" | "initials"; onSaved: () => void }) {
  const toast = useToast();
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.type.match(/^image\/(png|svg\+xml)$/)) { setError(t("setup.pngSvgOnly")); return; }
    if (f.size > 512 * 1024) { setError(t("setup.under512")); return; }
    setFile(f);
    setError(null);
  }

  async function handleSave() {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      await saamApi.upload(type, file);
      toast.success(type === "full" ? t("setup.sigUploaded") : t("setup.initialsUploaded"));
      onSaved();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("setup.uploadFailed"));
      toast.error(type === "full" ? t("setup.sigNotUploaded") : t("setup.initialsNotUploaded"), apiErrorMessage(e, t("setup.uploadFailed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && <ErrorBanner message={error} />}
      <div
        className="rounded-xl border-2 border-dashed border-neutral-200 p-6 text-center cursor-pointer hover:border-primary transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <span className="material-symbols-outlined text-[32px] text-neutral-300 mb-2 block">upload_file</span>
        <p className="text-sm font-medium text-neutral-600">
          {file ? file.name : t("setup.dropHere")}
        </p>
        <p className="text-xs text-neutral-400 mt-1">{t("setup.pngSvgHint")}</p>
        <input ref={inputRef} type="file" accept=".png,.svg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
      {file && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary py-1.5 px-4 text-sm flex items-center gap-1.5 disabled:opacity-40"
        >
          {saving ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> : <span className="material-symbols-outlined text-[16px]">upload</span>}
          {saving ? t("mande.report.uploading") : t("setup.uploadSignature")}
        </button>
      )}
    </div>
  );
}

// ─── Signature Slot (draw or upload, per type) ────────────────────────────────

function SignatureSlot({
  type, label, saved, method, setMethod, onSaved,
}: {
  type: "full" | "initials";
  label: string;
  saved: boolean;
  method: SigMethod;
  setMethod: (m: SigMethod) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  if (saved) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
        <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">{t("setup.slotSaved", { label })}</p>
          <p className="text-xs text-green-600 dark:text-green-400">{type === "full" ? t("setup.sigStored") : t("setup.initialsStored")}</p>
        </div>
        <button
          type="button"
          onClick={() => setMethod("draw")}
          className="text-xs text-green-700 dark:text-green-300 underline hover:no-underline"
        >
          {t("setup.redo")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{label}</p>
        {method === null && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setMethod("draw")}
              className="btn-secondary py-1 px-3 text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">draw</span>{t("setup.draw")}
            </button>
            <button type="button" onClick={() => setMethod("upload")}
              className="btn-secondary py-1 px-3 text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">upload</span>{t("common.upload")}
            </button>
          </div>
        )}
        {method !== null && (
          <button type="button" onClick={() => setMethod(null)}
            className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">close</span>{t("common.cancel")}
          </button>
        )}
      </div>
      {method === null && (
        <div className="rounded-xl border border-dashed border-neutral-200 dark:border-neutral-700 p-6 text-center text-sm text-neutral-400 dark:text-neutral-500">
          {type === "full" ? t("setup.chooseSig") : t("setup.chooseInitials")}
        </div>
      )}
      {method === "draw" && <SignatureCanvas type={type} onSaved={onSaved} />}
      {method === "upload" && <SignatureUpload type={type} onSaved={onSaved} />}
    </div>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function Step1Identity({
  state, update, options, loadError, onNext,
}: {
  state: WizardState;
  update: (p: Partial<WizardState>) => void;
  options: SetupOptions | null;
  loadError: string | null;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const [err, setErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const filteredPositions = options?.positions.filter(
    (p) => !state.departmentId || p.department_id === state.departmentId
  ) ?? [];

  async function handleNext() {
    if (!state.name.trim()) { setErr(t("setup.err.name")); return; }
    if (!state.email.trim()) { setErr(t("setup.err.email")); return; }
    setErr(null);
    setEmailErr(null);
    onNext();
  }

  return (
    <StepCard title={t("setup.s1.title")} description={t("setup.s1.description")} step={1}>
      {loadError && <ErrorBanner message={loadError} />}
      {err && <ErrorBanner message={err} />}
      <div className="space-y-4">
        <div>
          <FieldLabel label={t("setup.field.fullName")} required />
          <input type="text" value={state.name} onChange={(e) => update({ name: e.target.value })}
            className="form-input w-full" placeholder={t("setup.ph.legalName")} />
        </div>
        <div>
          <FieldLabel label={t("setup.field.officialEmail")} required />
          <input type="email" value={state.email} onChange={(e) => update({ email: e.target.value })}
            className={cn("form-input w-full", emailErr && "border-red-400")} placeholder="you@sadcpf.org" /> {/* i18n-ignore */}
          {emailErr && <p className="text-xs text-red-600 mt-1">{emailErr}</p>}
        </div>
        <div>
          <FieldLabel label={t("setup.field.employeeNumber")} />
          <input type="text" value={state.employeeNumber} onChange={(e) => update({ employeeNumber: e.target.value })}
            className="form-input w-full" placeholder={t("setup.ph.employeeNumber")} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label={t("setup.field.department")} />
            <select
              value={state.departmentId ?? ""}
              onChange={(e) => update({ departmentId: e.target.value ? Number(e.target.value) : null, positionId: null })}
              className="form-input w-full"
            >
              <option value="">{t("setup.selectDepartment")}</option>
              {options?.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {!loadError && options && options.departments.length === 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                {t("setup.noDepartments")}
              </p>
            )}
          </div>
          <div>
            <FieldLabel label={t("setup.field.position")} />
            <select
              value={state.positionId ?? ""}
              onChange={(e) => update({ positionId: e.target.value ? Number(e.target.value) : null })}
              className="form-input w-full"
              disabled={!state.departmentId || filteredPositions.length === 0}
            >
              <option value="">{t("setup.selectPosition")}</option>
              {filteredPositions.map((p) => (
                <option key={p.id} value={p.id}>{p.title}{p.grade ? ` (${p.grade})` : ""}</option>
              ))}
            </select>
            {!loadError && state.departmentId && filteredPositions.length === 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                {t("setup.noPositions")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <span className="material-symbols-outlined text-amber-600 text-[16px] mt-0.5">info</span>
          <p className="text-xs text-amber-700">
            {t("setup.s1.notice")}
          </p>
        </div>
      </div>
      <StepFooter onNext={handleNext} nextLabel={t("setup.continue")} nextDisabled={Boolean(loadError)} />
    </StepCard>
  );
}

function Step2Personal({
  state, update, onNext, onBack,
}: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void; onBack: () => void }) {
  const { t } = useI18n();
  const [err, setErr] = useState<string | null>(null);

  async function handleNext() {
    if (!state.phone.trim()) { setErr(t("setup.err.phone")); return; }
    if (!state.addressLine1.trim()) { setErr(t("setup.err.address")); return; }
    if (!state.emergencyContactName.trim()) { setErr(t("setup.err.emergencyName")); return; }
    if (!state.nextOfKin.trim()) { setErr(t("setup.err.relationship")); return; }
    if (!state.emergencyContactPhone.trim()) { setErr(t("setup.err.emergencyPhone")); return; }
    setErr(null);
    onNext();
  }

  return (
    <StepCard title={t("setup.s2.title")} description={t("setup.s2.description")} step={2}>
      {err && <ErrorBanner message={err} />}
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label={t("setup.field.mobile")} required />
            <input type="tel" value={state.phone} onChange={(e) => update({ phone: e.target.value })}
              className="form-input w-full" placeholder="+264 81 000 0000" />
          </div>
          <div>
            <FieldLabel label={t("setup.field.dob")} />
            <input type="date" value={state.dateOfBirth} onChange={(e) => update({ dateOfBirth: e.target.value })}
              className="form-input w-full" />
          </div>
        </div>
        <div>
          <FieldLabel label={t("setup.field.address")} required />
          <input type="text" value={state.addressLine1} onChange={(e) => update({ addressLine1: e.target.value })}
            className="form-input w-full mb-2" placeholder={t("setup.ph.street")} />
          <input type="text" value={state.addressLine2} onChange={(e) => update({ addressLine2: e.target.value })}
            className="form-input w-full mb-2" placeholder={t("setup.ph.address2")} />
          <div className="grid sm:grid-cols-2 gap-2">
            <input type="text" value={state.city} onChange={(e) => update({ city: e.target.value })}
              className="form-input w-full" placeholder={t("setup.ph.city")} />
            <input type="text" value={state.country} onChange={(e) => update({ country: e.target.value })}
              className="form-input w-full" placeholder={t("setup.ph.country")} />
          </div>
        </div>
        <FormSection
          title={t("setup.emergency.title")}
          description={t("setup.emergency.description")}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label={t("setup.field.emergencyName")} required />
              <input type="text" value={state.emergencyContactName} onChange={(e) => update({ emergencyContactName: e.target.value })}
                className="form-input w-full" placeholder={t("setup.ph.fullName")} />
            </div>
            <div>
              <FieldLabel label={t("setup.field.relationship")} required />
              <input type="text" value={state.nextOfKin} onChange={(e) => update({ nextOfKin: e.target.value })}
                className="form-input w-full" placeholder={t("setup.ph.relationship")} />
            </div>
            <div>
              <FieldLabel label={t("setup.field.primaryEmergency")} required />
              <input type="tel" value={state.emergencyContactPhone} onChange={(e) => update({ emergencyContactPhone: e.target.value })}
                className="form-input w-full" placeholder="+264 81 000 0000" />
            </div>
            <div>
              <FieldLabel label={t("setup.field.secondaryEmergency")} />
              <input type="tel" value={state.altContact} onChange={(e) => update({ altContact: e.target.value })}
                className="form-input w-full" placeholder={t("setup.ph.backup")} />
            </div>
          </div>
        </FormSection>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label={t("setup.field.nationality")} />
            <input type="text" value={state.nationality} onChange={(e) => update({ nationality: e.target.value })}
              className="form-input w-full" placeholder={t("setup.ph.nationality")} />
          </div>
          <div>
            <FieldLabel label={t("setup.field.gender")} />
            <select value={state.gender} onChange={(e) => update({ gender: e.target.value })} className="form-input w-full">
              <option value="">{t("correspondence.mailMerge.select")}</option>
              <option value="male">{t("setup.gender.male")}</option>
              <option value="female">{t("setup.gender.female")}</option>
              <option value="other">{t("correspondence.channel.other")}</option>
              <option value="prefer_not_to_say">{t("setup.gender.na")}</option>
            </select>
          </div>
        </div>
      </div>
      <StepFooter onBack={onBack} onNext={handleNext} nextLabel={t("setup.continue")} />
    </StepCard>
  );
}

function Step3Photo({
  state, update, onNext, onBack,
}: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void; onBack: () => void }) {
  const toast = useToast();
  const { t } = useI18n();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(f: File) {
    if (!f.type.startsWith("image/")) { setErr(t("setup.err.image")); return; }
    if (f.size > 5 * 1024 * 1024) { setErr(t("setup.err.image5mb")); return; }
    setErr(null);
    setPhotoFile(f);
    setPreview(createFilePreviewUrl(f));
  }

  async function handleUpload() {
    if (!photoFile) return;
    setUploading(true);
    setErr(null);
    try {
      await profileDocumentsApi.upload(photoFile, "photo", "Profile Photo");
      update({ photoUploaded: true });
      toast.success(t("setup.photoUploaded"));
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("setup.uploadRetry"));
      toast.error(t("setup.photoNotUploaded"), apiErrorMessage(e, t("setup.uploadRetry")));
    } finally {
      setUploading(false);
    }
  }

  return (
    <StepCard title={t("setup.s3.title")} description={t("setup.s3.description")} step={3}>
      {err && <ErrorBanner message={err} />}
      <div className="space-y-6">
        {state.photoUploaded ? (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50 border border-green-200">
            {preview && (
              <img src={preview} alt={t("setup.preview")} className="h-16 w-16 rounded-full object-cover border-2 border-green-300" />
            )}
            <div>
              <p className="text-sm font-semibold text-green-800">{t("setup.photoSuccess")}</p>
              <button type="button" onClick={() => { update({ photoUploaded: false }); setPhotoFile(null); setPreview(null); }}
                className="text-xs text-green-700 underline hover:no-underline mt-0.5">
                {t("setup.changePhotoLower")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            {/* Preview circle */}
            <div
              className="relative h-32 w-32 rounded-full border-4 border-dashed border-neutral-200 bg-neutral-50 overflow-hidden cursor-pointer hover:border-primary transition-colors flex items-center justify-center"
              onClick={() => inputRef.current?.click()}
            >
              {preview ? (
                <img src={preview} alt={t("setup.preview")} className="h-full w-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-[36px] text-neutral-300">person</span>
              )}
            </div>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }} />
            <div className="flex gap-3">
              <button type="button" onClick={() => inputRef.current?.click()}
                className="btn-secondary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                {photoFile ? t("setup.changePhoto") : t("setup.choosePhoto")}
              </button>
              {photoFile && !state.photoUploaded && (
                <button type="button" onClick={handleUpload} disabled={uploading}
                  className="btn-primary flex items-center gap-1.5 disabled:opacity-40">
                  {uploading
                    ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                    : <span className="material-symbols-outlined text-[16px]">cloud_upload</span>}
                  {uploading ? t("mande.report.uploading") : t("common.upload")}
                </button>
              )}
            </div>
            <p className="text-xs text-neutral-400">{t("setup.jpgPngHint")}</p>
          </div>
        )}
      </div>
      <StepFooter onBack={onBack} onNext={onNext} nextDisabled={!state.photoUploaded} nextLabel={t("setup.continue")} />
    </StepCard>
  );
}

function Step4Signatures({
  state, update, onNext, onBack,
}: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void; onBack: () => void }) {
  const { t } = useI18n();
  const [fullMethod, setFullMethod] = useState<SigMethod>(null);
  const [initialsMethod, setInitialsMethod] = useState<SigMethod>(null);

  const bothSaved = state.fullSigSaved && state.initialsSigSaved;

  return (
    <StepCard title={t("setup.s4.title")} description={t("setup.s4.description")} step={4}>
      <div className="space-y-6">
        <SignatureSlot
          type="full"
          label={t("setup.fullSignature")}
          saved={state.fullSigSaved}
          method={fullMethod}
          setMethod={(m) => { setFullMethod(m); if (state.fullSigSaved) update({ fullSigSaved: false }); }}
          onSaved={() => { update({ fullSigSaved: true }); setFullMethod(null); }}
        />
        <div className="border-t border-neutral-100" />
        <SignatureSlot
          type="initials"
          label={t("setup.initials")}
          saved={state.initialsSigSaved}
          method={initialsMethod}
          setMethod={(m) => { setInitialsMethod(m); if (state.initialsSigSaved) update({ initialsSigSaved: false }); }}
          onSaved={() => { update({ initialsSigSaved: true }); setInitialsMethod(null); }}
        />
        {bothSaved && (
          <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl bg-neutral-50 border border-neutral-200">
            <input
              type="checkbox"
              checked={state.sigConfirmed}
              onChange={(e) => update({ sigConfirmed: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className="text-sm text-neutral-700">
              {t("setup.sigConfirm")}
            </span>
          </label>
        )}
      </div>
      <StepFooter
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!bothSaved || !state.sigConfirmed}
        nextLabel={t("setup.continue")}
      />
    </StepCard>
  );
}

function Step5Security({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { t } = useI18n();
  return (
    <StepCard title={t("setup.s5.title")} description={t("setup.s5.description")} step={5}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
          <span className="material-symbols-outlined text-green-600 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <div>
            <p className="text-sm font-semibold text-green-800">{t("setup.passwordConfigured")}</p>
            <p className="text-xs text-green-600">{t("setup.passwordSecure")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
          <span className="material-symbols-outlined text-neutral-500 text-[22px]">shield_lock</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-700">{t("setup.mfa")}</p>
            <p className="text-xs text-neutral-500">
              {t("setup.mfaHint")}
            </p>
          </div>
          <a
            href="/profile/security"
            className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium whitespace-nowrap hover:bg-primary/20 transition-colors"
          >
            {t("setup.setUpMfa")}
          </a>
        </div>
      </div>
      <StepFooter onBack={onBack} onNext={onNext} nextLabel={t("setup.continue")} />
    </StepCard>
  );
}

function Step6Preferences({
  state, update, onNext, onBack,
}: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void; onBack: () => void }) {
  const { setTheme } = useTheme();
  const { t } = useI18n();
  function handleNext() {
    localStorage.setItem("sadcpf_user_prefs", JSON.stringify({
      language: state.language,
      theme: state.theme,
      notifEmail: state.notifEmail,
      notifInApp: state.notifInApp,
    }));
    // Use the same theme-setting logic as ThemeProvider so `data-theme` stays
    // in sync with the `dark` class and localStorage key it reads on load.
    setTheme(state.theme === "dark" ? "dark" : "light");
    onNext();
  }

  return (
    <StepCard title={t("setup.step.preferences")} description={t("setup.s6.description")} step={6}>
      <div className="space-y-6">
        <div>
          <FieldLabel label={t("setup.field.language")} />
          <select value={state.language} onChange={(e) => update({ language: e.target.value })} className="form-input w-full max-w-xs">
            <option value="en">English</option> {/* i18n-ignore */}
            <option value="fr">Français</option> {/* i18n-ignore */}
            <option value="pt">Português</option> {/* i18n-ignore */}
          </select>
        </div>
        <div>
          <FieldLabel label={t("setup.field.theme")} />
          <div className="flex gap-3">
            {[{ value: "light", icon: "light_mode", label: t("setup.light") }, { value: "dark", icon: "dark_mode", label: t("setup.dark") }].map((th) => (
              <button
                key={th.value}
                type="button"
                onClick={() => update({ theme: th.value })}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                  state.theme === th.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                )}
              >
                <span className="material-symbols-outlined text-[18px]">{th.icon}</span>
                {th.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel label={t("setup.field.notifications")} />
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={state.notifEmail} onChange={(e) => update({ notifEmail: e.target.checked })}
                className="h-4 w-4 accent-primary" />
              <span className="text-sm text-neutral-700">{t("setup.emailNotifications")}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={state.notifInApp} onChange={(e) => update({ notifInApp: e.target.checked })}
                className="h-4 w-4 accent-primary" />
              <span className="text-sm text-neutral-700">{t("setup.inAppNotifications")}</span>
            </label>
          </div>
        </div>
      </div>
      <StepFooter onBack={onBack} onNext={handleNext} nextLabel={t("setup.saveContinue")} />
    </StepCard>
  );
}

function Step7Review({
  state, update, options, onSubmit, onBack, submitting,
}: { state: WizardState; update: (p: Partial<WizardState>) => void; options: SetupOptions | null; onSubmit: () => void; onBack: () => void; submitting: boolean }) {
  const deptName = options?.departments.find((d) => d.id === state.departmentId)?.name ?? "—";
  const posName  = options?.positions.find((p) => p.id === state.positionId)?.title ?? "—";
  const address  = [state.addressLine1, state.city, state.country].filter(Boolean).join(", ");
  const { t } = useI18n();
  const genderLabel = state.gender === "male" ? t("setup.gender.male") : state.gender === "female" ? t("setup.gender.female") : state.gender === "other" ? t("correspondence.channel.other") : state.gender === "prefer_not_to_say" ? t("setup.gender.na") : state.gender;

  return (
    <StepCard title={t("setup.s7.title")} description={t("setup.s7.description")} step={7}>
      <div className="space-y-4">
        <ReviewSection title={t("setup.r.identity")} items={[
          [t("setup.field.fullName"), state.name],
          [t("correspondence.contacts.email"), state.email],
          [t("setup.field.employeeNumber"), state.employeeNumber],
          [t("setup.field.department"), deptName],
          [t("setup.field.position"), posName],
        ]} />
        <ReviewSection title={t("setup.s2.title")} items={[
          [t("setup.r.mobile"), state.phone],
          [t("setup.field.gender"), genderLabel],
          [t("setup.field.nationality"), state.nationality],
          [t("setup.field.dob"), state.dateOfBirth],
          [t("setup.r.address"), address],
          [t("setup.emergency.title"), state.emergencyContactName ? `${state.emergencyContactName} · ${state.emergencyContactPhone}` : ""],
        ]} />
        <ReviewSection title={t("setup.emergency.title")} items={[
          [t("setup.r.contactName"), state.emergencyContactName],
          [t("setup.r.relationship"), state.nextOfKin],
          [t("setup.r.primary"), state.emergencyContactPhone],
          [t("setup.r.secondary"), state.altContact],
        ]} />
        <ReviewSection title={t("setup.r.documents")} items={[
          [t("setup.s3.title"), state.photoUploaded ? t("setup.r.uploaded") : t("setup.r.notUploaded")],
          [t("setup.fullSignature"), state.fullSigSaved ? t("setup.r.saved") : t("setup.r.notSaved")],
          [t("setup.initials"), state.initialsSigSaved ? t("setup.r.saved") : t("setup.r.notSaved")],
        ]} />
        <ReviewSection title={t("setup.step.preferences")} items={[
          [t("setup.field.language"), state.language === "en" ? "English" : state.language === "fr" ? "Français" : "Português"], // i18n-ignore
          [t("setup.field.theme"), state.theme === "dark" ? t("setup.dark") : t("setup.light")],
          [t("setup.r.emailNotif"), state.notifEmail ? t("setup.r.enabled") : t("setup.r.disabled")],
          [t("setup.r.inAppNotif"), state.notifInApp ? t("setup.r.enabled") : t("setup.r.disabled")],
        ]} />
        <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl bg-neutral-50 border border-neutral-200">
          <input
            type="checkbox"
            checked={state.reviewConfirmed}
            onChange={(e) => update({ reviewConfirmed: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-sm text-neutral-700">
            {t("setup.reviewConfirm")}
          </span>
        </label>
      </div>
      <div className="flex gap-3 mt-8 pt-6 border-t border-neutral-100">
        <button type="button" onClick={onBack} className="btn-secondary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>{t("common.back")}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!state.reviewConfirmed || submitting}
          className="btn-primary flex-1 justify-center flex items-center gap-2 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>{t("setup.completing")}</>
          ) : (
            <><span className="material-symbols-outlined text-[18px]">check_circle</span>{t("setup.complete")}</>
          )}
        </button>
      </div>
    </StepCard>
  );
}

// ─── Main Wizard Page ─────────────────────────────────────────────────────────

export default function SetupWizardPage() {
  const toast = useToast();
  const { t } = useI18n();
  const [step, setStep] = useState<number>(1);
  const [options, setOptions] = useState<SetupOptions | null>(null);
  const [state, setState] = useState<WizardState>(getInitialState());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // Load options and restore session state + pre-fill from stored user
  useEffect(() => {
    setupApi.getOptions()
      .then((r) => {
        setOptions(r.data);
        setOptionsError(null);
      })
      .catch((e: unknown) => {
        const status = (e as { response?: { status?: number; data?: { message?: string } } })?.response?.status;
        const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setOptionsError(
          status === 401
            ? t("setup.sessionExpired")
            : (message ?? t("setup.optionsFailed"))
        );
      });

    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try { setState(JSON.parse(saved)); } catch { /* ignore */ }
    }

    const storedUser = readStoredUser();
    if (storedUser) {
      setState((prev) => ({
        ...prev,
        name: storedUser.name ?? prev.name,
        email: storedUser.email ?? prev.email,
      }));
    }
  }, []);

  // Persist state to sessionStorage on every change (survives page refresh)
  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  }, [state]);

  function update(partial: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  function next() { setError(null); setStep((s) => Math.min(s + 1, 7)); }
  function back() { setError(null); setStep((s) => Math.max(s - 1, 1)); }

  function validateBeforeSubmit() {
    if (!state.name.trim()) return t("setup.err.name");
    if (!state.email.trim()) return t("setup.err.email");
    if (!state.phone.trim()) return t("setup.err.phone");
    if (!state.addressLine1.trim()) return t("setup.err.address");
    if (!state.emergencyContactName.trim()) return t("setup.err.emergencyName");
    if (!state.nextOfKin.trim()) return t("setup.err.relationship");
    if (!state.emergencyContactPhone.trim()) return t("setup.err.emergencyPhone");
    if (!state.photoUploaded) return t("setup.err.photo");
    if (!state.fullSigSaved || !state.initialsSigSaved) return t("setup.err.signatures");
    if (!state.sigConfirmed) return t("setup.err.sigConfirm");
    if (!state.reviewConfirmed) return t("setup.err.review");
    return null;
  }

  async function handleComplete() {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await setupApi.updateIdentity({
        name: state.name.trim(),
        email: state.email.trim(),
        employee_number: state.employeeNumber || null,
        department_id: state.departmentId,
        position_id: state.positionId,
      });

      await profileApi.update({
        name: state.name.trim(),
        phone: state.phone || null,
        nationality: state.nationality || null,
        gender: state.gender || null,
        emergency_contact_name: state.emergencyContactName || null,
        emergency_contact_phone: state.emergencyContactPhone || null,
        emergency_contact_relationship: state.nextOfKin || null,
        address_line1: state.addressLine1 || null,
        address_line2: state.addressLine2 || null,
        city: state.city || null,
        country: state.country || null,
        date_of_birth: state.dateOfBirth || null,
        bio: state.altContact ? `Alt: ${state.altContact}` : null,
      } as Parameters<typeof profileApi.update>[0]);

      await setupApi.complete();

      const storedUser = readStoredUser();
      if (storedUser) {
        writeStoredUser({
          ...storedUser,
          name: state.name.trim(),
          email: state.email.trim(),
          phone: state.phone || null,
          setup_completed: true,
        });
      }
      setSetupCompleteCookie();
      sessionStorage.removeItem(SESSION_KEY);
      toast.success(t("setup.done"), t("setup.doneDetail"));
      window.location.href = "/dashboard";
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("setup.completeFailed"));
      toast.error(t("setup.notCompleted"), apiErrorMessage(e, t("setup.completeFailed")));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f8] flex flex-col">
      <SetupHeader />

      {/* Stepper */}
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <Stepper steps={STEPS.map((s) => ({ label: t(s.label) }))} currentStep={step} />
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-2xl">
          {error && <ErrorBanner message={error} />}

          {step === 1 && (
            <Step1Identity state={state} update={update} options={options} loadError={optionsError} onNext={next} />
          )}
          {step === 2 && (
            <Step2Personal state={state} update={update} onNext={next} onBack={back} />
          )}
          {step === 3 && (
            <Step3Photo state={state} update={update} onNext={next} onBack={back} />
          )}
          {step === 4 && (
            <Step4Signatures state={state} update={update} onNext={next} onBack={back} />
          )}
          {step === 5 && (
            <Step5Security onNext={next} onBack={back} />
          )}
          {step === 6 && (
            <Step6Preferences state={state} update={update} onNext={next} onBack={back} />
          )}
          {step === 7 && (
            <Step7Review
              state={state}
              update={update}
              options={options}
              onSubmit={handleComplete}
              onBack={back}
              submitting={submitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
