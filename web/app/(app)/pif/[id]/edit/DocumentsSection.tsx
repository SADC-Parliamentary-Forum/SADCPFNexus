"use client";

import { useState } from "react";
import { programmeApi, type ProgrammeDocument } from "@/lib/api";

type TenantUser = { id: number; name: string; email: string };

type DraftRow = {
  title: string;
  document_type: string;
  word_count: string;
  translation_required: boolean;
  source_language: string;
  target_languages: string;
  owner_user_id: number | "";
  owner_name: string;
  owner_organisation: string;
  deadline: string;
  budget_line: string;
  comments: string;
};

const emptyDraft: DraftRow = {
  title: "",
  document_type: "",
  word_count: "",
  translation_required: false,
  source_language: "",
  target_languages: "",
  owner_user_id: "",
  owner_name: "",
  owner_organisation: "",
  deadline: "",
  budget_line: "",
  comments: "",
};

function toDraft(d: ProgrammeDocument): DraftRow {
  return {
    title: d.title ?? "",
    document_type: d.document_type ?? "",
    word_count: d.word_count != null ? String(d.word_count) : "",
    translation_required: d.translation_required ?? false,
    source_language: d.source_language ?? "",
    target_languages: (d.target_languages ?? []).join(", "),
    owner_user_id: d.owner_user_id ?? "",
    owner_name: d.owner_name ?? "",
    owner_organisation: d.owner_organisation ?? "",
    deadline: d.deadline ?? "",
    budget_line: d.budget_line ?? "",
    comments: d.comments ?? "",
  };
}

function buildPayload(d: DraftRow): Partial<ProgrammeDocument> {
  return {
    title: d.title.trim(),
    document_type: d.document_type.trim(),
    word_count: d.word_count ? parseInt(d.word_count, 10) : null,
    translation_required: d.translation_required,
    source_language: d.source_language.trim() || null,
    target_languages: d.translation_required
      ? d.target_languages.split(",").map((s) => s.trim()).filter(Boolean)
      : null,
    owner_user_id: d.owner_user_id === "" ? null : d.owner_user_id,
    owner_name: d.owner_name.trim() || null,
    owner_organisation: d.owner_organisation.trim() || null,
    deadline: d.deadline || null,
    budget_line: d.budget_line.trim() || null,
    comments: d.comments.trim() || null,
  };
}

function validateDraft(d: DraftRow): string | null {
  if (!d.title.trim()) return "Title is required.";
  if (!d.document_type.trim()) return "Document type is required.";
  if (d.translation_required && !d.target_languages.trim()) {
    return "Target language(s) are required when translation is required.";
  }
  if (d.owner_user_id === "" && !d.owner_name.trim()) {
    return "Provide an owner (select a user or enter an owner name).";
  }
  return null;
}

export default function DocumentsSection({
  programmeId,
  initialRows,
  tenantUsers,
  onToast,
}: {
  programmeId: number;
  initialRows: ProgrammeDocument[];
  tenantUsers: TenantUser[];
  onToast: (msg: string) => void;
}) {
  const [rows, setRows] = useState<ProgrammeDocument[]>(initialRows);
  const [drafts, setDrafts] = useState<Record<number, DraftRow>>(() =>
    Object.fromEntries(initialRows.map((r) => [r.id, toDraft(r)]))
  );
  const [pending, setPending] = useState<DraftRow | null>(null);
  const [saving, setSaving] = useState(false);

  const updateDraft = (id: number, patch: Partial<DraftRow>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const persistRow = async (id: number) => {
    const draft = drafts[id];
    if (!draft) return;
    const err = validateDraft(draft);
    if (err) {
      onToast(err);
      return;
    }
    try {
      const res = await programmeApi.updateDocument(programmeId, id, buildPayload(draft));
      setRows((prev) => prev.map((r) => (r.id === id ? res.data.data : r)));
    } catch {
      onToast("Failed to save document row.");
    }
  };

  const removeRow = async (id: number) => {
    try {
      await programmeApi.deleteDocument(programmeId, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onToast("Document removed.");
    } catch {
      onToast("Failed to remove document row.");
    }
  };

  const savePending = async () => {
    if (!pending) return;
    const err = validateDraft(pending);
    if (err) {
      onToast(err);
      return;
    }
    setSaving(true);
    try {
      const res = await programmeApi.addDocument(programmeId, buildPayload(pending));
      const created = res.data.data;
      setRows((prev) => [...prev, created]);
      setDrafts((prev) => ({ ...prev, [created.id]: toDraft(created) }));
      setPending(null);
      onToast("Document added.");
    } catch {
      onToast("Failed to add document.");
    } finally {
      setSaving(false);
    }
  };

  const renderFields = (
    draft: DraftRow,
    onChange: (patch: Partial<DraftRow>) => void,
    onFieldBlur?: () => void
  ) => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Title <span className="text-red-500">*</span></label>
          <input className="form-input w-full" value={draft.title} onChange={(e) => onChange({ title: e.target.value })} onBlur={onFieldBlur} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Document type <span className="text-red-500">*</span></label>
          <input className="form-input w-full" placeholder="e.g. Concept Note, Agenda, Report" value={draft.document_type} onChange={(e) => onChange({ document_type: e.target.value })} onBlur={onFieldBlur} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Word count</label>
          <input type="number" min="0" className="form-input w-full" value={draft.word_count} onChange={(e) => onChange({ word_count: e.target.value })} onBlur={onFieldBlur} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Budget line</label>
          <input className="form-input w-full" value={draft.budget_line} onChange={(e) => onChange({ budget_line: e.target.value })} onBlur={onFieldBlur} />
        </div>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={draft.translation_required}
          onChange={(e) => {
            onChange({ translation_required: e.target.checked });
            onFieldBlur?.();
          }}
          className="rounded border-neutral-300"
        />
        <span className="text-sm text-neutral-700">Translation required</span>
      </label>
      {draft.translation_required && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Source language</label>
            <input className="form-input w-full" value={draft.source_language} onChange={(e) => onChange({ source_language: e.target.value })} onBlur={onFieldBlur} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Target language(s) <span className="text-red-500">*</span></label>
            <p className="text-xs text-neutral-400 mb-1">Comma-separated, e.g. French, Portuguese</p>
            <input className="form-input w-full" value={draft.target_languages} onChange={(e) => onChange({ target_languages: e.target.value })} onBlur={onFieldBlur} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Owner (registered user)</label>
          <select
            className="form-input w-full"
            value={draft.owner_user_id === "" ? "" : String(draft.owner_user_id)}
            onChange={(e) => onChange({ owner_user_id: e.target.value === "" ? "" : Number(e.target.value) })}
            onBlur={onFieldBlur}
          >
            <option value="">Select owner…</option>
            {tenantUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Or owner name (external)</label>
          <input className="form-input w-full" value={draft.owner_name} onChange={(e) => onChange({ owner_name: e.target.value })} onBlur={onFieldBlur} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Owner organisation</label>
          <input className="form-input w-full" value={draft.owner_organisation} onChange={(e) => onChange({ owner_organisation: e.target.value })} onBlur={onFieldBlur} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Deadline</label>
          <input type="date" className="form-input w-full" value={draft.deadline} onChange={(e) => onChange({ deadline: e.target.value })} onBlur={onFieldBlur} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-1">Comments</label>
        <textarea rows={2} className="form-input w-full resize-none" value={draft.comments} onChange={(e) => onChange({ comments: e.target.value })} onBlur={onFieldBlur} />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const draft = drafts[row.id] ?? toDraft(row);
        return (
          <div key={row.id} className="rounded-xl border border-neutral-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-500">Document</span>
              <button type="button" onClick={() => removeRow(row.id)} className="text-neutral-300 hover:text-red-500">
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
            {renderFields(draft, (patch) => updateDraft(row.id, patch), () => persistRow(row.id))}
          </div>
        );
      })}

      {pending ? (
        <div className="rounded-xl border-2 border-dashed border-primary/40 p-4 space-y-3">
          <span className="text-xs font-semibold text-primary">New document</span>
          {renderFields(pending, (patch) => setPending((p) => (p ? { ...p, ...patch } : p)))}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPending(null)} className="btn-secondary px-3 py-1.5 text-xs">Discard</button>
            <button type="button" disabled={saving} onClick={savePending} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
              {saving ? "Saving…" : "Save document"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setPending(emptyDraft)} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">add</span>
          Add document
        </button>
      )}
    </div>
  );
}
