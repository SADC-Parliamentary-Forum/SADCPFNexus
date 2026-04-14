"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  setupApi,
  profileApi,
  profileDocumentsApi,
  saamApi,
  setSetupCompleteCookie,
  setToken,
  type SetupOptions,
} from "@/lib/api";
import { Stepper } from "@/components/ui/Stepper";
import { cn } from "@/lib/utils";

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
  { label: "Identity" },
  { label: "Personal Info" },
  { label: "Photo" },
  { label: "Signatures" },
  { label: "Security" },
  { label: "Preferences" },
  { label: "Review" },
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
  return (
    <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
          Step {step} of 7
        </p>
        <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
        {description && <p className="text-sm text-neutral-500 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function StepFooter({
  onBack, onNext, nextLabel = "Next", nextDisabled = false, saving = false,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  saving?: boolean;
}) {
  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-100">
      {onBack ? (
        <button type="button" onClick={onBack} className="btn-secondary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back
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
          : nextLabel
        }
        {!saving && <span className="material-symbols-outlined text-[16px]">arrow_forward</span>}
      </button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
      <span className="material-symbols-outlined text-[16px] mt-0.5">error_outline</span>
      {message}
    </div>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function ReviewSection({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div className="rounded-xl border border-neutral-100 overflow-hidden">
      <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-100">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</p>
      </div>
      <div className="divide-y divide-neutral-50">
        {items.map(([label, value]) => (
          <div key={label} className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-neutral-500">{label}</span>
            <span className="text-sm font-medium text-neutral-800">{value || "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Setup Header ─────────────────────────────────────────────────────────────

function SetupHeader() {
  return (
    <div className="border-b border-neutral-200 bg-white px-6 py-4">
      <div className="mx-auto max-w-3xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/sadcpf-logo.jpg" alt="SADC-PF" className="h-8 w-auto object-contain" />
          <div>
            <p className="text-sm font-bold text-neutral-900">SADC-PF Nexus</p>
            <p className="text-xs text-neutral-400">Account Setup</p>
          </div>
        </div>
        <p className="text-xs text-neutral-400 hidden sm:block">
          Complete your profile to access the system
        </p>
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

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

  useEffect(() => { initCanvas(); }, [initCanvas]);

  function getPos(canvas: HTMLCanvasElement, e: MouseEvent | TouchEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = (e as TouchEvent).touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: ((e as MouseEvent).clientX - rect.left) * scaleX, y: ((e as MouseEvent).clientY - rect.top) * scaleY };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(canvas, e.nativeEvent as MouseEvent | TouchEvent);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPos.current = pos;
  }

  function onDraw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    e.preventDefault();
    const pos = getPos(canvas, e.nativeEvent as MouseEvent | TouchEvent);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    setHasStrokes(true);
  }

  function endDraw(e: React.MouseEvent | React.TouchEvent) {
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
    if (!canvas || !hasStrokes) { setError("Please draw your signature first."); return; }
    setSaving(true);
    setError(null);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      await saamApi.draw(type, dataUrl);
      onSaved();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save. Please try again.");
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
          onMouseDown={startDraw}
          onMouseMove={onDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={onDraw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={clearCanvas} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">refresh</span>
          Clear
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
          {saving ? "Saving…" : "Save Signature"}
        </button>
      </div>
    </div>
  );
}

// ─── Signature Upload ─────────────────────────────────────────────────────────

function SignatureUpload({ type, onSaved }: { type: "full" | "initials"; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    if (!f.type.match(/^image\/(png|svg\+xml)$/)) { setError("Only PNG or SVG files are accepted."); return; }
    if (f.size > 512 * 1024) { setError("File must be under 512 KB."); return; }
    setFile(f);
    setError(null);
  }

  async function handleSave() {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      await saamApi.upload(type, file);
      onSaved();
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Upload failed.");
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
          {file ? file.name : "Drop file here or click to browse"}
        </p>
        <p className="text-xs text-neutral-400 mt-1">PNG or SVG · max 512 KB</p>
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
          {saving ? "Uploading…" : "Upload Signature"}
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
  if (saved) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
        <span className="material-symbols-outlined text-green-600 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-800">{label} saved</p>
          <p className="text-xs text-green-600">Your {type === "full" ? "signature" : "initials"} has been stored securely.</p>
        </div>
        <button
          type="button"
          onClick={() => setMethod("draw")}
          className="text-xs text-green-700 underline hover:no-underline"
        >
          Re-do
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-700">{label}</p>
        {method === null && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setMethod("draw")}
              className="btn-secondary py-1 px-3 text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">draw</span>Draw
            </button>
            <button type="button" onClick={() => setMethod("upload")}
              className="btn-secondary py-1 px-3 text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">upload</span>Upload
            </button>
          </div>
        )}
        {method !== null && (
          <button type="button" onClick={() => setMethod(null)}
            className="text-xs text-neutral-400 hover:text-neutral-700 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">close</span>Cancel
          </button>
        )}
      </div>
      {method === null && (
        <div className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400">
          Choose a method above to add your {type === "full" ? "signature" : "initials"}
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
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const filteredPositions = options?.positions.filter(
    (p) => !state.departmentId || p.department_id === state.departmentId
  ) ?? [];

  async function handleNext() {
    if (!state.name.trim()) { setErr("Full name is required."); return; }
    if (!state.email.trim()) { setErr("Email is required."); return; }
    setErr(null);
    setEmailErr(null);
    setSaving(true);
    try {
      await setupApi.updateIdentity({
        name:            state.name.trim(),
        email:           state.email.trim(),
        employee_number: state.employeeNumber || null,
        department_id:   state.departmentId,
        position_id:     state.positionId,
      });
      onNext();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const emailMsg = ax.response?.data?.errors?.email?.[0];
      if (emailMsg) setEmailErr(emailMsg);
      setErr(ax.response?.data?.message ?? "Failed to save identity. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepCard title="Identity & Employment Details" description='Please review your details below. Changes are audit-logged. "Please ensure your details are correct. Changes may be subject to administrative review."' step={1}>
      {loadError && <ErrorBanner message={loadError} />}
      {err && <ErrorBanner message={err} />}
      <div className="space-y-4">
        <div>
          <FieldLabel label="Full Name" required />
          <input type="text" value={state.name} onChange={(e) => update({ name: e.target.value })}
            className="form-input w-full" placeholder="Your full legal name" />
        </div>
        <div>
          <FieldLabel label="Official Email" required />
          <input type="email" value={state.email} onChange={(e) => update({ email: e.target.value })}
            className={cn("form-input w-full", emailErr && "border-red-400")} placeholder="you@sadcpf.org" />
          {emailErr && <p className="text-xs text-red-600 mt-1">{emailErr}</p>}
        </div>
        <div>
          <FieldLabel label="Employee Number" />
          <input type="text" value={state.employeeNumber} onChange={(e) => update({ employeeNumber: e.target.value })}
            className="form-input w-full" placeholder="e.g. SADC-0042" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Department" />
            <select
              value={state.departmentId ?? ""}
              onChange={(e) => update({ departmentId: e.target.value ? Number(e.target.value) : null, positionId: null })}
              className="form-input w-full"
            >
              <option value="">Select department…</option>
              {options?.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {!loadError && options && options.departments.length === 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                No departments are configured for your account yet.
              </p>
            )}
          </div>
          <div>
            <FieldLabel label="Position" />
            <select
              value={state.positionId ?? ""}
              onChange={(e) => update({ positionId: e.target.value ? Number(e.target.value) : null })}
              className="form-input w-full"
              disabled={!state.departmentId || filteredPositions.length === 0}
            >
              <option value="">Select position…</option>
              {filteredPositions.map((p) => (
                <option key={p.id} value={p.id}>{p.title}{p.grade ? ` (${p.grade})` : ""}</option>
              ))}
            </select>
            {!loadError && state.departmentId && filteredPositions.length === 0 && (
              <p className="mt-1 text-xs text-neutral-500">
                No positions are available for the selected department.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <span className="material-symbols-outlined text-amber-600 text-[16px] mt-0.5">info</span>
          <p className="text-xs text-amber-700">
            Please ensure your details are correct. Changes are logged for audit purposes and may be subject to administrative review.
          </p>
        </div>
      </div>
      <StepFooter onNext={handleNext} saving={saving} nextLabel="Save & Continue" nextDisabled={Boolean(loadError)} />
    </StepCard>
  );
}

function Step2Personal({
  state, update, onNext, onBack,
}: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void; onBack: () => void }) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleNext() {
    if (!state.phone.trim()) { setErr("Mobile number is required."); return; }
    if (!state.addressLine1.trim()) { setErr("Residential address is required."); return; }
    if (!state.emergencyContactName.trim()) { setErr("Emergency contact name is required."); return; }
    if (!state.emergencyContactPhone.trim()) { setErr("Emergency contact number is required."); return; }
    setErr(null);
    setSaving(true);
    try {
      await profileApi.update({
        phone:                           state.phone || null,
        nationality:                     state.nationality || null,
        gender:                          state.gender || null,
        emergency_contact_name:          state.emergencyContactName || null,
        emergency_contact_phone:         state.emergencyContactPhone || null,
        emergency_contact_relationship:  state.nextOfKin || null,
        address_line1:                   state.addressLine1 || null,
        address_line2:                   state.addressLine2 || null,
        city:                            state.city || null,
        country:                         state.country || null,
        date_of_birth:                   state.dateOfBirth || null,
        bio:                             state.altContact ? `Alt: ${state.altContact}` : null,
      } as Parameters<typeof profileApi.update>[0]);
      onNext();
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <StepCard title="Personal Information" description="This information is kept confidential and used for HR and emergency purposes." step={2}>
      {err && <ErrorBanner message={err} />}
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Mobile Number" required />
            <input type="tel" value={state.phone} onChange={(e) => update({ phone: e.target.value })}
              className="form-input w-full" placeholder="+264 81 000 0000" />
          </div>
          <div>
            <FieldLabel label="Alternative Contact" />
            <input type="tel" value={state.altContact} onChange={(e) => update({ altContact: e.target.value })}
              className="form-input w-full" placeholder="+264 61 000 000" />
          </div>
        </div>
        <div>
          <FieldLabel label="Residential Address" required />
          <input type="text" value={state.addressLine1} onChange={(e) => update({ addressLine1: e.target.value })}
            className="form-input w-full mb-2" placeholder="Street address" />
          <div className="grid sm:grid-cols-2 gap-2">
            <input type="text" value={state.city} onChange={(e) => update({ city: e.target.value })}
              className="form-input w-full" placeholder="City" />
            <input type="text" value={state.country} onChange={(e) => update({ country: e.target.value })}
              className="form-input w-full" placeholder="Country" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Emergency Contact Name" required />
            <input type="text" value={state.emergencyContactName} onChange={(e) => update({ emergencyContactName: e.target.value })}
              className="form-input w-full" placeholder="Full name" />
          </div>
          <div>
            <FieldLabel label="Emergency Contact Number" required />
            <input type="tel" value={state.emergencyContactPhone} onChange={(e) => update({ emergencyContactPhone: e.target.value })}
              className="form-input w-full" placeholder="+264 81 000 0000" />
          </div>
        </div>
        <div>
          <FieldLabel label="Next of Kin / Relationship" />
          <input type="text" value={state.nextOfKin} onChange={(e) => update({ nextOfKin: e.target.value })}
            className="form-input w-full" placeholder="e.g. Spouse, Parent" />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel label="Date of Birth" />
            <input type="date" value={state.dateOfBirth} onChange={(e) => update({ dateOfBirth: e.target.value })}
              className="form-input w-full" />
          </div>
          <div>
            <FieldLabel label="Nationality" />
            <input type="text" value={state.nationality} onChange={(e) => update({ nationality: e.target.value })}
              className="form-input w-full" placeholder="e.g. Namibian" />
          </div>
          <div>
            <FieldLabel label="Gender" />
            <select value={state.gender} onChange={(e) => update({ gender: e.target.value })} className="form-input w-full">
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
        </div>
      </div>
      <StepFooter onBack={onBack} onNext={handleNext} saving={saving} nextLabel="Save & Continue" />
    </StepCard>
  );
}

function Step3Photo({
  state, update, onNext, onBack,
}: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void; onBack: () => void }) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(f: File) {
    if (!f.type.startsWith("image/")) { setErr("Please upload an image file."); return; }
    if (f.size > 5 * 1024 * 1024) { setErr("Image must be under 5 MB."); return; }
    setErr(null);
    setPhotoFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function handleUpload() {
    if (!photoFile) return;
    setUploading(true);
    setErr(null);
    try {
      await profileDocumentsApi.upload(photoFile, "photo", "Profile Photo");
      update({ photoUploaded: true });
    } catch (e: unknown) {
      setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <StepCard title="Profile Photo" description="Upload a clear, recent photo of yourself. This will appear on your profile and official documents." step={3}>
      {err && <ErrorBanner message={err} />}
      <div className="space-y-6">
        {state.photoUploaded ? (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-green-50 border border-green-200">
            {preview && (
              <img src={preview} alt="Preview" className="h-16 w-16 rounded-full object-cover border-2 border-green-300" />
            )}
            <div>
              <p className="text-sm font-semibold text-green-800">Photo uploaded successfully</p>
              <button type="button" onClick={() => { update({ photoUploaded: false }); setPhotoFile(null); setPreview(null); }}
                className="text-xs text-green-700 underline hover:no-underline mt-0.5">
                Change photo
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
                <img src={preview} alt="Preview" className="h-full w-full object-cover" />
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
                {photoFile ? "Change Photo" : "Choose Photo"}
              </button>
              {photoFile && !state.photoUploaded && (
                <button type="button" onClick={handleUpload} disabled={uploading}
                  className="btn-primary flex items-center gap-1.5 disabled:opacity-40">
                  {uploading
                    ? <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                    : <span className="material-symbols-outlined text-[16px]">cloud_upload</span>}
                  {uploading ? "Uploading…" : "Upload"}
                </button>
              )}
            </div>
            <p className="text-xs text-neutral-400">JPG or PNG · max 5 MB</p>
          </div>
        )}
      </div>
      <StepFooter onBack={onBack} onNext={onNext} nextDisabled={!state.photoUploaded} nextLabel="Continue" />
    </StepCard>
  );
}

function Step4Signatures({
  state, update, onNext, onBack,
}: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void; onBack: () => void }) {
  const [fullMethod, setFullMethod] = useState<SigMethod>(null);
  const [initialsMethod, setInitialsMethod] = useState<SigMethod>(null);

  const bothSaved = state.fullSigSaved && state.initialsSigSaved;

  return (
    <StepCard title="Signature & Initials" description="Your signature and initials will be used on official documents, approvals, and correspondence." step={4}>
      <div className="space-y-6">
        <SignatureSlot
          type="full"
          label="Full Signature"
          saved={state.fullSigSaved}
          method={fullMethod}
          setMethod={(m) => { setFullMethod(m); if (state.fullSigSaved) update({ fullSigSaved: false }); }}
          onSaved={() => { update({ fullSigSaved: true }); setFullMethod(null); }}
        />
        <div className="border-t border-neutral-100" />
        <SignatureSlot
          type="initials"
          label="Initials"
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
              I confirm that the signatures above are my own and I authorise their use in official SADC-PF documents and approvals.
            </span>
          </label>
        )}
      </div>
      <StepFooter
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!bothSaved || !state.sigConfirmed}
        nextLabel="Continue"
      />
    </StepCard>
  );
}

function Step5Security({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <StepCard title="Security Setup" description="Your account security status is shown below." step={5}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200">
          <span className="material-symbols-outlined text-green-600 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          <div>
            <p className="text-sm font-semibold text-green-800">Password configured</p>
            <p className="text-xs text-green-600">Your account password has been set and is secure.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-neutral-50 border border-neutral-200">
          <span className="material-symbols-outlined text-neutral-400 text-[22px]">shield_lock</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-600">Multi-Factor Authentication (MFA)</p>
            <p className="text-xs text-neutral-400">MFA configuration will be available in a future update.</p>
          </div>
          <span className="text-xs bg-neutral-200 text-neutral-500 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
            Coming soon
          </span>
        </div>
      </div>
      <StepFooter onBack={onBack} onNext={onNext} nextLabel="Continue" />
    </StepCard>
  );
}

function Step6Preferences({
  state, update, onNext, onBack,
}: { state: WizardState; update: (p: Partial<WizardState>) => void; onNext: () => void; onBack: () => void }) {
  function handleNext() {
    localStorage.setItem("sadcpf_user_prefs", JSON.stringify({
      language: state.language,
      theme: state.theme,
      notifEmail: state.notifEmail,
      notifInApp: state.notifInApp,
    }));
    if (typeof document !== "undefined") {
      if (state.theme === "dark") {
        document.documentElement.classList.add("dark");
        localStorage.setItem("sadcpf_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("sadcpf_theme", "light");
      }
    }
    onNext();
  }

  return (
    <StepCard title="Preferences" description="These are optional and can be changed at any time in your account settings." step={6}>
      <div className="space-y-6">
        <div>
          <FieldLabel label="Language" />
          <select value={state.language} onChange={(e) => update({ language: e.target.value })} className="form-input w-full max-w-xs">
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="pt">Português</option>
          </select>
        </div>
        <div>
          <FieldLabel label="Theme" />
          <div className="flex gap-3">
            {[{ value: "light", icon: "light_mode", label: "Light" }, { value: "dark", icon: "dark_mode", label: "Dark" }].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => update({ theme: t.value })}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                  state.theme === t.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                )}
              >
                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <FieldLabel label="Notifications" />
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={state.notifEmail} onChange={(e) => update({ notifEmail: e.target.checked })}
                className="h-4 w-4 accent-primary" />
              <span className="text-sm text-neutral-700">Email notifications</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={state.notifInApp} onChange={(e) => update({ notifInApp: e.target.checked })}
                className="h-4 w-4 accent-primary" />
              <span className="text-sm text-neutral-700">In-app notifications</span>
            </label>
          </div>
        </div>
      </div>
      <StepFooter onBack={onBack} onNext={handleNext} nextLabel="Save & Continue" />
    </StepCard>
  );
}

function Step7Review({
  state, update, options, onSubmit, onBack, submitting,
}: { state: WizardState; update: (p: Partial<WizardState>) => void; options: SetupOptions | null; onSubmit: () => void; onBack: () => void; submitting: boolean }) {
  const deptName = options?.departments.find((d) => d.id === state.departmentId)?.name ?? "—";
  const posName  = options?.positions.find((p) => p.id === state.positionId)?.title ?? "—";
  const address  = [state.addressLine1, state.city, state.country].filter(Boolean).join(", ");

  return (
    <StepCard title="Review & Confirm" description="Please review all your information before completing setup." step={7}>
      <div className="space-y-4">
        <ReviewSection title="Identity & Employment" items={[
          ["Full Name", state.name],
          ["Email", state.email],
          ["Employee Number", state.employeeNumber],
          ["Department", deptName],
          ["Position", posName],
        ]} />
        <ReviewSection title="Personal Information" items={[
          ["Mobile", state.phone],
          ["Gender", state.gender],
          ["Nationality", state.nationality],
          ["Date of Birth", state.dateOfBirth],
          ["Address", address],
          ["Emergency Contact", state.emergencyContactName ? `${state.emergencyContactName} · ${state.emergencyContactPhone}` : ""],
        ]} />
        <ReviewSection title="Documents" items={[
          ["Profile Photo", state.photoUploaded ? "✓ Uploaded" : "Not uploaded"],
          ["Full Signature", state.fullSigSaved ? "✓ Saved" : "Not saved"],
          ["Initials", state.initialsSigSaved ? "✓ Saved" : "Not saved"],
        ]} />
        <ReviewSection title="Preferences" items={[
          ["Language", state.language === "en" ? "English" : state.language === "fr" ? "Français" : "Português"],
          ["Theme", state.theme === "dark" ? "Dark" : "Light"],
          ["Email Notifications", state.notifEmail ? "Enabled" : "Disabled"],
          ["In-App Notifications", state.notifInApp ? "Enabled" : "Disabled"],
        ]} />
        <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl bg-neutral-50 border border-neutral-200">
          <input
            type="checkbox"
            checked={state.reviewConfirmed}
            onChange={(e) => update({ reviewConfirmed: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span className="text-sm text-neutral-700">
            I confirm that all information entered above is accurate and complete. I understand that providing false information may result in disciplinary action.
          </span>
        </label>
      </div>
      <div className="flex gap-3 mt-8 pt-6 border-t border-neutral-100">
        <button type="button" onClick={onBack} className="btn-secondary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!state.reviewConfirmed || submitting}
          className="btn-primary flex-1 justify-center flex items-center gap-2 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <><span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>Completing…</>
          ) : (
            <><span className="material-symbols-outlined text-[18px]">check_circle</span>Complete Setup &amp; Go to Dashboard</>
          )}
        </button>
      </div>
    </StepCard>
  );
}

// ─── Main Wizard Page ─────────────────────────────────────────────────────────

export default function SetupWizardPage() {
  const [step, setStep] = useState<number>(1);
  const [options, setOptions] = useState<SetupOptions | null>(null);
  const [state, setState] = useState<WizardState>(getInitialState());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // Load options and restore session state + pre-fill from stored user
  useEffect(() => {
    const savedToken = localStorage.getItem("sadcpf_token");
    if (savedToken) {
      setToken(savedToken);
    }

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
            ? "Your session expired before setup data could load. Sign in again to continue."
            : (message ?? "Failed to load departments and positions for setup.")
        );
      });

    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try { setState(JSON.parse(saved)); } catch { /* ignore */ }
    }

    const rawUser = localStorage.getItem("sadcpf_user");
    if (rawUser) {
      try {
        const u = JSON.parse(rawUser);
        setState((prev) => ({
          ...prev,
          name:  u.name  ?? prev.name,
          email: u.email ?? prev.email,
        }));
      } catch { /* ignore */ }
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

  async function handleComplete() {
    setSubmitting(true);
    setError(null);
    try {
      await setupApi.complete();
      // Update the stored user object in localStorage
      const raw = localStorage.getItem("sadcpf_user");
      if (raw) {
        const u = JSON.parse(raw);
        localStorage.setItem("sadcpf_user", JSON.stringify({ ...u, setup_completed: true }));
      }
      setSetupCompleteCookie();
      sessionStorage.removeItem(SESSION_KEY);
      window.location.href = "/dashboard";
    } catch {
      setError("Failed to complete setup. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f8] flex flex-col">
      <SetupHeader />

      {/* Stepper */}
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <Stepper steps={STEPS} currentStep={step} />
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
