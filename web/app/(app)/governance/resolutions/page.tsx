"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFormatDate } from "@/lib/useFormatDate";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { governanceApi, minutesApi, committeeApi, governanceMeetingTypeApi, type GovernanceResolution, type GovernanceDocument, type GovernanceMeeting, type MeetingMinutesRecord, type MeetingActionItem, type GovernanceCommittee, type GovernanceMeetingType } from "@/lib/api";
import api from "@/lib/api";
import type { TenantUserOption } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { TableEmpty, EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: "en" as const, label: "governance.resolutions.lang.en", flag: "🇬🇧" },
  { code: "fr" as const, label: "governance.resolutions.lang.fr", flag: "🇫🇷" },
  { code: "pt" as const, label: "governance.resolutions.lang.pt", flag: "🇵🇹" },
];

const STATUSES = ["Draft", "Adopted", "In Progress", "Pending Review", "Implemented", "Rejected", "Actioned"] as const;
type ResStatus = typeof STATUSES[number];

const STATUS_STYLE: Record<ResStatus, string> = {
  "Draft":          "bg-neutral-100 text-neutral-700 border-neutral-200",
  "Adopted":        "bg-emerald-100 text-emerald-800 border-emerald-200",
  "In Progress":    "bg-blue-100 text-blue-800 border-blue-200",
  "Pending Review": "bg-amber-100 text-amber-800 border-amber-200",
  "Implemented":    "bg-teal-100 text-teal-800 border-teal-200",
  "Rejected":       "bg-red-100 text-red-800 border-red-200",
  "Actioned":       "bg-teal-100 text-teal-800 border-teal-200",
};
const STATUS_DOT: Record<ResStatus, string> = {
  "Draft": "bg-neutral-400", "Adopted": "bg-emerald-500", "In Progress": "bg-blue-500",
  "Pending Review": "bg-amber-500", "Implemented": "bg-teal-500",
  "Rejected": "bg-red-500", "Actioned": "bg-teal-500",
};

// Committees and meeting types are loaded from the API — see committeeApi / governanceMeetingTypeApi

const COMMITTEE_COLORS = ["bg-blue-400", "bg-emerald-400", "bg-purple-400", "bg-amber-400", "bg-teal-400", "bg-rose-400", "bg-indigo-400"];
const committeeColorCache: Record<string, string> = {};
const COMMITTEE_COLOR = new Proxy(committeeColorCache, {
  get: (_, key: string) => committeeColorCache[key] ?? (committeeColorCache[key] = COMMITTEE_COLORS[Object.keys(committeeColorCache).length % COMMITTEE_COLORS.length]),
});

const STATUS_LABEL: Record<ResStatus, string> = {
  "Draft": "governance.status.draft",
  "Adopted": "governance.status.adopted",
  "In Progress": "governance.status.inProgress",
  "Pending Review": "governance.status.pendingReview",
  "Implemented": "governance.status.implemented",
  "Rejected": "governance.status.rejected",
  "Actioned": "governance.status.actioned",
};
function statusLabel(s: string, t: (key: string) => string) {
  const key = STATUS_LABEL[s as ResStatus];
  return key ? t(key) : s;
}
function statusStyle(s: string) { return STATUS_STYLE[s as ResStatus] ?? "bg-neutral-100 text-neutral-700 border-neutral-200"; }
function statusDot(s: string) { return STATUS_DOT[s as ResStatus] ?? "bg-neutral-400"; }
function fmtBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

// ─── Multilingual Document Upload Panel ───────────────────────────────────────

function DocumentsPanel({ resolution, onRefresh }: { resolution: GovernanceResolution; onRefresh: () => void }) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useI18n();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const docsByLang = Object.fromEntries(
    (resolution.documents ?? []).map((d) => [d.language, d])
  ) as Partial<Record<"en" | "fr" | "pt", GovernanceDocument>>;

  const handleUpload = async (lang: "en" | "fr" | "pt") => {
    const input = fileRefs.current[lang];
    if (!input?.files?.[0]) return;
    const file = input.files[0];
    const fd = new FormData();
    fd.append("file", file);
    fd.append("language", lang);
    setUploading((p) => ({ ...p, [lang]: true }));
    try {
      await governanceApi.uploadDocument(resolution.id, fd);
      toast("success", t("governance.resolutions.uploaded"), t("governance.resolutions.docUploaded", { language: t(`governance.resolutions.lang.${lang}`) }));
      input.value = "";
      onRefresh();
    } catch {
      toast("error", t("governance.resolutions.uploadFailed"), t("governance.resolutions.uploadFailedDetail"));
    } finally {
      setUploading((p) => ({ ...p, [lang]: false }));
    }
  };

  const handleDelete = async (lang: "en" | "fr" | "pt", doc: GovernanceDocument) => {
    if (!(await confirm({ title: t("governance.resolutions.removeDocTitle"), message: t("governance.resolutions.removeDocConfirm", { language: t(`governance.resolutions.lang.${lang}`) }), variant: "danger" }))) return;
    try {
      await governanceApi.deleteDocument(resolution.id, doc.id);
      toast("success", t("governance.resolutions.removed"), t("governance.resolutions.docRemoved"));
      onRefresh();
    } catch {
      toast("error", t("governance.resolutions.error"), t("governance.resolutions.removeFailed"));
    }
  };

  const handleDownload = async (doc: GovernanceDocument) => {
    try {
      const res = await api.get(`/governance/resolutions/${resolution.id}/documents/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.original_filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("error", t("governance.resolutions.error"), t("governance.resolutions.downloadFailed"));
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">{t("governance.resolutions.officialDocs")}</p>
      <div className="grid grid-cols-3 gap-3">
        {LANGUAGES.map(({ code, label, flag }) => {
          const doc = docsByLang[code];
          return (
            <div key={code} className={`rounded-xl border p-3 space-y-2 transition-colors ${doc ? "border-primary/30 bg-primary/5" : "border-neutral-200 bg-neutral-50"}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{flag}</span>
                <div>
                  <p className="text-xs font-semibold text-neutral-800">{t(label)}</p>
                  <p className="text-[10px] text-neutral-400 uppercase">{code}</p>
                </div>
                {doc && (
                  <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 10 }}>check</span>
                  </span>
                )}
              </div>
              {doc ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-neutral-700 font-medium truncate leading-tight">{doc.original_filename}</p>
                  <p className="text-[10px] text-neutral-400">{fmtBytes(doc.size_bytes)}</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="flex items-center gap-0.5 rounded px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[13px]">download</span>
                      {t("common.download")}
                    </button>
                    <button
                      onClick={() => handleDelete(code, doc)}
                      aria-label={t("governance.resolutions.deleteFile", { name: doc.original_filename })}
                      className="flex items-center gap-0.5 rounded px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[13px]">delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    ref={(el) => { fileRefs.current[code] = el; }}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={() => handleUpload(code)}
                  />
                  <button
                    onClick={() => fileRefs.current[code]?.click()}
                    disabled={uploading[code]}
                    className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-300 py-2 text-[11px] text-neutral-500 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {uploading[code] ? (
                      <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-[14px]">upload_file</span>
                    )}
                    {uploading[code] ? t("governance.resolutions.uploading") : t("governance.resolutions.uploadPdfDoc")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Resolution Form Modal ────────────────────────────────────────────────────

type ResolutionType = "committee" | "plenary";

interface ResolutionFormProps {
  type: ResolutionType;
  initial?: Partial<GovernanceResolution>;
  committees: GovernanceCommittee[];
  onClose: () => void;
  onSaved: (r: GovernanceResolution) => void;
}

function ResolutionFormModal({ type, initial, committees, onClose, onSaved }: ResolutionFormProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const isEdit = !!initial?.id;
  const [saving, setSaving] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<{ lang: "en" | "fr" | "pt"; file: File }[]>([]);
  const [form, setForm] = useState({
    reference_number: initial?.reference_number ?? "",
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    status: initial?.status ?? "Draft",
    adopted_at: initial?.adopted_at ? initial.adopted_at.slice(0, 10) : "",
    committee: initial?.committee ?? (type === "committee" ? (committees[0]?.name ?? "") : ""),
    lead_member: initial?.lead_member ?? "",
    lead_role: initial?.lead_role ?? "",
  });

  const LANG_OPTIONS = [
    { code: "en" as const, label: t("governance.resolutions.lang.en") },
    { code: "fr" as const, label: t("governance.resolutions.lang.fr") },
    { code: "pt" as const, label: t("governance.resolutions.lang.pt") },
  ];

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const addFile = (lang: "en" | "fr" | "pt", file: File) => {
    setQueuedFiles((p) => [...p.filter((q) => q.lang !== lang), { lang, file }]);
  };

  const removeQueued = (lang: "en" | "fr" | "pt") => {
    setQueuedFiles((p) => p.filter((q) => q.lang !== lang));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reference_number.trim() || !form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        type,
        adopted_at: form.adopted_at || undefined,
        committee: type === "committee" ? form.committee : undefined,
      };
      let res;
      if (isEdit && initial?.id) {
        res = await governanceApi.updateResolution(initial.id, payload);
      } else {
        res = await governanceApi.createResolution(payload);
      }
      const savedId = res.data.data.id;
      // Upload any queued documents
      for (const { lang, file } of queuedFiles) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("language", lang);
        try {
          await governanceApi.uploadDocument(savedId, fd);
        } catch {
          toast("error", t("governance.resolutions.uploadFailed"), t("governance.resolutions.uploadLangFailed", { lang: lang.toUpperCase() }));
        }
      }
      toast("success", isEdit ? t("governance.resolutions.updated") : t("governance.resolutions.created"), isEdit ? t("governance.resolutions.resolutionUpdated") : t("governance.resolutions.resolutionCreated"));
      onSaved(res.data.data);
    } catch (err: unknown) {
      toast("error", t("governance.resolutions.error"), err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : t("governance.resolutions.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">
              {type === "committee" ? "groups" : "account_balance"}
            </span>
            <h2 className="font-semibold text-neutral-900">
              {t(type === "committee" ? (isEdit ? "governance.resolutions.form.editCommittee" : "governance.resolutions.form.newCommittee") : (isEdit ? "governance.resolutions.form.editPlenary" : "governance.resolutions.form.newPlenary"))}
            </h2>
          </div>
          <button onClick={onClose} aria-label={t("governance.resolutions.form.close")} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-hide">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="governance-resolutions-reference-no" className="block text-xs font-semibold text-neutral-700 mb-1">{t("governance.resolutions.form.reference")}</label>
              <input id="governance-resolutions-reference-no" className="form-input" required value={form.reference_number} onChange={(e) => set("reference_number", e.target.value)} placeholder={t("governance.resolutions.form.referencePlaceholder")} />
            </div>
            <div>
              <label htmlFor="governance-resolutions-status" className="block text-xs font-semibold text-neutral-700 mb-1">{t("governance.resolutions.form.status")}</label>
              <select id="governance-resolutions-status" className="form-input" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{t(STATUS_LABEL[s])}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label htmlFor="governance-resolutions-resolution-title" className="block text-xs font-semibold text-neutral-700 mb-1">{t("governance.resolutions.form.title")}</label>
              <input id="governance-resolutions-resolution-title" className="form-input" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t("governance.resolutions.form.titlePlaceholder")} />
            </div>
            {type === "committee" && (
              <div>
                <label htmlFor="governance-resolutions-committee" className="block text-xs font-semibold text-neutral-700 mb-1">{t("governance.resolutions.form.committee")}</label>
                <select id="governance-resolutions-committee" className="form-input" value={form.committee} onChange={(e) => set("committee", e.target.value)}>
                  {committees.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="governance-resolutions-date-of-adoption" className="block text-xs font-semibold text-neutral-700 mb-1">{t("governance.resolutions.form.adoptionDate")}</label>
              <input id="governance-resolutions-date-of-adoption" type="date" className="form-input" value={form.adopted_at} onChange={(e) => set("adopted_at", e.target.value)} />
            </div>
            <div>
              <label htmlFor="governance-resolutions-lead-member" className="block text-xs font-semibold text-neutral-700 mb-1">{t("governance.resolutions.form.leadMember")}</label>
              <input id="governance-resolutions-lead-member" className="form-input" value={form.lead_member} onChange={(e) => set("lead_member", e.target.value)} placeholder={t("governance.resolutions.form.namePlaceholder")} />
            </div>
            <div>
              <label htmlFor="governance-resolutions-role-title" className="block text-xs font-semibold text-neutral-700 mb-1">{t("governance.resolutions.form.role")}</label>
              <input id="governance-resolutions-role-title" className="form-input" value={form.lead_role} onChange={(e) => set("lead_role", e.target.value)} placeholder={t("governance.resolutions.form.rolePlaceholder")} />
            </div>
            <div className="col-span-2">
              <label htmlFor="governance-resolutions-description" className="block text-xs font-semibold text-neutral-700 mb-1">{t("governance.resolutions.form.description")}</label>
              <textarea id="governance-resolutions-description" rows={3} className="form-input resize-none" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("governance.resolutions.form.descriptionPlaceholder")} />
            </div>
          </div>

          {/* Document Upload */}
          <div className="pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-neutral-400 text-[16px]">attach_file</span>
              <p className="text-xs font-semibold text-neutral-700">{t("governance.resolutions.form.attach")} <span className="font-normal text-neutral-400">{t("governance.resolutions.form.attachHint")}</span></p>
            </div>
            <div className="space-y-2">
              {LANG_OPTIONS.map(({ code, label }) => {
                const queued = queuedFiles.find((q) => q.lang === code);
                return (
                  <div key={code} className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
                    <span className="text-xs font-semibold text-neutral-500 w-20 flex-shrink-0">{label}</span>
                    {queued ? (
                      <div className="flex flex-1 items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-green-600 text-[15px]">check_circle</span>
                        <span className="text-xs text-neutral-700 truncate flex-1">{queued.file.name}</span>
                        <button type="button" onClick={() => removeQueued(code)} aria-label={t("governance.resolutions.form.removeQueued")} className="text-neutral-300 hover:text-red-500">
                          <span className="material-symbols-outlined text-[15px]">close</span>
                        </button>
                      </div>
                    ) : (
                      <label htmlFor={`governance-resolutions-upload-file-choose-file-${label }}`} className="flex-1 flex items-center gap-1.5 cursor-pointer text-xs text-primary">
                        <span className="material-symbols-outlined text-[15px]">upload_file</span>
                        {t("governance.resolutions.form.chooseFile")}
                        <input id={`governance-resolutions-upload-file-choose-file-${label }}`} type="file" accept=".pdf,.doc,.docx,.odt" className="sr-only"
                          onChange={(ev) => { if (ev.target.files?.[0]) addFile(code, ev.target.files[0]); ev.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1 border-t border-neutral-100">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
            <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
              {saving ? t("governance.resolutions.saving") : isEdit ? t("governance.resolutions.update") : t("governance.resolutions.form.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Resolution Detail Drawer ─────────────────────────────────────────────────

function ResolutionDrawer({
  resolution, onClose, onEdit, onRefresh,
}: {
  resolution: GovernanceResolution;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { fmt: fmtDate } = useFormatDate();
  const { t } = useI18n();
  const [detail, setDetail] = useState<GovernanceResolution>(resolution);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.get<{ data: GovernanceResolution }>(`/governance/resolutions/${resolution.id}`);
      setDetail(resp.data.data);
      onRefresh();
    } catch { /* keep current */ } finally { setLoading(false); }
  }, [resolution.id, onRefresh]);

  const handleDelete = async () => {
    if (!(await confirm({ title: t("governance.resolutions.deleteTitle"), message: t("governance.resolutions.deleteConfirm", { title: detail.title }), variant: "danger" }))) return; // ship-safe-ignore
    try {
      await governanceApi.deleteResolution(detail.id);
      toast("success", t("governance.resolutions.deleted"), t("governance.resolutions.resolutionDeleted"));
      onClose();
      onRefresh();
    } catch {
      toast("error", t("governance.resolutions.error"), t("governance.resolutions.deleteFailed"));
    }
  };

  const docsCount = (detail.documents ?? []).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-neutral-200">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-xs font-mono text-neutral-400 mb-1">{detail.reference_number ?? "—"}</p>
            <h2 className="font-semibold text-neutral-900 text-base leading-snug">{detail.title}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onEdit} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors border border-neutral-200">
              <span className="material-symbols-outlined text-[14px]">edit</span>{t("common.edit")}
            </button>
            <button onClick={handleDelete} aria-label={t("governance.resolutions.drawer.delete")} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors border border-red-200">
              <span className="material-symbols-outlined text-[14px]">delete</span>
            </button>
            <button onClick={onClose} aria-label={t("governance.resolutions.drawer.close")} className="text-neutral-400 hover:text-neutral-600 ml-1">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Status + Date row */}
          <div className="flex flex-wrap gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusStyle(detail.status)}`}>
              <span className={`size-1.5 rounded-full ${statusDot(detail.status)}`} />{statusLabel(detail.status, t)}
            </span>
            {detail.adopted_at && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
                <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                {t("governance.resolutions.drawer.adopted", { date: fmtDate(detail.adopted_at) })}
              </span>
            )}
            {detail.committee && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
                <span className={`size-2 rounded-full ${COMMITTEE_COLOR[detail.committee] ?? "bg-neutral-400"}`} />
                {detail.committee}
              </span>
            )}
          </div>

          {/* Lead Member */}
          {detail.lead_member && (
            <div className="flex items-center gap-3 rounded-xl bg-neutral-50 border border-neutral-200 p-3">
              <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                {detail.lead_member.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-800">{detail.lead_member}</p>
                {detail.lead_role && <p className="text-xs text-neutral-500">{detail.lead_role}</p>}
              </div>
            </div>
          )}

          {/* Description */}
          {detail.description && (
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">{t("governance.resolutions.form.description")}</p>
              <p className="text-sm text-neutral-700 leading-relaxed">{detail.description}</p>
            </div>
          )}

          {/* Documents */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {t("governance.resolutions.officialDocs")}
                {docsCount > 0 && (
                  <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-white text-[10px] px-1">{docsCount}/3</span>
                )}
              </p>
              {loading && <span className="material-symbols-outlined animate-spin text-neutral-400 text-[16px]">progress_activity</span>}
            </div>
            <DocumentsPanel resolution={detail} onRefresh={refresh} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Colour swatches for committee picker ─────────────────────────────────────

const COLOR_SWATCHES = [
  "#3b82f6", "#f43f5e", "#f59e0b", "#6366f1",
  "#a855f7", "#f97316", "#14b8a6", "#ec4899",
  "#10b981", "#64748b", "#ef4444", "#0ea5e9",
];

const COLOR_SWATCH_NAMES: Record<string, string> = {
  "#3b82f6": "governance.resolutions.color.blue",
  "#f43f5e": "governance.resolutions.color.rose",
  "#f59e0b": "governance.resolutions.color.amber",
  "#6366f1": "governance.resolutions.color.indigo",
  "#a855f7": "governance.resolutions.color.purple",
  "#f97316": "governance.resolutions.color.orange",
  "#14b8a6": "governance.resolutions.color.teal",
  "#ec4899": "governance.resolutions.color.pink",
  "#10b981": "governance.resolutions.color.emerald",
  "#64748b": "governance.resolutions.color.slate",
  "#ef4444": "governance.resolutions.color.red",
  "#0ea5e9": "governance.resolutions.color.sky",
};

// ─── Manage Committees Modal ──────────────────────────────────────────────────

function ManageCommitteesModal({
  committees: initial,
  onClose,
  onChanged,
}: {
  committees: GovernanceCommittee[];
  onClose: () => void;
  onChanged: (updated: GovernanceCommittee[]) => void;
}) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useI18n();
  const [items, setItems] = useState<GovernanceCommittee[]>(initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_SWATCHES[0]);
  const [saving, setSaving] = useState(false);

  const startEdit = (c: GovernanceCommittee) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color);
  };

  const saveEdit = async () => {
    if (!editName.trim() || editingId === null) return;
    setSaving(true);
    try {
      const res = await committeeApi.update(editingId, { name: editName.trim(), color: editColor });
      const updated = items.map((i) => (i.id === editingId ? res.data.data : i));
      setItems(updated);
      onChanged(updated);
      setEditingId(null);
    } catch {
      toast("error", t("governance.resolutions.error"), t("governance.resolutions.committeeUpdateFailed"));
    } finally {
      setSaving(false); }
  };

  const deleteItem = async (c: GovernanceCommittee) => {
    if (!(await confirm({ title: t("governance.resolutions.deleteCommitteeTitle"), message: t("governance.resolutions.deleteCommitteeConfirm", { name: c.name }), variant: "danger" }))) return; // ship-safe-ignore
    try {
      await committeeApi.remove(c.id);
      const updated = items.filter((i) => i.id !== c.id);
      setItems(updated);
      onChanged(updated);
    } catch {
      toast("error", t("governance.resolutions.error"), t("governance.resolutions.committeeDeleteFailed"));
    }
  };

  const addNew = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await committeeApi.create({ name: newName.trim(), color: newColor, sort_order: items.length });
      const updated = [...items, res.data.data];
      setItems(updated);
      onChanged(updated);
      setNewName("");
      setNewColor(COLOR_SWATCHES[0]);
    } catch {
      toast("error", t("governance.resolutions.error"), t("governance.resolutions.committeeAddFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl flex flex-col" style={{ maxHeight: "85vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">settings</span>
            <h2 className="font-semibold text-neutral-900">{t("governance.resolutions.manageCommittees")}</h2>
          </div>
          <button onClick={onClose} aria-label={t("governance.resolutions.closeCommitteeManager")} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {items.map((c) => (
            <div key={c.id} className="flex items-center gap-2 py-2 border-b border-neutral-100 last:border-0">
              {editingId === c.id ? (
                <>
                  <div className="flex gap-1 flex-wrap">
                    {COLOR_SWATCHES.map((sw) => (
                      <button key={sw} onClick={() => setEditColor(sw)}
                        aria-label={COLOR_SWATCH_NAMES[sw] ? t(COLOR_SWATCH_NAMES[sw]) : sw}
                        aria-pressed={editColor === sw}
                        className={`size-5 rounded-full border-2 transition-transform ${editColor === sw ? "border-neutral-800 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: sw }} />
                    ))}
                  </div>
                  <input autoFocus className="form-input flex-1 text-sm py-1"
                    value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }} />
                  <button onClick={saveEdit} disabled={saving} className="btn-primary px-3 py-1 text-xs">{t("common.save")}</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary px-3 py-1 text-xs">{t("common.cancel")}</button>
                </>
              ) : (
                <>
                  <div className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 text-sm text-neutral-800">{c.name}</span>
                  <button onClick={() => startEdit(c)} className="text-neutral-400 hover:text-primary p-1 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button onClick={() => deleteItem(c)} aria-label={t("governance.resolutions.deleteItem", { name: c.name })} className="text-neutral-400 hover:text-red-500 p-1 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <EmptyState icon="groups" title={t("governance.resolutions.noCommittees")} className="py-8 min-h-0" />
          )}
        </div>

        {/* Add new */}
        <div className="px-5 py-4 border-t border-neutral-200 space-y-3 shrink-0">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{t("governance.resolutions.addCommittee")}</p>
          <div className="flex gap-1 flex-wrap">
            {COLOR_SWATCHES.map((sw) => (
              <button key={sw} onClick={() => setNewColor(sw)}
                aria-label={COLOR_SWATCH_NAMES[sw] ? t(COLOR_SWATCH_NAMES[sw]) : sw}
                aria-pressed={newColor === sw}
                className={`size-5 rounded-full border-2 transition-transform ${newColor === sw ? "border-neutral-800 scale-110" : "border-transparent"}`}
                style={{ backgroundColor: sw }} />
            ))}
          </div>
          <div className="flex gap-2">
            <input className="form-input flex-1 text-sm" placeholder={t("governance.resolutions.committeeNamePlaceholder")}
              value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addNew(); }} />
            <button onClick={addNew} disabled={saving || !newName.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {t("governance.resolutions.add")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Manage Meeting Types Modal ───────────────────────────────────────────────

function ManageMeetingTypesModal({
  meetingTypes: initial,
  onClose,
  onChanged,
}: {
  meetingTypes: GovernanceMeetingType[];
  onClose: () => void;
  onChanged: (updated: GovernanceMeetingType[]) => void;
}) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { t } = useI18n();
  const [items, setItems] = useState<GovernanceMeetingType[]>(initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (mt: GovernanceMeetingType) => {
    setEditingId(mt.id);
    setEditName(mt.name);
  };

  const saveEdit = async () => {
    if (!editName.trim() || editingId === null) return;
    setSaving(true);
    try {
      const res = await governanceMeetingTypeApi.update(editingId, { name: editName.trim() });
      const updated = items.map((i) => (i.id === editingId ? res.data.data : i));
      setItems(updated);
      onChanged(updated);
      setEditingId(null);
    } catch {
      toast("error", t("governance.resolutions.error"), t("governance.resolutions.typeUpdateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (mt: GovernanceMeetingType) => {
    if (!(await confirm({ title: t("governance.resolutions.deleteTypeTitle"), message: t("governance.resolutions.deleteTypeConfirm", { name: mt.name }), variant: "danger" }))) return; // ship-safe-ignore
    try {
      await governanceMeetingTypeApi.remove(mt.id);
      const updated = items.filter((i) => i.id !== mt.id);
      setItems(updated);
      onChanged(updated);
    } catch {
      toast("error", t("governance.resolutions.error"), t("governance.resolutions.typeDeleteFailed"));
    }
  };

  const addNew = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await governanceMeetingTypeApi.create({ name: newName.trim(), sort_order: items.length });
      const updated = [...items, res.data.data];
      setItems(updated);
      onChanged(updated);
      setNewName("");
    } catch {
      toast("error", t("governance.resolutions.error"), t("governance.resolutions.typeAddFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl flex flex-col" style={{ maxHeight: "80vh" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">settings</span>
            <h2 className="font-semibold text-neutral-900">{t("governance.resolutions.manageTypes")}</h2>
          </div>
          <button onClick={onClose} aria-label={t("governance.resolutions.closeTypeManager")} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {items.map((mt) => (
            <div key={mt.id} className="flex items-center gap-2 py-2 border-b border-neutral-100 last:border-0">
              {editingId === mt.id ? (
                <>
                  <input autoFocus className="form-input flex-1 text-sm py-1"
                    value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }} />
                  <button onClick={saveEdit} disabled={saving} className="btn-primary px-3 py-1 text-xs">{t("common.save")}</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary px-3 py-1 text-xs">{t("common.cancel")}</button>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-neutral-400 text-[16px]">event_note</span>
                  <span className="flex-1 text-sm text-neutral-800">{mt.name}</span>
                  <button onClick={() => startEdit(mt)} className="text-neutral-400 hover:text-primary p-1 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button onClick={() => deleteItem(mt)} aria-label={t("governance.resolutions.deleteItem", { name: mt.name })} className="text-neutral-400 hover:text-red-500 p-1 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <EmptyState icon="event_note" title={t("governance.resolutions.noTypes")} className="py-8 min-h-0" />
          )}
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 space-y-2 shrink-0">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{t("governance.resolutions.addType")}</p>
          <div className="flex gap-2">
            <input className="form-input flex-1 text-sm" placeholder={t("governance.resolutions.typePlaceholder")}
              value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addNew(); }} />
            <button onClick={addNew} disabled={saving || !newName.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {t("governance.resolutions.add")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Resolutions List (shared by Committee + Plenary) ────────────────────────

function ResolutionsList({ type }: { type: ResolutionType }) {
  const { fmt: fmtDate } = useFormatDate();
  const { t, localeTag } = useI18n();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [resolutions, setResolutions] = useState<GovernanceResolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingResolution, setEditingResolution] = useState<GovernanceResolution | null>(null);
  const [viewingResolution, setViewingResolution] = useState<GovernanceResolution | null>(null);
  const [committees, setCommittees] = useState<GovernanceCommittee[]>([]);
  const [showManageCommittees, setShowManageCommittees] = useState(false);
  const { toast } = useToast();

  // Load committees once (only needed for committee tab)
  useEffect(() => {
    if (type !== "committee") return;
    committeeApi.list().then((r) => setCommittees(r.data.data ?? [])).catch(() => {});
  }, [type]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await governanceApi.resolutions({
        per_page: 20, page, type,
        ...(statusFilter ? { status: statusFilter } : {}),
      });
      const p = res.data;
      setResolutions(p.data ?? []);
      setLastPage(p.last_page ?? 1);
      setTotal(p.total ?? 0);
    } catch {
      setResolutions([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, type]);

  useEffect(() => { load(); }, [load]);

  const filtered = resolutions.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.reference_number ?? "").toLowerCase().includes(q)
      || (r.title ?? "").toLowerCase().includes(q)
      || (r.committee ?? "").toLowerCase().includes(q)
      || (r.lead_member ?? "").toLowerCase().includes(q);
  });

  const handleSaved = (r: GovernanceResolution) => {
    setShowForm(false);
    setEditingResolution(null);
    if (viewingResolution?.id === r.id) setViewingResolution(r);
    load();
  };

  const isCommittee = type === "committee";

  const handleExport = () => {
    if (filtered.length === 0) {
      toast("error", t("governance.resolutions.nothingToExport"), t("governance.resolutions.noMatching"));
      return;
    }
    exportToCsv(
      `${isCommittee ? "committee" : "plenary"}-resolutions-${new Date().toISOString().slice(0, 10)}`,
      filtered as unknown as Record<string, unknown>[],
      [
        { key: "reference_number", header: t("governance.resolutions.col.reference") },
        { key: "title", header: t("governance.resolutions.col.title") },
        { key: "status", header: t("governance.resolutions.col.status") },
        { key: "committee", header: t("governance.resolutions.col.committee") },
        { key: "lead_member", header: t("governance.resolutions.col.leadMember") },
        { key: "lead_role", header: t("governance.resolutions.col.leadRole") },
        { key: "adopted_at", header: t("governance.resolutions.col.adoptedAt") },
      ]
    );
    toast("success", t("governance.resolutions.exported"), t("governance.resolutions.exportedDetail"));
  };

  const handleOfficialReport = () => {
    if (filtered.length === 0) {
      toast("error", t("governance.resolutions.nothingToReport"), t("governance.resolutions.noMatching"));
      return;
    }
    const win = window.open("", "_blank");
    if (!win) {
      toast("error", t("governance.resolutions.popupBlocked"), t("governance.resolutions.popupBlockedDetail"));
      return;
    }
    const rows = filtered.map((r) => `
      <tr>
        <td>${r.reference_number ?? "—"}</td>
        <td>${r.title}</td>
        <td>${statusLabel(r.status, t)}</td>
        <td>${r.lead_member ?? "—"}</td>
        <td>${r.adopted_at ? fmtDate(r.adopted_at) : "—"}</td>
      </tr>`).join(""); // i18n-ignore
    win.document.write(`
      <html>
        <head>
          <title>${t("governance.resolutions.reportTitle")}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #1a1a1a; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            p.subtitle { color: #666; margin-top: 0; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>${t("governance.resolutions.reportTitle")}</h1>
          <p class="subtitle">${t("governance.resolutions.reportGenerated", { date: new Date().toLocaleDateString(localeTag, { day: "numeric", month: "long", year: "numeric" }) })}</p>
          <table>
            <thead><tr><th>${t("governance.resolutions.col.reference")}</th><th>${t("governance.resolutions.col.title")}</th><th>${t("governance.resolutions.col.status")}</th><th>${t("governance.resolutions.col.leadMember")}</th><th>${t("governance.resolutions.col.adopted")}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-5">
      {/* Sub-header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <p className="page-subtitle">
          {isCommittee
            ? t("governance.resolutions.committeeSubtitle")
            : t("governance.resolutions.plenarySubtitle")}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowManageCommittees(true)} className={`btn-secondary px-3 py-2 text-sm flex items-center gap-1.5 ${isCommittee ? "" : "hidden"}`}>
            <span className="material-symbols-outlined text-[16px]">settings</span>{t("governance.resolutions.committees")}
          </button>
          <button onClick={handleOfficialReport} className={`btn-secondary px-3 py-2 text-xs flex items-center gap-1 ${isCommittee ? "hidden" : ""}`}>
            <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>{t("governance.resolutions.officialReport")}
          </button>
          <button onClick={handleExport} className={`btn-secondary px-3 py-2 text-xs flex items-center gap-1 ${isCommittee ? "hidden" : ""}`}>
            <span className="material-symbols-outlined text-[16px]">download</span>{t("governance.resolutions.export")}
          </button>
          <button onClick={() => { setEditingResolution(null); setShowForm(true); }} className="btn-primary px-4 py-2 text-sm flex items-center gap-2 whitespace-nowrap">
            <span className="material-symbols-outlined text-[18px]">add</span>{t("governance.resolutions.newResolution")}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 text-[20px]">search</span>
          <input className="form-input pl-10" placeholder={isCommittee ? t("governance.resolutions.searchCommittee") : t("governance.resolutions.searchPlenary")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {["", ...STATUSES].map((s) => (
            <button key={s || "all"} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`filter-tab ${statusFilter === s ? "active" : ""}`}>
              {s ? statusLabel(s, t) : t("governance.status.all")}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-neutral-300 text-[28px]">progress_activity</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("governance.resolutions.col.reference")}</th>
                  <th>{t("governance.resolutions.col.title")}</th>
                  {isCommittee && <th>{t("governance.resolutions.col.committee")}</th>}
                  <th>{t("governance.resolutions.col.leadMember")}</th>
                  <th>{t("governance.resolutions.col.adopted")}</th>
                  <th>{t("governance.resolutions.col.docs")}</th>
                  <th>{t("governance.resolutions.col.status")}</th>
                  <th className="text-right">{t("governance.resolutions.col.action")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/60">
                    <td className="font-mono text-sm text-neutral-500 whitespace-nowrap">{r.reference_number ?? "—"}</td>
                    <td className="font-medium text-neutral-900 max-w-[200px]">
                      <p className="truncate">{r.title}</p>
                      {r.description && <p className="text-xs text-neutral-400 truncate">{r.description}</p>}
                    </td>
                    {isCommittee && (
                      <td>
                        {r.committee ? (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="size-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: committees.find((c) => c.name === r.committee)?.color ?? "#94a3b8" }}
                            />
                            <span className="text-neutral-600 text-sm">{r.committee}</span>
                          </div>
                        ) : <span className="text-neutral-400">—</span>}
                      </td>
                    )}
                    <td>
                      {r.lead_member ? (
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {r.lead_member.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </div>
                          <span className="text-sm text-neutral-700">{r.lead_member}</span>
                        </div>
                      ) : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="text-neutral-600 whitespace-nowrap text-sm">{fmtDate(r.adopted_at)}</td>
                    <td>
                      {(r.documents ?? []).length > 0 ? (
                        <div className="flex gap-0.5">
                          {LANGUAGES.map(({ code, flag }) => {
                            const has = (r.documents ?? []).some((d) => d.language === code);
                            return (
                              <span key={code} title={has ? t("governance.resolutions.versionUploaded", { lang: code.toUpperCase() }) : t("governance.resolutions.noVersion", { lang: code.toUpperCase() })}
                                className={`text-base ${has ? "opacity-100" : "opacity-20 grayscale"}`}>{flag}</span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">{t("governance.resolutions.none")}</span>
                      )}
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle(r.status)}`}>
                        <span className={`size-1.5 rounded-full ${statusDot(r.status)}`} />{statusLabel(r.status, t)}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setViewingResolution(r)}
                        className="text-sm font-medium text-primary hover:text-blue-700 transition-colors"
                      >
                        {t("governance.resolutions.view")}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <TableEmpty colSpan={isCommittee ? 8 : 7} icon="description" title={t("governance.resolutions.empty")} />
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-100 bg-neutral-50">
          <p className="text-sm text-neutral-500">{t(total === 1 ? "governance.resolutions.showingOne" : "governance.resolutions.showingMany", { shown: filtered.length, total })}</p>
          <div className="flex gap-2">
            <button className="btn-secondary px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("common.previous")}</button>
            <button className="btn-secondary px-3 py-1.5 text-xs" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</button>
          </div>
        </div>
      </div>

      {/* Create / Edit Form Modal */}
      {(showForm || editingResolution) && (
        <ResolutionFormModal
          type={type}
          initial={editingResolution ?? undefined}
          committees={committees}
          onClose={() => { setShowForm(false); setEditingResolution(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Manage Committees Modal */}
      {showManageCommittees && (
        <ManageCommitteesModal
          committees={committees}
          onClose={() => setShowManageCommittees(false)}
          onChanged={(updated) => setCommittees(updated)}
        />
      )}

      {/* Detail Drawer */}
      {viewingResolution && (
        <ResolutionDrawer
          resolution={viewingResolution}
          onClose={() => setViewingResolution(null)}
          onEdit={() => { setEditingResolution(viewingResolution); setShowForm(false); }}
          onRefresh={load}
        />
      )}
    </div>
  );
}

// ─── Meeting Minutes Tab ──────────────────────────────────────────────────────

// Meeting type display helpers — types are stored by name, display as-is
function meetingTypeLabel(t: string) { return t; }
function meetingTypeColor(_t: string) { return "bg-blue-50 text-blue-700"; }
const ACTION_STATUS_STYLE: Record<string, string> = {
  open: "bg-neutral-100 text-neutral-600", in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700", cancelled: "bg-red-100 text-red-600",
};

// ── Record / Edit Meeting Modal ───────────────────────────────────────────────
function MeetingFormModal({
  existing,
  meetingTypes,
  onClose,
  onSaved,
}: {
  existing?: MeetingMinutesRecord;
  meetingTypes: GovernanceMeetingType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);

  const defaultType = meetingTypes[0]?.name ?? "";
  const initialType = existing?.meeting_type ?? defaultType;

  const [form, setForm] = useState({
    title: existing?.title ?? "",
    meeting_date: existing?.meeting_date ?? "",
    location: existing?.location ?? "",
    meeting_type: initialType,
    chairperson: existing?.chairperson ?? "",
    attendeesText: (existing?.attendees ?? []).join("\n"),
    apologiesText: (existing?.apologies ?? []).join("\n"),
    notes: existing?.notes ?? "",
  });

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setQueuedFiles((p) => [...p, ...Array.from(files)]);
  };

  const removeQueued = (idx: number) => setQueuedFiles((p) => p.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!form.title.trim() || !form.meeting_date) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        meeting_date: form.meeting_date,
        location: form.location || undefined,
        meeting_type: form.meeting_type,
        chairperson: form.chairperson || undefined,
        attendees: form.attendeesText.split("\n").map((s) => s.trim()).filter(Boolean),
        apologies: form.apologiesText.split("\n").map((s) => s.trim()).filter(Boolean),
        notes: form.notes || undefined,
      };
      let savedId: number;
      if (existing) {
        await minutesApi.update(existing.id, payload);
        savedId = existing.id;
        toast("success", t("governance.resolutions.updated"), t("governance.resolutions.minutesUpdated"));
      } else {
        const res = await minutesApi.create(payload);
        savedId = res.data.data.id;
        toast("success", t("governance.resolutions.created"), t("governance.resolutions.minutesRecorded"));
      }
      // Upload queued documents
      for (const file of queuedFiles) {
        const fd = new FormData();
        fd.append("file", file);
        try {
          await minutesApi.uploadDocument(savedId, fd);
        } catch {
          toast("error", t("governance.resolutions.uploadFailed"), t("governance.resolutions.uploadFileFailed", { name: file.name }));
        }
      }
      onSaved();
    } catch {
      toast("error", t("governance.resolutions.error"), t("governance.resolutions.minutesSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const F = ({ label, required, htmlFor }: { label: string; required?: boolean; htmlFor: string }) => (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-neutral-700 mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      {/* flex-col so header/footer are fixed and only body scrolls */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "92vh" }}>

        {/* ── Header (fixed) ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 shrink-0">
          <h3 className="font-semibold text-neutral-900">
            {existing ? t("governance.resolutions.meetingForm.edit") : t("governance.resolutions.meetingForm.record")}
          </h3>
          <button onClick={onClose} aria-label={t("governance.resolutions.meetingForm.close")} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── Body (scrollable only if needed) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: "none" }}>

          {/* Row 1: Title */}
          <div>
            <F label={t("governance.resolutions.meetingForm.title")} required htmlFor="gov-minutes-title" />
            <input id="gov-minutes-title" className="form-input" placeholder={t("governance.resolutions.meetingForm.titlePlaceholder")}
              value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </div>

          {/* Row 2: Date + Meeting Type + custom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <F label={t("governance.resolutions.meetingForm.date")} required htmlFor="gov-minutes-date" />
              <input id="gov-minutes-date" type="date" className="form-input" value={form.meeting_date}
                onChange={(e) => setForm((p) => ({ ...p, meeting_date: e.target.value }))} />
            </div>
            <div>
              <F label={t("governance.resolutions.meetingForm.type")} htmlFor="gov-minutes-type" />
              <select id="gov-minutes-type" className="form-input" value={form.meeting_type}
                onChange={(e) => setForm((p) => ({ ...p, meeting_type: e.target.value }))}>
                {meetingTypes.map((mt) => (
                  <option key={mt.id} value={mt.name}>{mt.name}</option>
                ))}
              </select>
            </div>
          </div>


          {/* Row 3: Location + Chairperson */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <F label={t("governance.resolutions.meetingForm.location")} htmlFor="gov-minutes-location" />
              <input id="gov-minutes-location" className="form-input" placeholder={t("governance.resolutions.meetingForm.locationPlaceholder")}
                value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
            <div>
              <F label={t("governance.resolutions.meetingForm.chair")} htmlFor="gov-minutes-chair" />
              <input id="gov-minutes-chair" className="form-input" placeholder={t("governance.resolutions.meetingForm.chairPlaceholder")}
                value={form.chairperson} onChange={(e) => setForm((p) => ({ ...p, chairperson: e.target.value }))} />
            </div>
          </div>

          {/* Row 4: Attendees + Apologies side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <F label={t("governance.resolutions.meetingForm.attendees")} htmlFor="gov-minutes-attendees" />
              <textarea id="gov-minutes-attendees" rows={4} className="form-input resize-none font-mono text-xs"
                placeholder={"Ronald Windwaai\nJane Smith\n..."} // i18n-ignore
                value={form.attendeesText}
                onChange={(e) => setForm((p) => ({ ...p, attendeesText: e.target.value }))} />
            </div>
            <div>
              <F label={t("governance.resolutions.meetingForm.apologies")} htmlFor="gov-minutes-apologies" />
              <textarea id="gov-minutes-apologies" rows={4} className="form-input resize-none font-mono text-xs"
                placeholder={t("governance.resolutions.meetingForm.apologiesPlaceholder")}
                value={form.apologiesText}
                onChange={(e) => setForm((p) => ({ ...p, apologiesText: e.target.value }))} />
            </div>
          </div>

          {/* Row 5: Notes */}
          <div>
            <F label={t("governance.resolutions.meetingForm.notes")} htmlFor="gov-minutes-notes" />
            <textarea id="gov-minutes-notes" rows={4} className="form-input resize-none"
              placeholder={t("governance.resolutions.meetingForm.notesPlaceholder")}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>

          {/* Row 6: Document attachments */}
          <div className="pt-1 border-t border-neutral-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-neutral-400 text-[16px]">attach_file</span>
              <p className="text-xs font-semibold text-neutral-700">{t("governance.resolutions.meetingForm.attachments")} <span className="font-normal text-neutral-400">{t("governance.resolutions.meetingForm.attachmentsHint")}</span></p>
            </div>
            <label htmlFor="governance-resolutions-upload-file-click-to-add-files-pdf-doc-docx-odt" className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-neutral-300 px-4 py-3 hover:border-primary/50 hover:bg-primary/5 transition-colors">
              <span className="material-symbols-outlined text-primary text-[20px]">upload_file</span>
              <span className="text-xs text-neutral-600">{t("governance.resolutions.meetingForm.clickToAdd")} <span className="text-neutral-400">(PDF, DOC, DOCX, ODT)</span></span>
              <input id="governance-resolutions-upload-file-click-to-add-files-pdf-doc-docx-odt" type="file" accept=".pdf,.doc,.docx,.odt" multiple className="sr-only"
                onChange={(ev) => { addFiles(ev.target.files); ev.target.value = ""; }} />
            </label>
            {queuedFiles.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {queuedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-1.5">
                    <span className="material-symbols-outlined text-primary text-[15px]">description</span>
                    <span className="text-xs text-neutral-700 flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-neutral-400">{f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / 1048576).toFixed(1)} MB`}</span>
                    <button type="button" onClick={() => removeQueued(i)} aria-label={t("governance.resolutions.removeFile", { name: f.name })} className="text-neutral-300 hover:text-red-500">
                      <span className="material-symbols-outlined text-[15px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer (fixed) ── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100 shrink-0">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim() || !form.meeting_date}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
            {saving ? t("governance.resolutions.saving") : existing ? t("governance.resolutions.saveChanges") : t("governance.resolutions.meetingForm.recordMinutes")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Meeting Detail Drawer ─────────────────────────────────────────────────────
function MeetingDrawer({
  meeting: initialMeeting,
  tenantUsers,
  meetingTypes,
  onClose,
  onUpdated,
}: {
  meeting: MeetingMinutesRecord;
  tenantUsers: TenantUserOption[];
  meetingTypes: GovernanceMeetingType[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { fmt: fmtDate } = useFormatDate();
  const { t } = useI18n();
  const [meeting, setMeeting] = useState(initialMeeting);
  const [activeTab, setActiveTab] = useState<"details" | "action_items" | "documents">("details");
  const [showEdit, setShowEdit] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docRef = useRef<HTMLInputElement>(null);

  // Action item form state
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ description: "", responsible_id: "", responsible_name: "", deadline: "", notes: "" });
  const [savingItem, setSavingItem] = useState(false);

  // Assign action item modal state
  const [assignItem, setAssignItem] = useState<MeetingActionItem | null>(null);
  const [assignForm, setAssignForm] = useState({ assigned_to: "", due_date: "", priority: "medium" });
  const [assigning, setAssigning] = useState(false);

  const reload = async () => {
    try {
      const res = await minutesApi.get(meeting.id);
      setMeeting(res.data);
      onUpdated();
    } catch { /* */ }
  };

  const handleFinalise = async () => {
    if (!(await confirm({ title: t("governance.resolutions.finaliseTitle"), message: t("governance.resolutions.finaliseMessage") }))) return;
    try {
      await minutesApi.update(meeting.id, { status: "final" });
      toast("success", t("governance.resolutions.finalised"), t("governance.resolutions.markedFinal"));
      reload();
    } catch { toast("error", t("governance.resolutions.error"), t("governance.resolutions.finaliseFailed")); }
  };

  const handleUploadDoc = async () => {
    const file = docRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploadingDoc(true);
    try {
      await minutesApi.uploadDocument(meeting.id, fd);
      toast("success", t("governance.resolutions.uploaded"), t("governance.resolutions.docUploadedPlain"));
      if (docRef.current) docRef.current.value = "";
      reload();
    } catch { toast("error", t("governance.resolutions.uploadFailed"), t("governance.resolutions.uploadFailedShort")); }
    finally { setUploadingDoc(false); }
  };

  const handleDeleteDoc = async (attId: number) => {
    if (!(await confirm({ title: t("governance.resolutions.deleteDocTitle"), message: t("governance.resolutions.cannotUndo"), variant: "danger" }))) return;
    try {
      await minutesApi.deleteDocument(meeting.id, attId);
      toast("success", t("governance.resolutions.deleted"), t("governance.resolutions.docRemoved"));
      reload();
    } catch { toast("error", t("governance.resolutions.error"), t("governance.resolutions.deleteFailedShort")); }
  };

  const handleAddItem = async () => {
    if (!newItem.description.trim()) return;
    setSavingItem(true);
    try {
      await minutesApi.addActionItem(meeting.id, {
        description: newItem.description.trim(),
        responsible_id: newItem.responsible_id ? parseInt(newItem.responsible_id) : undefined,
        responsible_name: !newItem.responsible_id && newItem.responsible_name ? newItem.responsible_name : undefined,
        deadline: newItem.deadline || undefined,
        notes: newItem.notes || undefined,
      });
      toast("success", t("governance.resolutions.added"), t("governance.resolutions.itemAdded"));
      setNewItem({ description: "", responsible_id: "", responsible_name: "", deadline: "", notes: "" });
      setShowAddItem(false);
      reload();
    } catch { toast("error", t("governance.resolutions.error"), t("governance.resolutions.itemAddFailed")); }
    finally { setSavingItem(false); }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!(await confirm({ title: t("governance.resolutions.deleteItemTitle"), message: t("governance.resolutions.cannotUndo"), variant: "danger" }))) return;
    try {
      await minutesApi.deleteActionItem(meeting.id, itemId);
      toast("success", t("governance.resolutions.deleted"), t("governance.resolutions.itemRemoved"));
      reload();
    } catch { toast("error", t("governance.resolutions.error"), t("governance.resolutions.deleteFailedShort")); }
  };

  const handleMarkItemDone = async (item: MeetingActionItem) => {
    try {
      await minutesApi.updateActionItem(meeting.id, item.id, {
        status: item.status === "completed" ? "open" : "completed",
      });
      reload();
    } catch { toast("error", t("governance.resolutions.error"), t("governance.resolutions.statusUpdateFailed")); }
  };

  const handleAssign = async () => {
    if (!assignItem || !assignForm.due_date) return;
    setAssigning(true);
    try {
      await minutesApi.assignActionItem(meeting.id, assignItem.id, {
        assigned_to: assignForm.assigned_to ? parseInt(assignForm.assigned_to) : undefined,
        due_date: assignForm.due_date,
        priority: assignForm.priority,
      });
      toast("success", t("governance.resolutions.assigned"), t("governance.resolutions.assignedDetail"));
      setAssignItem(null);
      reload();
    } catch { toast("error", t("governance.resolutions.error"), t("governance.resolutions.assignFailed")); }
    finally { setAssigning(false); }
  };

  const actionItems = meeting.action_items ?? [];
  const openItems = actionItems.filter((i) => i.status === "open" || i.status === "in_progress");
  const doneItems = actionItems.filter((i) => i.status === "completed" || i.status === "cancelled");

  return (
    <>
      {/* Drawer overlay */}
      <div className="fixed inset-0 z-40 flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-neutral-100 bg-white">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meetingTypeColor(meeting.meeting_type)}`}>
                  {meetingTypeLabel(meeting.meeting_type)}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meeting.status === "final" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {meeting.status === "final" ? t("governance.resolutions.final") : t("governance.resolutions.draft")}
                </span>
              </div>
              <h2 className="font-bold text-neutral-900 text-lg leading-snug">{meeting.title}</h2>
              <p className="text-xs text-neutral-500 mt-0.5">{fmtDate(meeting.meeting_date)}{meeting.location ? ` · ${meeting.location}` : ""}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {meeting.status === "draft" && (
                <button onClick={handleFinalise} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>{t("governance.resolutions.finalise")}
                </button>
              )}
              <button onClick={() => setShowEdit(true)} className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">edit</span>{t("common.edit")}
              </button>
              <button onClick={onClose} aria-label={t("governance.resolutions.closeMeeting")} className="text-neutral-400 hover:text-neutral-600 ml-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-neutral-100 px-6 bg-white">
            {[
              { id: "details" as const, label: t("governance.resolutions.tab.details"), icon: "description" },
              { id: "action_items" as const, label: t("governance.resolutions.tab.tasks", { count: actionItems.length }), icon: "task_alt" },
              { id: "documents" as const, label: t("governance.resolutions.tab.documents", { count: (meeting.attachments ?? []).length }), icon: "attach_file" },
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}>
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* ─── Details tab ─── */}
            {activeTab === "details" && (
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: t("governance.resolutions.detail.chair"), value: meeting.chairperson ?? "—", icon: "manage_accounts" },
                    { label: t("governance.resolutions.detail.recordedBy"), value: meeting.creator?.name ?? "—", icon: "person" },
                    { label: t("governance.resolutions.detail.date"), value: fmtDate(meeting.meeting_date), icon: "calendar_today" },
                    { label: t("governance.resolutions.detail.location"), value: meeting.location ?? "—", icon: "location_on" },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] text-neutral-400 mt-0.5">{icon}</span>
                      <div>
                        <p className="text-[10px] text-neutral-400 uppercase tracking-wide font-semibold">{label}</p>
                        <p className="text-sm text-neutral-800 font-medium">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Attendees */}
                {(meeting.attendees ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">groups</span>
                      {t("governance.resolutions.detail.attendees", { count: meeting.attendees.length })}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {meeting.attendees.map((a, i) => (
                        <span key={i} className="px-2.5 py-1 bg-neutral-100 rounded-full text-xs text-neutral-700 font-medium">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Apologies */}
                {(meeting.apologies ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">person_off</span>
                      {t("governance.resolutions.detail.apologies", { count: meeting.apologies.length })}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {meeting.apologies.map((a, i) => (
                        <span key={i} className="px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-full text-xs text-amber-700">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {meeting.notes && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">notes</span>{t("governance.resolutions.detail.notes")}
                    </p>
                    <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4">
                      <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{meeting.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Tasks tab ─── */}
            {activeTab === "action_items" && (
              <div className="p-6 space-y-4">

                {/* Workflow explanation */}
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 flex gap-3">
                  <span className="material-symbols-outlined text-blue-500 text-[20px] shrink-0 mt-0.5">info</span>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-blue-800">{t("governance.resolutions.tasks.howTitle")}</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      {t("governance.resolutions.tasks.howPart1")} <em>{t("governance.resolutions.tasks.howExample")}</em>.{" "}
                      {t("governance.resolutions.tasks.howPart2")} <strong>{t("governance.resolutions.tasks.sendToAssignments")}</strong> {t("governance.resolutions.tasks.howPart3")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-neutral-600">{t(actionItems.length === 1 ? "governance.resolutions.tasks.countOne" : "governance.resolutions.tasks.countMany", { count: actionItems.length })}</p>
                  <button onClick={() => setShowAddItem(true)}
                    className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">add_task</span>{t("governance.resolutions.tasks.record")}
                  </button>
                </div>

                {/* Add task form */}
                {showAddItem && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">edit_note</span>
                      {t("governance.resolutions.tasks.recordTitle")}
                    </p>
                    <div>
                      <label htmlFor="governance-resolutions-task-description" className="block text-[10px] font-medium text-neutral-600 mb-1">{t("governance.resolutions.tasks.description")} <span className="text-red-500">*</span></label>
                      <textarea id="governance-resolutions-task-description" rows={2} className="form-input resize-none text-sm"
                        placeholder={t("governance.resolutions.tasks.descriptionPlaceholder")}
                        value={newItem.description}
                        onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="governance-resolutions-assigned-to-staff" className="block text-[10px] font-medium text-neutral-600 mb-1">{t("governance.resolutions.tasks.assignedTo")}</label>
                        <select id="governance-resolutions-assigned-to-staff" className="form-input text-xs" value={newItem.responsible_id}
                          onChange={(e) => setNewItem((p) => ({ ...p, responsible_id: e.target.value, responsible_name: "" }))}>
                          <option value="">{t("governance.resolutions.tasks.selectStaff")}</option>
                          {tenantUsers.map((u) => <option key={u.id} value={String(u.id)}>{u.name}{u.job_title ? ` — ${u.job_title}` : ""}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="governance-resolutions-or-type-name-non-staff" className="block text-[10px] font-medium text-neutral-600 mb-1">{t("governance.resolutions.tasks.orName")}</label>
                        <input id="governance-resolutions-or-type-name-non-staff" className="form-input text-xs" placeholder={t("governance.resolutions.tasks.externalPlaceholder")}
                          value={newItem.responsible_name}
                          disabled={!!newItem.responsible_id}
                          onChange={(e) => setNewItem((p) => ({ ...p, responsible_name: e.target.value }))} />
                      </div>
                      <div>
                        <label htmlFor="governance-resolutions-target-deadline" className="block text-[10px] font-medium text-neutral-600 mb-1">{t("governance.resolutions.tasks.deadline")}</label>
                        <input id="governance-resolutions-target-deadline" type="date" className="form-input text-xs" value={newItem.deadline}
                          onChange={(e) => setNewItem((p) => ({ ...p, deadline: e.target.value }))} />
                      </div>
                      <div>
                        <label htmlFor="governance-resolutions-additional-notes" className="block text-[10px] font-medium text-neutral-600 mb-1">{t("governance.resolutions.tasks.notes")}</label>
                        <input id="governance-resolutions-additional-notes" className="form-input text-xs" placeholder={t("governance.resolutions.tasks.notesPlaceholder")}
                          value={newItem.notes}
                          onChange={(e) => setNewItem((p) => ({ ...p, notes: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowAddItem(false); setNewItem({ description: "", responsible_id: "", responsible_name: "", deadline: "", notes: "" }); }}
                        className="btn-secondary px-3 py-1.5 text-xs">{t("common.cancel")}</button>
                      <button onClick={handleAddItem} disabled={savingItem || !newItem.description.trim()}
                        className="btn-primary px-4 py-1.5 text-xs disabled:opacity-50">
                        {savingItem ? t("governance.resolutions.saving") : t("governance.resolutions.tasks.save")}
                      </button>
                    </div>
                  </div>
                )}

                {actionItems.length === 0 ? (
                  <div className="py-10 text-center">
                    <span className="material-symbols-outlined text-3xl text-neutral-200 block mb-2">task_alt</span>
                    <p className="text-xs text-neutral-400">{t("governance.resolutions.tasks.empty")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Open items */}
                    {openItems.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">{t("governance.resolutions.tasks.pending")}</p>
                        {openItems.map((item) => (
                          <ActionItemCard key={item.id} item={item} meetingId={meeting.id}
                            onToggleDone={() => handleMarkItemDone(item)}
                            onDelete={() => handleDeleteItem(item.id)}
                            onAssign={() => { setAssignItem(item); setAssignForm({ assigned_to: String(item.responsible_id ?? ""), due_date: item.deadline ?? "", priority: "medium" }); }}
                          />
                        ))}
                      </>
                    )}
                    {/* Done items */}
                    {doneItems.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mt-4">{t("governance.resolutions.tasks.done")}</p>
                        {doneItems.map((item) => (
                          <ActionItemCard key={item.id} item={item} meetingId={meeting.id}
                            onToggleDone={() => handleMarkItemDone(item)}
                            onDelete={() => handleDeleteItem(item.id)}
                            onAssign={() => { setAssignItem(item); setAssignForm({ assigned_to: String(item.responsible_id ?? ""), due_date: item.deadline ?? "", priority: "medium" }); }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─── Documents tab ─── */}
            {activeTab === "documents" && (
              <div className="p-6 space-y-4">
                <div className="rounded-xl border-2 border-dashed border-neutral-200 p-6 text-center">
                  <span className="material-symbols-outlined text-3xl text-neutral-300 block mb-2">upload_file</span>
                  <p className="text-sm font-medium text-neutral-700 mb-1">{t("governance.resolutions.docs.uploadTitle")}</p>
                  <p className="text-xs text-neutral-400 mb-3">{t("governance.resolutions.docs.uploadHint")}</p>
                  <input ref={docRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                    onChange={handleUploadDoc} />
                  <button onClick={() => docRef.current?.click()}
                    disabled={uploadingDoc}
                    className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                    {uploadingDoc ? t("governance.resolutions.uploading") : t("governance.resolutions.docs.chooseFile")}
                  </button>
                </div>

                {(meeting.attachments ?? []).length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-xs text-neutral-400">{t("governance.resolutions.docs.empty")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(meeting.attachments ?? []).map((att) => (
                      <div key={att.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 px-4 py-3 bg-neutral-50/50">
                        <span className="material-symbols-outlined text-[20px] text-primary">description</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-800 truncate">{att.original_filename}</p>
                          <p className="text-xs text-neutral-400">{fmtBytes(att.size_bytes)} · {fmtDate(att.created_at)}</p>
                        </div>
                        <a href={minutesApi.downloadUrl(meeting.id, att.id)} target="_blank" rel="noreferrer"
                          className="text-xs text-primary hover:text-blue-700 flex items-center gap-1 font-medium">
                          <span className="material-symbols-outlined text-[14px]">download</span>{t("common.download")}
                        </a>
                        <button onClick={() => handleDeleteDoc(att.id)}
                          aria-label={t("governance.resolutions.deleteFile", { name: att.original_filename })}
                          className="text-neutral-300 hover:text-red-500 transition-colors ml-1">
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <MeetingFormModal existing={meeting} meetingTypes={meetingTypes} onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); reload(); }} />
      )}

      {/* Assign modal */}
      {assignItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <h3 className="font-semibold text-neutral-900">{t("governance.resolutions.assign.title")}</h3>
              <button onClick={() => setAssignItem(null)} aria-label={t("governance.resolutions.assign.close")} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-3">
                <p className="text-xs text-neutral-500 mb-0.5">{t("governance.resolutions.assign.actionItem")}</p>
                <p className="text-sm font-medium text-neutral-800">{assignItem.description}</p>
              </div>
              <p className="text-xs text-neutral-500">
                {t("governance.resolutions.assign.hint")}
              </p>
              <div className="space-y-3">
                <div>
                  <label htmlFor="governance-resolutions-assign-to" className="block text-xs font-medium text-neutral-700 mb-1">{t("governance.resolutions.assign.to")}</label>
                  <select id="governance-resolutions-assign-to" className="form-input" value={assignForm.assigned_to}
                    onChange={(e) => setAssignForm((p) => ({ ...p, assigned_to: e.target.value }))}>
                    <option value="">{t("governance.resolutions.tasks.selectStaff")}</option>
                    {tenantUsers.map((u) => <option key={u.id} value={String(u.id)}>{u.name} — {u.job_title ?? ""}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="governance-resolutions-due-date" className="block text-xs font-medium text-neutral-700 mb-1">{t("governance.resolutions.assign.dueDate")} <span className="text-red-500">*</span></label>
                    <input id="governance-resolutions-due-date" type="date" className="form-input" value={assignForm.due_date}
                      onChange={(e) => setAssignForm((p) => ({ ...p, due_date: e.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="governance-resolutions-priority" className="block text-xs font-medium text-neutral-700 mb-1">{t("governance.resolutions.assign.priority")}</label>
                    <select id="governance-resolutions-priority" className="form-input" value={assignForm.priority}
                      onChange={(e) => setAssignForm((p) => ({ ...p, priority: e.target.value }))}>
                      <option value="low">{t("governance.resolutions.priority.low")}</option>
                      <option value="medium">{t("governance.resolutions.priority.medium")}</option>
                      <option value="high">{t("governance.resolutions.priority.high")}</option>
                      <option value="critical">{t("governance.resolutions.priority.critical")}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100">
              <button onClick={() => setAssignItem(null)} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
              <button onClick={handleAssign} disabled={assigning || !assignForm.due_date}
                className="btn-primary px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined text-[16px]">assignment_ind</span>
                {assigning ? t("governance.resolutions.assign.assigning") : t("governance.resolutions.assign.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Action item card ──────────────────────────────────────────────────────────
function ActionItemCard({ item, meetingId, onToggleDone, onDelete, onAssign }: {
  item: MeetingActionItem;
  meetingId: number;
  onToggleDone: () => void;
  onDelete: () => void;
  onAssign: () => void;
}) {
  const { fmt: fmtDate } = useFormatDate();
  const { t } = useI18n();
  const done = item.status === "completed" || item.status === "cancelled";
  return (
    <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 transition-colors ${done ? "border-neutral-100 bg-neutral-50/50 opacity-70" : "border-neutral-200 bg-white"}`}>
      <button onClick={onToggleDone} className="mt-0.5 shrink-0">
        <span className={`material-symbols-outlined text-[20px] transition-colors ${done ? "text-emerald-500" : "text-neutral-300 hover:text-primary"}`}>
          {done ? "check_circle" : "radio_button_unchecked"}
        </span>
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? "line-through text-neutral-400" : "text-neutral-800"}`}>
          {item.description}
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-1.5">
          {(item.responsible?.name || item.responsible_name) && (
            <span className="flex items-center gap-1 text-xs text-neutral-500">
              <span className="material-symbols-outlined text-[12px]">person</span>
              {item.responsible?.name ?? item.responsible_name}
            </span>
          )}
          {item.deadline && (
            <span className="flex items-center gap-1 text-xs text-neutral-500">
              <span className="material-symbols-outlined text-[12px]">calendar_today</span>
              {fmtDate(item.deadline)}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ACTION_STATUS_STYLE[item.status] ?? "bg-neutral-100 text-neutral-600"}`}>
            {ACTION_STATUS_STYLE[item.status] ? t(`governance.resolutions.actionStatus.${item.status}`) : item.status.replace("_", " ")}
          </span>
          {item.assignment_id && (
            <a href={`/assignments/${item.assignment_id}`}
              className="btn-secondary text-xs py-1 px-2 inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">link</span>
              {item.assignment?.reference_number ?? t("governance.resolutions.assignment")}
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!item.assignment_id && !done && (
          <button onClick={onAssign} title={t("governance.resolutions.formallyAssign")}
            className="flex items-center gap-1 text-xs text-primary hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors">
            <span className="material-symbols-outlined text-[14px]">assignment_ind</span>{t("governance.resolutions.assign.button")}
          </button>
        )}
        <button onClick={onDelete} aria-label={t("governance.resolutions.deleteActionItem")} className="text-neutral-300 hover:text-red-500 transition-colors p-1">
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
    </div>
  );
}

// ── Main Meeting Minutes component ────────────────────────────────────────────
function MeetingMinutes() {
  const [records, setRecords] = useState<MeetingMinutesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<MeetingMinutesRecord | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUserOption[]>([]);
  const [meetingTypes, setMeetingTypes] = useState<GovernanceMeetingType[]>([]);
  const [showManageTypes, setShowManageTypes] = useState(false);
  const { t, localeTag } = useI18n();

  useEffect(() => {
    governanceMeetingTypeApi.list().then((r) => setMeetingTypes(r.data.data ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { per_page: 20, page };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.meeting_type = typeFilter;
      if (search) params.search = search;
      const res = await minutesApi.list(params);
      setRecords(res.data.data ?? []);
      setLastPage(res.data.last_page ?? 1);
      setTotal(res.data.total ?? 0);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    import("@/lib/api").then(({ tenantUsersApi }) => {
      tenantUsersApi.list().then((r) => setTenantUsers(r.data.data ?? [])).catch(() => {});
    });
  }, []);

  const handleOpenSelected = async (id: number) => {
    try {
      const res = await minutesApi.get(id);
      setSelected(res.data);
    } catch { /* */ }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <p className="page-subtitle">
          {t("governance.resolutions.minutes.subtitle")}
        </p>
        <button onClick={() => setShowCreate(true)}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2 whitespace-nowrap">
          <span className="material-symbols-outlined text-[18px]">add</span>{t("governance.resolutions.minutes.record")}
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <input
          className="form-input w-56 text-sm"
          placeholder={t("governance.resolutions.minutes.search")}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <div className="flex flex-wrap gap-2">
          {[{ v: "", l: t("governance.resolutions.minutes.allStatus") }, { v: "draft", l: t("governance.resolutions.draft") }, { v: "final", l: t("governance.resolutions.final") }].map(({ v, l }) => (
            <button key={v || "all-s"} onClick={() => { setStatusFilter(v); setPage(1); }}
              className={`filter-tab ${statusFilter === v ? "active" : ""}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button key="all-t" onClick={() => { setTypeFilter(""); setPage(1); }}
            className={`filter-tab ${typeFilter === "" ? "active" : ""}`}>{t("governance.resolutions.minutes.allTypes")}</button>
          {meetingTypes.map((mt) => (
            <button key={mt.id} onClick={() => { setTypeFilter(mt.name); setPage(1); }}
              className={`filter-tab ${typeFilter === mt.name ? "active" : ""}`}>{mt.name}</button>
          ))}
        </div>
        <button onClick={() => setShowManageTypes(true)} title={t("governance.resolutions.minutes.manageTypes")}
          className="ml-auto text-neutral-400 hover:text-neutral-700 transition-colors p-1.5 rounded-lg hover:bg-neutral-100">
          <span className="material-symbols-outlined text-[18px]">settings</span>
        </button>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-neutral-300 text-[28px]">progress_activity</span>
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon="event_note"
            title={t("governance.resolutions.minutes.empty")}
            action={
              <button type="button" onClick={() => setShowCreate(true)} className="btn-primary px-4 py-2 text-xs">
                {t("governance.resolutions.minutes.recordFirst")}
              </button>
            }
          />
        ) : (
          <div className="divide-y divide-neutral-100">
            {records.map((m) => {
              const open = (m.action_items ?? []).filter((i) => i.status === "open" || i.status === "in_progress").length;
              return (
                <button key={m.id} onClick={() => handleOpenSelected(m.id)}
                  className="w-full flex items-start gap-4 px-6 py-4 hover:bg-neutral-50/60 transition-colors text-left">
                  {/* Date badge */}
                  <div className="flex-shrink-0 w-12 text-center">
                    <div className="rounded-xl bg-primary/10 px-2 py-1.5">
                      <p className="text-[10px] text-primary font-bold uppercase">
                        {m.meeting_date ? new Date(m.meeting_date.slice(0, 10) + "T00:00:00").toLocaleDateString(localeTag, { month: "short" }) : "—"}
                      </p>
                      <p className="text-lg font-bold text-primary leading-none">
                        {m.meeting_date ? String(new Date(m.meeting_date.slice(0, 10) + "T00:00:00").getDate()) : "—"}
                      </p>
                    </div>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                        {m.meeting_type}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${m.status === "final" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {m.status === "final" ? t("governance.resolutions.final") : t("governance.resolutions.draft")}
                      </span>
                    </div>
                    <p className="font-semibold text-neutral-900">{m.title}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {m.chairperson && (
                        <span className="flex items-center gap-1 text-xs text-neutral-500">
                          <span className="material-symbols-outlined text-[12px]">manage_accounts</span>{m.chairperson}
                        </span>
                      )}
                      {m.location && (
                        <span className="flex items-center gap-1 text-xs text-neutral-400">
                          <span className="material-symbols-outlined text-[12px]">location_on</span>{m.location}
                        </span>
                      )}
                      {(m.attendees ?? []).length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-neutral-400">
                          <span className="material-symbols-outlined text-[12px]">groups</span>
                          {t(m.attendees.length === 1 ? "governance.resolutions.minutes.attendeeOne" : "governance.resolutions.minutes.attendeeMany", { count: m.attendees.length })}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Right side */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {open > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <span className="material-symbols-outlined text-[12px]">pending_actions</span>
                        {t("governance.resolutions.minutes.open", { count: open })}
                      </span>
                    )}
                    {(m.attachments ?? []).length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-neutral-400">
                        <span className="material-symbols-outlined text-[12px]">attach_file</span>
                        {t(m.attachments!.length === 1 ? "governance.resolutions.minutes.docOne" : "governance.resolutions.minutes.docMany", { count: m.attachments!.length })}
                      </span>
                    )}
                    <span className="material-symbols-outlined text-[16px] text-neutral-300">chevron_right</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-100 bg-neutral-50">
          <p className="text-sm text-neutral-500">{t(total === 1 ? "governance.resolutions.minutes.recordOne" : "governance.resolutions.minutes.recordMany", { count: total })}</p>
          <div className="flex gap-2">
            <button className="btn-secondary px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("common.previous")}</button>
            <button className="btn-secondary px-3 py-1.5 text-xs" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>{t("common.next")}</button>
          </div>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <MeetingFormModal meetingTypes={meetingTypes} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}

      {/* Manage meeting types modal */}
      {showManageTypes && (
        <ManageMeetingTypesModal
          meetingTypes={meetingTypes}
          onClose={() => setShowManageTypes(false)}
          onChanged={(updated) => setMeetingTypes(updated)}
        />
      )}

      {/* Detail drawer */}
      {selected && (
        <MeetingDrawer
          meeting={selected}
          tenantUsers={tenantUsers}
          meetingTypes={meetingTypes}
          onClose={() => setSelected(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}

// ─── Implementation Tracker Tab ───────────────────────────────────────────────

function ImplementationTracker() {
  const { fmt: fmtDate } = useFormatDate();
  const { t } = useI18n();
  const [resolutions, setResolutions] = useState<GovernanceResolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("Adopted");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await governanceApi.resolutions({ per_page: 50, ...(filter ? { status: filter } : {}) });
      setResolutions(res.data.data ?? []);
    } catch {
      setResolutions([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const trackerStatuses = ["Adopted", "In Progress", "Pending Review", "Implemented", "Actioned", "Rejected"];

  const counts = Object.fromEntries(
    trackerStatuses.map((s) => [s, resolutions.filter((r) => r.status === s).length])
  );
  const total = resolutions.length;
  const implemented = counts["Implemented"] + counts["Actioned"];
  const pct = total > 0 ? Math.round((implemented / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <p className="page-subtitle">{t("governance.resolutions.tracker.subtitle")}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("governance.status.adopted"), icon: "gavel", value: counts["Adopted"] ?? 0, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: t("governance.status.inProgress"), icon: "pending", value: counts["In Progress"] ?? 0, color: "text-blue-600", bg: "bg-blue-50" },
          { label: t("governance.status.implemented"), icon: "task_alt", value: implemented, color: "text-teal-600", bg: "bg-teal-50" },
          { label: t("governance.status.rejected"), icon: "cancel", value: counts["Rejected"] ?? 0, color: "text-red-600", bg: "bg-red-50" },
        ].map(({ label, icon, value, color, bg }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`size-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <span className={`material-symbols-outlined ${color} text-[20px]`}>{icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{value}</p>
              <p className="text-xs text-neutral-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-neutral-700">{t("governance.resolutions.tracker.rate")}</p>
            <p className="text-sm font-bold text-primary">{pct}%</p>
          </div>
          <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-neutral-400 mt-1">{t("governance.resolutions.tracker.rateDetail", { implemented, total })}</p>
        </div>
      )}

      {/* Filter + List */}
      <div className="card p-4 flex flex-wrap gap-2">
        {["", ...trackerStatuses].map((s) => (
          <button key={s || "all"} onClick={() => setFilter(s)}
            className={`filter-tab ${filter === s ? "active" : ""}`}>{s ? statusLabel(s, t) : t("governance.status.all")}</button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-neutral-300 text-[28px]">progress_activity</span>
          </div>
        ) : resolutions.length === 0 ? (
          <EmptyState icon="playlist_add_check" title={t("governance.resolutions.tracker.empty")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("governance.resolutions.col.reference")}</th>
                  <th>{t("governance.resolutions.col.resolution")}</th>
                  <th>{t("governance.resolutions.col.type")}</th>
                  <th>{t("governance.resolutions.col.adopted")}</th>
                  <th>{t("governance.resolutions.col.status")}</th>
                  <th className="text-right">{t("governance.resolutions.col.docs")}</th>
                </tr>
              </thead>
              <tbody>
                {resolutions.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm text-neutral-400">{r.reference_number ?? "—"}</td>
                    <td>
                      <p className="font-medium text-neutral-900 max-w-[240px] truncate">{r.title}</p>
                      {r.committee && <p className="text-xs text-neutral-400">{r.committee}</p>}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-600 capitalize">
                        <span className="material-symbols-outlined text-[13px]">{r.type === "plenary" ? "account_balance" : "groups"}</span>
                        {r.type === "plenary" || r.type === "committee" ? t(`governance.resolutions.type.${r.type}`) : (r.type ?? "—")}
                      </span>
                    </td>
                    <td className="text-sm text-neutral-600 whitespace-nowrap">{fmtDate(r.adopted_at)}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle(r.status)}`}>
                        <span className={`size-1.5 rounded-full ${statusDot(r.status)}`} />{statusLabel(r.status, t)}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-0.5">
                        {LANGUAGES.map(({ code, flag }) => {
                          const has = (r.documents ?? []).some((d) => d.language === code);
                          return <span key={code} className={`text-base ${has ? "" : "opacity-20 grayscale"}`}>{flag}</span>;
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "committee" as const,       label: "governance.resolutions.tab.committee",  icon: "groups" },
  { id: "plenary" as const,         label: "governance.resolutions.tab.plenary",     icon: "account_balance" },
  { id: "minutes" as const,         label: "governance.resolutions.tab.minutes",         icon: "event_note" },
  { id: "implementation" as const,  label: "governance.resolutions.tab.implementation",  icon: "playlist_add_check" },
];

export default function GovernancePage() {
  const [tab, setTab] = useState<"committee" | "plenary" | "minutes" | "implementation">("committee");
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title={t("governance.resolutions.title")}
        subtitle={t("governance.resolutions.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "governance.resolutions.title" }]} />}
      />

      {/* Tab bar */}
      <div className="card p-1 flex gap-1 overflow-x-auto">
        {TABS.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${tab === tb.id ? "bg-primary text-white shadow-sm" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"}`}>
            <span className="material-symbols-outlined text-[18px]">{tb.icon}</span>
            <span className="hidden sm:inline">{t(tb.label)}</span>
          </button>
        ))}
      </div>

      {tab === "committee"      && <ResolutionsList type="committee" />}
      {tab === "plenary"        && <ResolutionsList type="plenary" />}
      {tab === "minutes"        && <MeetingMinutes />}
      {tab === "implementation" && <ImplementationTracker />}
    </div>
  );
}
