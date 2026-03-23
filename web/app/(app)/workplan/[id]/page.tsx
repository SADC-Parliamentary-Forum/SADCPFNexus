"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  workplanApi,
  workplanMeetingTypesApi,
  workplanAttachmentsApi,
  tenantUsersApi,
  type WorkplanEvent,
  type MeetingType,
  type TenantUserOption,
  type WorkplanAttachment,
} from "@/lib/api";

const TYPE_OPTIONS = [
  { value: "meeting", label: "Meeting" },
  { value: "travel", label: "Travel" },
  { value: "leave", label: "Leave" },
  { value: "milestone", label: "Milestone" },
  { value: "deadline", label: "Deadline" },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function WorkplanEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id != null ? Number(params.id) : NaN;
  const [event, setEvent] = useState<WorkplanEvent | null>(null);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [userOptions, setUserOptions] = useState<TenantUserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [attachments, setAttachments] = useState<WorkplanAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"meeting" | "travel" | "leave" | "milestone" | "deadline">("meeting");
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

  useEffect(() => {
    workplanMeetingTypesApi.list().then((r) => setMeetingTypes(r.data?.data ?? [])).catch(() => setMeetingTypes([]));
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
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Event type *</label>
            <select className="form-input w-full" value={type} onChange={(e) => setType(e.target.value as "meeting" | "travel" | "leave" | "milestone" | "deadline")}>
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {type === "meeting" && (
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">Kind of meeting</label>
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
    </div>
  );
}
