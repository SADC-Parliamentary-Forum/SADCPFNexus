"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { governanceApi, minutesApi, committeeApi, governanceMeetingTypeApi, type GovernanceResolution, type GovernanceDocument, type GovernanceMeeting, type MeetingMinutesRecord, type MeetingActionItem, type GovernanceCommittee, type GovernanceMeetingType } from "@/lib/api";
import api from "@/lib/api";
import type { TenantUserOption } from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: "en" as const, label: "English", flag: "🇬🇧" },
  { code: "fr" as const, label: "French", flag: "🇫🇷" },
  { code: "pt" as const, label: "Portuguese", flag: "🇵🇹" },
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
  "Actioned":       "bg-purple-100 text-purple-800 border-purple-200",
};
const STATUS_DOT: Record<ResStatus, string> = {
  "Draft": "bg-neutral-400", "Adopted": "bg-emerald-500", "In Progress": "bg-blue-500",
  "Pending Review": "bg-amber-500", "Implemented": "bg-teal-500",
  "Rejected": "bg-red-500", "Actioned": "bg-purple-500",
};

// Committees and meeting types are loaded from the API — see committeeApi / governanceMeetingTypeApi

function statusStyle(s: string) { return STATUS_STYLE[s as ResStatus] ?? "bg-neutral-100 text-neutral-700 border-neutral-200"; }
function statusDot(s: string) { return STATUS_DOT[s as ResStatus] ?? "bg-neutral-400"; }
function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}
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
      toast("success", "Uploaded", `${LANGUAGES.find((l) => l.code === lang)?.label} document uploaded.`);
      input.value = "";
      onRefresh();
    } catch {
      toast("error", "Upload failed", "Could not upload document.");
    } finally {
      setUploading((p) => ({ ...p, [lang]: false }));
    }
  };

  const handleDelete = async (lang: "en" | "fr" | "pt", doc: GovernanceDocument) => {
    if (!(await confirm({ title: "Remove Document", message: `Remove the ${LANGUAGES.find((l) => l.code === lang)?.label} version?`, variant: "danger" }))) return;
    try {
      await governanceApi.deleteDocument(resolution.id, doc.id);
      toast("success", "Removed", "Document removed.");
      onRefresh();
    } catch {
      toast("error", "Error", "Could not remove document.");
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
      toast("error", "Error", "Could not download document.");
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Official Documents</p>
      <div className="grid grid-cols-3 gap-3">
        {LANGUAGES.map(({ code, label, flag }) => {
          const doc = docsByLang[code];
          return (
            <div key={code} className={`rounded-xl border p-3 space-y-2 transition-colors ${doc ? "border-primary/30 bg-primary/5" : "border-neutral-200 bg-neutral-50"}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{flag}</span>
                <div>
                  <p className="text-xs font-semibold text-neutral-800">{label}</p>
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
                      Download
                    </button>
                    <button
                      onClick={() => handleDelete(code, doc)}
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
                    {uploading[code] ? "Uploading…" : "Upload PDF/DOC"}
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
  const isEdit = !!initial?.id;
  const [saving, setSaving] = useState(false);
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

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

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
      toast("success", isEdit ? "Updated" : "Created", isEdit ? "Resolution updated." : "Resolution created.");
      onSaved(res.data.data);
    } catch (err: unknown) {
      toast("error", "Error", err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Failed to save.");
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
              {isEdit ? "Edit" : "New"} {type === "committee" ? "Committee" : "Plenary"} Resolution
            </h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Reference No. *</label>
              <input className="form-input" required value={form.reference_number} onChange={(e) => set("reference_number", e.target.value)} placeholder="e.g. RES-2026-001" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Status</label>
              <select className="form-input" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Resolution Title *</label>
              <input className="form-input" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Official resolution title…" />
            </div>
            {type === "committee" && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Committee</label>
                <select className="form-input" value={form.committee} onChange={(e) => set("committee", e.target.value)}>
                  {committees.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Date of Adoption</label>
              <input type="date" className="form-input" value={form.adopted_at} onChange={(e) => set("adopted_at", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Lead Member</label>
              <input className="form-input" value={form.lead_member} onChange={(e) => set("lead_member", e.target.value)} placeholder="Name…" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Role / Title</label>
              <input className="form-input" value={form.lead_role} onChange={(e) => set("lead_role", e.target.value)} placeholder="Chairperson, Member…" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Description</label>
              <textarea rows={3} className="form-input resize-none" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Resolution details…" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1 border-t border-neutral-100">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
              {saving ? "Saving…" : isEdit ? "Update" : "Create Resolution"}
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
    if (!(await confirm({ title: "Delete Resolution", message: `Delete "${detail.title}"? This cannot be undone.`, variant: "danger" }))) return;
    try {
      await governanceApi.deleteResolution(detail.id);
      toast("success", "Deleted", "Resolution deleted.");
      onClose();
      onRefresh();
    } catch {
      toast("error", "Error", "Could not delete resolution.");
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
              <span className="material-symbols-outlined text-[14px]">edit</span>Edit
            </button>
            <button onClick={handleDelete} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors border border-red-200">
              <span className="material-symbols-outlined text-[14px]">delete</span>
            </button>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 ml-1">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Status + Date row */}
          <div className="flex flex-wrap gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusStyle(detail.status)}`}>
              <span className={`size-1.5 rounded-full ${statusDot(detail.status)}`} />{detail.status}
            </span>
            {detail.adopted_at && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
                <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                Adopted {fmtDate(detail.adopted_at)}
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
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Description</p>
              <p className="text-sm text-neutral-700 leading-relaxed">{detail.description}</p>
            </div>
          )}

          {/* Documents */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                Official Documents
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
      toast("error", "Error", "Could not update committee.");
    } finally {
      setSaving(false); }
  };

  const deleteItem = async (c: GovernanceCommittee) => {
    if (!(await confirm({ title: "Delete Committee", message: `Delete "${c.name}"? Existing resolutions will retain the name.`, variant: "danger" }))) return;
    try {
      await committeeApi.remove(c.id);
      const updated = items.filter((i) => i.id !== c.id);
      setItems(updated);
      onChanged(updated);
    } catch {
      toast("error", "Error", "Could not delete committee.");
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
      toast("error", "Error", "Could not add committee.");
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
            <h2 className="font-semibold text-neutral-900">Manage Committees</h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
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
                        className={`size-5 rounded-full border-2 transition-transform ${editColor === sw ? "border-neutral-800 scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: sw }} />
                    ))}
                  </div>
                  <input autoFocus className="form-input flex-1 text-sm py-1"
                    value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }} />
                  <button onClick={saveEdit} disabled={saving} className="btn-primary px-3 py-1 text-xs">Save</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary px-3 py-1 text-xs">Cancel</button>
                </>
              ) : (
                <>
                  <div className="size-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 text-sm text-neutral-800">{c.name}</span>
                  <button onClick={() => startEdit(c)} className="text-neutral-400 hover:text-primary p-1 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button onClick={() => deleteItem(c)} className="text-neutral-400 hover:text-red-500 p-1 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-neutral-400 py-4 text-center">No committees yet. Add one below.</p>
          )}
        </div>

        {/* Add new */}
        <div className="px-5 py-4 border-t border-neutral-200 space-y-3 shrink-0">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Add Committee</p>
          <div className="flex gap-1 flex-wrap">
            {COLOR_SWATCHES.map((sw) => (
              <button key={sw} onClick={() => setNewColor(sw)}
                className={`size-5 rounded-full border-2 transition-transform ${newColor === sw ? "border-neutral-800 scale-110" : "border-transparent"}`}
                style={{ backgroundColor: sw }} />
            ))}
          </div>
          <div className="flex gap-2">
            <input className="form-input flex-1 text-sm" placeholder="Committee name…"
              value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addNew(); }} />
            <button onClick={addNew} disabled={saving || !newName.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              Add
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
  const [items, setItems] = useState<GovernanceMeetingType[]>(initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (t: GovernanceMeetingType) => {
    setEditingId(t.id);
    setEditName(t.name);
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
      toast("error", "Error", "Could not update meeting type.");
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (t: GovernanceMeetingType) => {
    if (!(await confirm({ title: "Delete Meeting Type", message: `Delete "${t.name}"?`, variant: "danger" }))) return;
    try {
      await governanceMeetingTypeApi.remove(t.id);
      const updated = items.filter((i) => i.id !== t.id);
      setItems(updated);
      onChanged(updated);
    } catch {
      toast("error", "Error", "Could not delete meeting type.");
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
      toast("error", "Error", "Could not add meeting type.");
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
            <h2 className="font-semibold text-neutral-900">Manage Meeting Types</h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {items.map((t) => (
            <div key={t.id} className="flex items-center gap-2 py-2 border-b border-neutral-100 last:border-0">
              {editingId === t.id ? (
                <>
                  <input autoFocus className="form-input flex-1 text-sm py-1"
                    value={editName} onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }} />
                  <button onClick={saveEdit} disabled={saving} className="btn-primary px-3 py-1 text-xs">Save</button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary px-3 py-1 text-xs">Cancel</button>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-neutral-400 text-[16px]">event_note</span>
                  <span className="flex-1 text-sm text-neutral-800">{t.name}</span>
                  <button onClick={() => startEdit(t)} className="text-neutral-400 hover:text-primary p-1 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button onClick={() => deleteItem(t)} className="text-neutral-400 hover:text-red-500 p-1 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </>
              )}
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-neutral-400 py-4 text-center">No meeting types yet.</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-neutral-200 space-y-2 shrink-0">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Add Type</p>
          <div className="flex gap-2">
            <input className="form-input flex-1 text-sm" placeholder="e.g. Workshop, Review…"
              value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addNew(); }} />
            <button onClick={addNew} disabled={saving || !newName.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Resolutions List (shared by Committee + Plenary) ────────────────────────

function ResolutionsList({ type }: { type: ResolutionType }) {
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

  return (
    <div className="space-y-5">
      {/* Sub-header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <p className="page-subtitle">
          {isCommittee
            ? "Formal resolutions adopted by parliamentary committees."
            : "Full plenary session resolutions, motions, and official decisions."}
        </p>
        <div className="flex items-center gap-2">
          {!isCommittee && (
            <>
              <button className="btn-secondary px-3 py-2 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>Official Report
              </button>
              <button className="btn-secondary px-3 py-2 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">download</span>Export
              </button>
            </>
          )}
          {isCommittee && (
            <button onClick={() => setShowManageCommittees(true)} className="btn-secondary px-3 py-2 text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">settings</span>Committees
            </button>
          )}
          <button onClick={() => { setEditingResolution(null); setShowForm(true); }} className="btn-primary px-4 py-2 text-sm flex items-center gap-2 whitespace-nowrap">
            <span className="material-symbols-outlined text-[18px]">add</span>New Resolution
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 text-[20px]">search</span>
          <input className="form-input pl-10" placeholder={`Search by Reference, Title${isCommittee ? ", Committee" : ""}, Lead Member…`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {["", ...STATUSES].map((s) => (
            <button key={s || "all"} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`filter-tab ${statusFilter === s ? "active" : ""}`}>
              {s || "All"}
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
                  <th>Reference</th>
                  <th>Title</th>
                  {isCommittee && <th>Committee</th>}
                  <th>Lead Member</th>
                  <th>Adopted</th>
                  <th>Docs</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
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
                              <span key={code} title={has ? `${code.toUpperCase()} version uploaded` : `No ${code.toUpperCase()} version`}
                                className={`text-base ${has ? "opacity-100" : "opacity-20 grayscale"}`}>{flag}</span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">None</span>
                      )}
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle(r.status)}`}>
                        <span className={`size-1.5 rounded-full ${statusDot(r.status)}`} />{r.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => setViewingResolution(r)}
                        className="text-sm font-medium text-primary hover:text-blue-700 transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isCommittee ? 8 : 7} className="text-center py-12">
                      <span className="material-symbols-outlined text-3xl text-neutral-200 block mb-2">description</span>
                      <span className="text-neutral-400 text-sm">No resolutions found</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between px-6 py-3 border-t border-neutral-100 bg-neutral-50">
          <p className="text-sm text-neutral-500">Showing {filtered.length} of {total} result{total !== 1 ? "s" : ""}</p>
          <div className="flex gap-2">
            <button className="btn-secondary px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn-secondary px-3 py-1.5 text-xs" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</button>
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
  const [saving, setSaving] = useState(false);

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
      if (existing) {
        await minutesApi.update(existing.id, payload);
        toast("success", "Updated", "Meeting minutes updated.");
      } else {
        await minutesApi.create(payload);
        toast("success", "Created", "Meeting minutes recorded.");
      }
      onSaved();
    } catch {
      toast("error", "Error", "Could not save meeting minutes.");
    } finally {
      setSaving(false);
    }
  };

  const F = ({ label, required }: { label: string; required?: boolean }) => (
    <label className="block text-xs font-medium text-neutral-700 mb-1">
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
            {existing ? "Edit Meeting Minutes" : "Record Meeting Minutes"}
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* ── Body (scrollable only if needed) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ scrollbarWidth: "none" }}>

          {/* Row 1: Title */}
          <div>
            <F label="Meeting Title" required />
            <input className="form-input" placeholder="e.g. Monthly Staff Meeting — March 2026"
              value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </div>

          {/* Row 2: Date + Meeting Type + custom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <F label="Date" required />
              <input type="date" className="form-input" value={form.meeting_date}
                onChange={(e) => setForm((p) => ({ ...p, meeting_date: e.target.value }))} />
            </div>
            <div>
              <F label="Meeting Type" />
              <select className="form-input" value={form.meeting_type}
                onChange={(e) => setForm((p) => ({ ...p, meeting_type: e.target.value }))}>
                {meetingTypes.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>


          {/* Row 3: Location + Chairperson */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <F label="Location / Venue" />
              <input className="form-input" placeholder="e.g. Conference Room A"
                value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
            </div>
            <div>
              <F label="Chairperson" />
              <input className="form-input" placeholder="Name of chairperson"
                value={form.chairperson} onChange={(e) => setForm((p) => ({ ...p, chairperson: e.target.value }))} />
            </div>
          </div>

          {/* Row 4: Attendees + Apologies side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <F label="Attendees (one per line)" />
              <textarea rows={4} className="form-input resize-none font-mono text-xs"
                placeholder={"Ronald Windwaai\nJane Smith\n..."}
                value={form.attendeesText}
                onChange={(e) => setForm((p) => ({ ...p, attendeesText: e.target.value }))} />
            </div>
            <div>
              <F label="Apologies (one per line)" />
              <textarea rows={4} className="form-input resize-none font-mono text-xs"
                placeholder={"Alice Brown (on leave)\n..."}
                value={form.apologiesText}
                onChange={(e) => setForm((p) => ({ ...p, apologiesText: e.target.value }))} />
            </div>
          </div>

          {/* Row 5: Notes */}
          <div>
            <F label="Meeting Notes / Summary" />
            <textarea rows={4} className="form-input resize-none"
              placeholder="Key discussion points, decisions taken, and any other relevant matters..."
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>

        {/* ── Footer (fixed) ── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100 shrink-0">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim() || !form.meeting_date}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
            {saving ? "Saving…" : existing ? "Save Changes" : "Record Minutes"}
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
    if (!(await confirm({ title: "Finalise minutes?", message: "This will mark the minutes as final. You can still edit them later." }))) return;
    try {
      await minutesApi.update(meeting.id, { status: "final" });
      toast("success", "Finalised", "Minutes marked as final.");
      reload();
    } catch { toast("error", "Error", "Could not finalise."); }
  };

  const handleUploadDoc = async () => {
    const file = docRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploadingDoc(true);
    try {
      await minutesApi.uploadDocument(meeting.id, fd);
      toast("success", "Uploaded", "Document uploaded.");
      if (docRef.current) docRef.current.value = "";
      reload();
    } catch { toast("error", "Upload failed", "Could not upload."); }
    finally { setUploadingDoc(false); }
  };

  const handleDeleteDoc = async (attId: number) => {
    if (!(await confirm({ title: "Delete document?", message: "This cannot be undone.", variant: "danger" }))) return;
    try {
      await minutesApi.deleteDocument(meeting.id, attId);
      toast("success", "Deleted", "Document removed.");
      reload();
    } catch { toast("error", "Error", "Could not delete."); }
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
      toast("success", "Added", "Action item added.");
      setNewItem({ description: "", responsible_id: "", responsible_name: "", deadline: "", notes: "" });
      setShowAddItem(false);
      reload();
    } catch { toast("error", "Error", "Could not add action item."); }
    finally { setSavingItem(false); }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!(await confirm({ title: "Delete action item?", message: "This cannot be undone.", variant: "danger" }))) return;
    try {
      await minutesApi.deleteActionItem(meeting.id, itemId);
      toast("success", "Deleted", "Action item removed.");
      reload();
    } catch { toast("error", "Error", "Could not delete."); }
  };

  const handleMarkItemDone = async (item: MeetingActionItem) => {
    try {
      await minutesApi.updateActionItem(meeting.id, item.id, {
        status: item.status === "completed" ? "open" : "completed",
      });
      reload();
    } catch { toast("error", "Error", "Could not update status."); }
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
      toast("success", "Assigned", "Action item formally assigned. Check Assignments module.");
      setAssignItem(null);
      reload();
    } catch { toast("error", "Error", "Could not create assignment."); }
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
                  {meeting.status === "final" ? "Final" : "Draft"}
                </span>
              </div>
              <h2 className="font-bold text-neutral-900 text-lg leading-snug">{meeting.title}</h2>
              <p className="text-xs text-neutral-500 mt-0.5">{fmtDate(meeting.meeting_date)}{meeting.location ? ` · ${meeting.location}` : ""}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {meeting.status === "draft" && (
                <button onClick={handleFinalise} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>Finalise
                </button>
              )}
              <button onClick={() => setShowEdit(true)} className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">edit</span>Edit
              </button>
              <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 ml-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-neutral-100 px-6 bg-white">
            {[
              { id: "details" as const, label: "Details", icon: "description" },
              { id: "action_items" as const, label: `Tasks (${actionItems.length})`, icon: "task_alt" },
              { id: "documents" as const, label: `Documents (${(meeting.attachments ?? []).length})`, icon: "attach_file" },
            ].map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}>
                <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                {t.label}
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
                    { label: "Chairperson", value: meeting.chairperson ?? "—", icon: "manage_accounts" },
                    { label: "Recorded by", value: meeting.creator?.name ?? "—", icon: "person" },
                    { label: "Date", value: fmtDate(meeting.meeting_date), icon: "calendar_today" },
                    { label: "Location", value: meeting.location ?? "—", icon: "location_on" },
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
                      Attendees ({meeting.attendees.length})
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
                      Apologies ({meeting.apologies.length})
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
                      <span className="material-symbols-outlined text-[14px]">notes</span>Notes &amp; Summary
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
                    <p className="text-xs font-semibold text-blue-800">How task assignment works</p>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Record tasks discussed in this meeting below — e.g. <em>&ldquo;Ronald to provide feedback on the PIF system by Friday&rdquo;</em>.
                      Once recorded, click <strong>Send to Assignments</strong> to create a formally tracked task with deadlines,
                      progress updates, and approval workflow in the Assignments module.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-neutral-600">{actionItems.length} task{actionItems.length !== 1 ? "s" : ""} from this meeting</p>
                  <button onClick={() => setShowAddItem(true)}
                    className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">add_task</span>Record Task
                  </button>
                </div>

                {/* Add task form */}
                {showAddItem && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">edit_note</span>
                      Record a task from this meeting
                    </p>
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-600 mb-1">Task Description <span className="text-red-500">*</span></label>
                      <textarea rows={2} className="form-input resize-none text-sm"
                        placeholder='e.g. "Ronald to provide feedback on the PIF system" or "Finance team to prepare Q1 budget report"'
                        value={newItem.description}
                        onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-medium text-neutral-600 mb-1">Assigned To (staff)</label>
                        <select className="form-input text-xs" value={newItem.responsible_id}
                          onChange={(e) => setNewItem((p) => ({ ...p, responsible_id: e.target.value, responsible_name: "" }))}>
                          <option value="">— Select staff member —</option>
                          {tenantUsers.map((u) => <option key={u.id} value={String(u.id)}>{u.name}{u.job_title ? ` — ${u.job_title}` : ""}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-neutral-600 mb-1">Or type name (non-staff)</label>
                        <input className="form-input text-xs" placeholder="External / non-staff name"
                          value={newItem.responsible_name}
                          disabled={!!newItem.responsible_id}
                          onChange={(e) => setNewItem((p) => ({ ...p, responsible_name: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-neutral-600 mb-1">Target Deadline</label>
                        <input type="date" className="form-input text-xs" value={newItem.deadline}
                          onChange={(e) => setNewItem((p) => ({ ...p, deadline: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-neutral-600 mb-1">Additional Notes</label>
                        <input className="form-input text-xs" placeholder="Context, deliverable, references..."
                          value={newItem.notes}
                          onChange={(e) => setNewItem((p) => ({ ...p, notes: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowAddItem(false); setNewItem({ description: "", responsible_id: "", responsible_name: "", deadline: "", notes: "" }); }}
                        className="btn-secondary px-3 py-1.5 text-xs">Cancel</button>
                      <button onClick={handleAddItem} disabled={savingItem || !newItem.description.trim()}
                        className="btn-primary px-4 py-1.5 text-xs disabled:opacity-50">
                        {savingItem ? "Saving…" : "Save Task"}
                      </button>
                    </div>
                  </div>
                )}

                {actionItems.length === 0 ? (
                  <div className="py-10 text-center">
                    <span className="material-symbols-outlined text-3xl text-neutral-200 block mb-2">task_alt</span>
                    <p className="text-xs text-neutral-400">No action items recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Open items */}
                    {openItems.length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Pending</p>
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
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mt-4">Done / Cancelled</p>
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
                  <p className="text-sm font-medium text-neutral-700 mb-1">Upload Minutes Document</p>
                  <p className="text-xs text-neutral-400 mb-3">PDF, DOC, or DOCX up to 20 MB</p>
                  <input ref={docRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                    onChange={handleUploadDoc} />
                  <button onClick={() => docRef.current?.click()}
                    disabled={uploadingDoc}
                    className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
                    {uploadingDoc ? "Uploading…" : "Choose File"}
                  </button>
                </div>

                {(meeting.attachments ?? []).length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-xs text-neutral-400">No documents uploaded yet</p>
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
                          <span className="material-symbols-outlined text-[14px]">download</span>Download
                        </a>
                        <button onClick={() => handleDeleteDoc(att.id)}
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
              <h3 className="font-semibold text-neutral-900">Formally Assign Task</h3>
              <button onClick={() => setAssignItem(null)} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-3">
                <p className="text-xs text-neutral-500 mb-0.5">Action Item</p>
                <p className="text-sm font-medium text-neutral-800">{assignItem.description}</p>
              </div>
              <p className="text-xs text-neutral-500">
                This will create a formal tracked assignment in the Assignments module with the full approval workflow.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Assign To</label>
                  <select className="form-input" value={assignForm.assigned_to}
                    onChange={(e) => setAssignForm((p) => ({ ...p, assigned_to: e.target.value }))}>
                    <option value="">— Select staff member —</option>
                    {tenantUsers.map((u) => <option key={u.id} value={String(u.id)}>{u.name} — {u.job_title ?? ""}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Due Date <span className="text-red-500">*</span></label>
                    <input type="date" className="form-input" value={assignForm.due_date}
                      onChange={(e) => setAssignForm((p) => ({ ...p, due_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Priority</label>
                    <select className="form-input" value={assignForm.priority}
                      onChange={(e) => setAssignForm((p) => ({ ...p, priority: e.target.value }))}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-100">
              <button onClick={() => setAssignItem(null)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleAssign} disabled={assigning || !assignForm.due_date}
                className="btn-primary px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined text-[16px]">assignment_ind</span>
                {assigning ? "Assigning…" : "Create Assignment"}
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
            {item.status.replace("_", " ")}
          </span>
          {item.assignment_id && (
            <a href={`/assignments/${item.assignment_id}`}
              className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
              <span className="material-symbols-outlined text-[12px]">link</span>
              {item.assignment?.reference_number ?? "Assignment"}
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!item.assignment_id && !done && (
          <button onClick={onAssign} title="Formally assign"
            className="flex items-center gap-1 text-xs text-primary hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors">
            <span className="material-symbols-outlined text-[14px]">assignment_ind</span>Assign
          </button>
        )}
        <button onClick={onDelete} className="text-neutral-300 hover:text-red-500 transition-colors p-1">
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
          Record staff meetings, capture notes, assign tasks, and track action items through to completion.
        </p>
        <button onClick={() => setShowCreate(true)}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2 whitespace-nowrap">
          <span className="material-symbols-outlined text-[18px]">add</span>Record Meeting
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <input
          className="form-input w-56 text-sm"
          placeholder="Search meetings..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <div className="flex flex-wrap gap-2">
          {[{ v: "", l: "All Status" }, { v: "draft", l: "Draft" }, { v: "final", l: "Final" }].map(({ v, l }) => (
            <button key={v || "all-s"} onClick={() => { setStatusFilter(v); setPage(1); }}
              className={`filter-tab ${statusFilter === v ? "active" : ""}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button key="all-t" onClick={() => { setTypeFilter(""); setPage(1); }}
            className={`filter-tab ${typeFilter === "" ? "active" : ""}`}>All Types</button>
          {meetingTypes.map((t) => (
            <button key={t.id} onClick={() => { setTypeFilter(t.name); setPage(1); }}
              className={`filter-tab ${typeFilter === t.name ? "active" : ""}`}>{t.name}</button>
          ))}
        </div>
        <button onClick={() => setShowManageTypes(true)} title="Manage meeting types"
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
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-200 block mb-2">event_note</span>
            <p className="text-neutral-400 text-sm">No meeting minutes found</p>
            <button onClick={() => setShowCreate(true)}
              className="mt-3 btn-primary px-4 py-2 text-xs">Record first meeting</button>
          </div>
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
                        {new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-GB", { month: "short" })}
                      </p>
                      <p className="text-lg font-bold text-primary leading-none">
                        {new Date(m.meeting_date + "T00:00:00").getDate()}
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
                        {m.status === "final" ? "Final" : "Draft"}
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
                          {m.attendees.length} attendee{m.attendees.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Right side */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {open > 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <span className="material-symbols-outlined text-[12px]">pending_actions</span>
                        {open} open
                      </span>
                    )}
                    {(m.attachments ?? []).length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-neutral-400">
                        <span className="material-symbols-outlined text-[12px]">attach_file</span>
                        {m.attachments!.length} doc{m.attachments!.length !== 1 ? "s" : ""}
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
          <p className="text-sm text-neutral-500">{total} record{total !== 1 ? "s" : ""}</p>
          <div className="flex gap-2">
            <button className="btn-secondary px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <button className="btn-secondary px-3 py-1.5 text-xs" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next</button>
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
      <p className="page-subtitle">Track implementation progress of adopted resolutions across all committees and plenary sessions.</p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Adopted", icon: "gavel", value: counts["Adopted"] ?? 0, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "In Progress", icon: "pending", value: counts["In Progress"] ?? 0, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Implemented", icon: "task_alt", value: implemented, color: "text-teal-600", bg: "bg-teal-50" },
          { label: "Rejected", icon: "cancel", value: counts["Rejected"] ?? 0, color: "text-red-600", bg: "bg-red-50" },
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
            <p className="text-sm font-semibold text-neutral-700">Overall Implementation Rate</p>
            <p className="text-sm font-bold text-primary">{pct}%</p>
          </div>
          <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-neutral-400 mt-1">{implemented} of {total} resolutions implemented or actioned</p>
        </div>
      )}

      {/* Filter + List */}
      <div className="card p-4 flex flex-wrap gap-2">
        {["", ...trackerStatuses].map((s) => (
          <button key={s || "all"} onClick={() => setFilter(s)}
            className={`filter-tab ${filter === s ? "active" : ""}`}>{s || "All"}</button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-neutral-300 text-[28px]">progress_activity</span>
          </div>
        ) : resolutions.length === 0 ? (
          <div className="py-12 text-center">
            <span className="material-symbols-outlined text-3xl text-neutral-200 block mb-2">playlist_add_check</span>
            <p className="text-neutral-400 text-sm">No resolutions match this filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Resolution</th>
                  <th>Type</th>
                  <th>Adopted</th>
                  <th>Status</th>
                  <th className="text-right">Docs</th>
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
                        {r.type ?? "—"}
                      </span>
                    </td>
                    <td className="text-sm text-neutral-600 whitespace-nowrap">{fmtDate(r.adopted_at)}</td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle(r.status)}`}>
                        <span className={`size-1.5 rounded-full ${statusDot(r.status)}`} />{r.status}
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
  { id: "committee" as const,       label: "Committee Resolutions",  icon: "groups" },
  { id: "plenary" as const,         label: "Plenary Resolutions",     icon: "account_balance" },
  { id: "minutes" as const,         label: "Meeting Minutes",         icon: "event_note" },
  { id: "implementation" as const,  label: "Implementation Tracker",  icon: "playlist_add_check" },
];

export default function GovernancePage() {
  const [tab, setTab] = useState<"committee" | "plenary" | "minutes" | "implementation">("committee");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Governance</h1>
        <p className="page-subtitle">Parliamentary resolutions, plenary business, meeting minutes, and implementation tracking.</p>
      </div>

      {/* Tab bar */}
      <div className="card p-1 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${tab === t.id ? "bg-primary text-white shadow-sm" : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"}`}>
            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
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
