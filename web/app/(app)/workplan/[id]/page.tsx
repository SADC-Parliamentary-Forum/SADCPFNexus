"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  workplanApi,
  workplanMeetingTypesApi,
  workplanEventTypesApi,
  workplanAttachmentsApi,
  tenantUsersApi,
  type WorkplanEvent,
  type MeetingType,
  type WorkplanEventType,
  type TenantUserOption,
  type WorkplanAttachment,
} from "@/lib/api";
import { useFormatDate } from "@/lib/useFormatDate";

// ─── Reusable inline manage-types modal ──────────────────────────────────────

function ManageTypesModal({
  title,
  items,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: {
  title: string;
  items: { id: number; name: string; locked: boolean }[];
  onCreate: (name: string) => Promise<unknown>;
  onUpdate: (id: number, name: string) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [editId, setEditId]   = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);

  const doCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true); setErr(null);
    try { await onCreate(newName.trim()); setNewName(""); } catch { setErr("Could not create."); }
    finally { setBusy(false); }
  };

  const doUpdate = async () => {
    if (editId === null || !editName.trim()) return;
    setBusy(true); setErr(null);
    try { await onUpdate(editId, editName.trim()); setEditId(null); } catch { setErr("Could not update."); }
    finally { setBusy(false); }
  };

  const doDelete = async (id: number) => {
    if (!confirm("Delete this item?")) return;
    setBusy(true); setErr(null);
    try { await onDelete(id); } catch { setErr("Could not delete."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h3 className="font-semibold text-neutral-900">Manage {title}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}
          <div className="space-y-1.5">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
                {editId === item.id ? (
                  <>
                    <input autoFocus className="form-input flex-1 py-1 text-sm" value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") doUpdate(); if (e.key === "Escape") setEditId(null); }} />
                    <button type="button" disabled={busy} onClick={doUpdate} className="text-xs font-semibold text-primary hover:underline disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => setEditId(null)} className="text-xs text-neutral-400 hover:text-neutral-600">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-neutral-800">{item.name}</span>
                    {item.locked && <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">system</span>}
                    {!item.locked && (
                      <>
                        <button type="button" onClick={() => { setEditId(item.id); setEditName(item.name); }}
                          className="text-xs text-primary hover:underline">Edit</button>
                        <button type="button" disabled={busy} onClick={() => doDelete(item.id)}
                          className="text-xs text-red-500 hover:underline disabled:opacity-50">Delete</button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
            {items.length === 0 && <p className="text-xs text-neutral-400 text-center py-4">No items yet.</p>}
          </div>
          <div className="flex gap-2 pt-1 border-t border-neutral-100">
            <input className="form-input flex-1 text-sm" placeholder={`New ${title.replace(/s$/, "")} name…`}
              value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doCreate(); }} />
            <button type="button" disabled={busy || !newName.trim()} onClick={doCreate}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50">Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WorkplanEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { fmt: formatDate } = useFormatDate();
  const id = params?.id != null ? Number(params.id) : NaN;
  const [event, setEvent] = useState<WorkplanEvent | null>(null);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [eventTypes, setEventTypes] = useState<WorkplanEventType[]>([]);
  const [userOptions, setUserOptions] = useState<TenantUserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [attachments, setAttachments] = useState<WorkplanAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [manageEventTypes, setManageEventTypes] = useState(false);
  const [manageMeetingTypes, setManageMeetingTypes] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<WorkplanEvent["type"]>("meeting");
  const [meetingTypeId, setMeetingTypeId] = useState<number | "">("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [responsibleUserIds, setResponsibleUserIds] = useState<number[]>([]);
  const [selectedResponsibleUsers, setSelectedResponsibleUsers] = useState<TenantUserOption[]>([]);
  const [responsibleSearchOpen, setResponsibleSearchOpen] = useState(false);

  const loadEvent = useCallback(async () => {
    if (!Number.isFinite(id)) {
      router.replace("/workplan");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await workplanApi.get(id);
      const ev = res.data;
      setEvent(ev);
      setTitle(ev.title);
      setType(ev.type);
      setMeetingTypeId(ev.meeting_type_id ?? "");
      setDate(ev.date.slice(0, 10));
      setEndDate(ev.end_date ? ev.end_date.slice(0, 10) : "");
      setDescription(ev.description ?? "");
      const ids = ev.responsible_users?.map((u) => u.id) ?? [];
      setResponsibleUserIds(ids);
      setSelectedResponsibleUsers(
        (ev.responsible_users ?? []).map((u) => ({ id: u.id, name: u.name, email: u.email }))
      );
      setAttachments(ev.attachments ?? []);
    } catch {
      setError("Failed to load event.");
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const reloadEventTypes   = () => workplanEventTypesApi.list().then((r) => setEventTypes(r.data?.data ?? [])).catch(() => {});
  const reloadMeetingTypes = () => workplanMeetingTypesApi.list().then((r) => setMeetingTypes(r.data?.data ?? [])).catch(() => {});

  useEffect(() => {
    reloadMeetingTypes();
    reloadEventTypes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = useCallback(() => {
    tenantUsersApi.list(userSearch ? { search: userSearch } : undefined)
      .then((r) => setUserOptions(r.data?.data ?? []))
      .catch(() => setUserOptions([]));
  }, [userSearch]);

  useEffect(() => {
    if (responsibleSearchOpen) loadUsers();
  }, [responsibleSearchOpen, loadUsers]);

  const addResponsible = (u: TenantUserOption) => {
    if (responsibleUserIds.includes(u.id)) return;
    setResponsibleUserIds((prev) => [...prev, u.id]);
    setSelectedResponsibleUsers((prev) => [...prev, u]);
    setUserSearch("");
    setResponsibleSearchOpen(false);
  };
  const removeResponsible = (id: number) => {
    setResponsibleUserIds((prev) => prev.filter((x) => x !== id));
    setSelectedResponsibleUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setError(null);
    setSaving(true);
    try {
      await workplanApi.update(event.id, {
        title: title.trim(),
        type,
        date,
        end_date: endDate || undefined,
        description: description.trim() || undefined,
        meeting_type_id: type === "meeting" && meetingTypeId !== "" ? Number(meetingTypeId) : null,
        responsible_user_ids: responsibleUserIds,
      });
      setEditMode(false);
      loadEvent();
    } catch (err: unknown) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!event || !e.target.files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(e.target.files)) {
        await workplanAttachmentsApi.upload(event.id, file);
      }
      const listRes = await workplanAttachmentsApi.list(event.id);
      setAttachments(listRes.data?.data ?? []);
      loadEvent();
    } catch {
      setError("Failed to upload file(s).");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!event) return;
    try {
      await workplanAttachmentsApi.delete(event.id, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch {
      setError("Failed to delete attachment.");
    }
  };

  const handleDownloadAttachment = async (a: WorkplanAttachment) => {
    if (!event) return;
    try {
      const blob = await workplanAttachmentsApi.downloadBlob(event.id, a.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = a.original_filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download file.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center justify-center py-20 text-neutral-500">
          <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
          <span className="ml-2">Loading…</span>
        </div>
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        <Link href="/workplan" className="text-sm font-semibold text-primary hover:underline">Back to Workplan</Link>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/workplan" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-block">
            Workplan
          </Link>
          <h1 className="page-title">{event.title}</h1>
          <p className="page-subtitle">
            {formatDate(event.date)}
            {event.end_date ? ` – ${formatDate(event.end_date)}` : ""}
            {event.meeting_type && ` · ${event.meeting_type.name}`}
          </p>
        </div>
        {!editMode ? (
          <button type="button" onClick={() => setEditMode(true)} className="btn-secondary py-2 px-3 text-sm">
            Edit
          </button>
        ) : (
          <button type="button" onClick={() => setEditMode(false)} className="btn-secondary py-2 px-3 text-sm">
            Cancel edit
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {editMode ? (
        <form onSubmit={handleSave} className="card p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Title *</label>
            <input type="text" className="form-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-neutral-700">Event type *</label>
              <button type="button" onClick={() => setManageEventTypes(true)}
                className="text-xs text-primary hover:underline flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[13px]">settings</span>Manage
              </button>
            </div>
            <select className="form-input w-full" value={type} onChange={(e) => setType(e.target.value as WorkplanEvent["type"])}>
              {eventTypes.map((et) => (
                <option key={et.slug} value={et.slug}>{et.name}</option>
              ))}
            </select>
          </div>
          {type === "meeting" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-semibold text-neutral-700">Meeting Category</label>
                <button type="button" onClick={() => setManageMeetingTypes(true)}
                  className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">settings</span>Manage
                </button>
              </div>
              <select
                className="form-input w-full"
                value={meetingTypeId}
                onChange={(e) => setMeetingTypeId(e.target.value === "" ? "" : Number(e.target.value))}
              >
                <option value="">— Select —</option>
                {meetingTypes.map((mt) => (
                  <option key={mt.id} value={mt.id}>{mt.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">Date *</label>
              <input type="date" className="form-input w-full" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">End date</label>
              <input type="date" className="form-input w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Description</label>
            <textarea className="form-input w-full min-h-[100px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Responsible persons</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedResponsibleUsers.map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-sm">
                  {u.name}
                  <button type="button" onClick={() => removeResponsible(u.id)} className="hover:opacity-80">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                className="form-input w-full"
                placeholder="Search by name or email..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setResponsibleSearchOpen(true); }}
                onFocus={() => setResponsibleSearchOpen(true)}
              />
              {responsibleSearchOpen && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-neutral-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                  {userOptions.filter((u) => !responsibleUserIds.includes(u.id)).slice(0, 10).map((u) => (
                    <button key={u.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex justify-between" onClick={() => addResponsible(u)}>
                      <span>{u.name}</span>
                      <span className="text-neutral-500 text-xs">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={() => setEditMode(false)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      ) : (
        <div className="card p-5 space-y-3">
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{event.description || "—"}</p>
          {event.responsible_users?.length ? (
            <p className="text-sm"><span className="font-semibold text-neutral-700">Responsible:</span> {event.responsible_users.map((u) => u.name).join(", ")}</p>
          ) : event.responsible && <p className="text-sm"><span className="font-semibold text-neutral-700">Responsible:</span> {event.responsible}</p>}
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Attachments</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <label className="btn-secondary py-2 px-3 text-sm cursor-pointer flex items-center gap-1 disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            {uploading ? "Uploading…" : "Upload file(s)"}
            <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>
        {attachments.length === 0 ? (
          <p className="text-sm text-neutral-500">No documents attached.</p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-sm">
                <span className="font-medium text-neutral-800 truncate">{a.original_filename}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownloadAttachment(a)}
                    className="text-primary font-medium hover:underline"
                  >
                    Download
                  </button>
                  <button type="button" onClick={() => handleDeleteAttachment(a.id)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-3">
        <Link href="/workplan" className="text-sm font-semibold text-primary hover:underline">Back to Workplan</Link>
      </div>

      {/* Manage Event Types modal */}
      {manageEventTypes && (
        <ManageTypesModal
          title="Event Types"
          items={eventTypes.map((et) => ({ id: et.id, name: et.name, locked: et.is_system }))}
          onCreate={(name) => workplanEventTypesApi.create({ name }).then(() => reloadEventTypes())}
          onUpdate={(id, name) => workplanEventTypesApi.update(id, { name }).then(() => reloadEventTypes())}
          onDelete={(id) => workplanEventTypesApi.delete(id).then(() => reloadEventTypes())}
          onClose={() => setManageEventTypes(false)}
        />
      )}

      {/* Manage Meeting Categories modal */}
      {manageMeetingTypes && (
        <ManageTypesModal
          title="Meeting Categories"
          items={meetingTypes.map((mt) => ({ id: mt.id, name: mt.name, locked: false }))}
          onCreate={(name) => workplanMeetingTypesApi.create({ name }).then(() => reloadMeetingTypes())}
          onUpdate={(id, name) => workplanMeetingTypesApi.update(id, { name }).then(() => reloadMeetingTypes())}
          onDelete={(id) => workplanMeetingTypesApi.delete(id).then(() => reloadMeetingTypes())}
          onClose={() => setManageMeetingTypes(false)}
        />
      )}
    </div>
  );
}
