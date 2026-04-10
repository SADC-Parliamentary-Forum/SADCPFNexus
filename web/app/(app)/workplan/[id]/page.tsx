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
import { cn, formatDate } from "@/lib/utils";

// ─── iCal export helper ────────────────────────────────────────────────────────
function toICalDate(dateStr: string, allDay = true): string {
  const d = new Date(dateStr + "T00:00:00");
  if (allDay) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function generateICS(event: WorkplanEvent): string {
  const dtStart = toICalDate(event.date);
  const dtEnd = event.end_date
    ? toICalDate(new Date(new Date(event.end_date + "T00:00:00").getTime() + 86400000).toISOString().slice(0, 10))
    : toICalDate(new Date(new Date(event.date + "T00:00:00").getTime() + 86400000).toISOString().slice(0, 10));
  const desc = (event.description ?? "").replace(/\n/g, "\\n");
  const uid = `sadcpf-event-${event.id}-${Date.now()}@sadcpf.org`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SADCPFNexus//WorkplanEvent//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SUMMARY:${event.title}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    desc ? `DESCRIPTION:${desc}` : null,
    `STATUS:CONFIRMED`,
    `TRANSP:TRANSPARENT`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  return lines;
}

function downloadICS(event: WorkplanEvent) {
  const ics = generateICS(event);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-z0-9]/gi, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function googleCalendarUrl(event: WorkplanEvent): string {
  const start = event.date.replace(/-/g, "");
  const endRaw = event.end_date ?? event.date;
  const endDate = new Date(endRaw + "T00:00:00");
  endDate.setDate(endDate.getDate() + 1);
  const end = endDate.toISOString().slice(0, 10).replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    details: event.description ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ─── Type badge colours ────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  meeting:   "bg-blue-100 text-blue-700 border-blue-200",
  travel:    "bg-amber-100 text-amber-700 border-amber-200",
  leave:     "bg-green-100 text-green-700 border-green-200",
  milestone: "bg-purple-100 text-purple-700 border-purple-200",
  deadline:  "bg-red-100 text-red-700 border-red-200",
};

const TYPE_ICONS: Record<string, string> = {
  meeting:   "groups",
  travel:    "flight",
  leave:     "beach_access",
  milestone: "flag",
  deadline:  "schedule",
};

// ─── Manage types modal ────────────────────────────────────────────────────────
function ManageTypesModal({
  title, items, onCreate, onUpdate, onDelete, onClose,
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
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
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
                    <button type="button" onClick={() => setEditId(null)} className="text-xs text-neutral-400">Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-neutral-800">{item.name}</span>
                    {item.locked && <span className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">system</span>}
                    {!item.locked && (
                      <>
                        <button type="button" onClick={() => { setEditId(item.id); setEditName(item.name); }} className="text-xs text-primary hover:underline">Edit</button>
                        <button type="button" disabled={busy} onClick={() => doDelete(item.id)} className="text-xs text-red-500 hover:underline disabled:opacity-50">Delete</button>
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

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function WorkplanEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id != null ? Number(params.id) : NaN;

  const [event, setEvent] = useState<WorkplanEvent | null>(null);
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [eventTypes, setEventTypes]     = useState<WorkplanEventType[]>([]);
  const [userOptions, setUserOptions]   = useState<TenantUserOption[]>([]);
  const [userSearch, setUserSearch]     = useState("");
  const [attachments, setAttachments]   = useState<WorkplanAttachment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [editMode, setEditMode]         = useState(false);
  const [manageEventTypes, setManageEventTypes]     = useState(false);
  const [manageMeetingTypes, setManageMeetingTypes] = useState(false);

  const [title, setTitle]             = useState("");
  const [type, setType]               = useState<WorkplanEvent["type"]>("meeting");
  const [meetingTypeId, setMeetingTypeId] = useState<number | "">("");
  const [date, setDate]               = useState("");
  const [endDate, setEndDate]         = useState("");
  const [description, setDescription] = useState("");
  const [responsibleUserIds, setResponsibleUserIds]             = useState<number[]>([]);
  const [selectedResponsibleUsers, setSelectedResponsibleUsers] = useState<TenantUserOption[]>([]);
  const [responsibleSearchOpen, setResponsibleSearchOpen]       = useState(false);

  const loadEvent = useCallback(async () => {
    if (!Number.isFinite(id)) { router.replace("/workplan"); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await workplanApi.get(id);
      const ev  = res.data;
      setEvent(ev);
      setTitle(ev.title);
      setType(ev.type);
      setMeetingTypeId(ev.meeting_type_id ?? "");
      setDate(ev.date.slice(0, 10));
      setEndDate(ev.end_date ? ev.end_date.slice(0, 10) : "");
      setDescription(ev.description ?? "");
      const ids = ev.responsible_users?.map((u) => u.id) ?? [];
      setResponsibleUserIds(ids);
      setSelectedResponsibleUsers((ev.responsible_users ?? []).map((u) => ({ id: u.id, name: u.name, email: u.email })));
      setAttachments(ev.attachments ?? []);
    } catch {
      setError("Failed to load event.");
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  const reloadEventTypes   = () => workplanEventTypesApi.list().then((r) => setEventTypes(r.data?.data ?? [])).catch(() => {});
  const reloadMeetingTypes = () => workplanMeetingTypesApi.list().then((r) => setMeetingTypes(r.data?.data ?? [])).catch(() => {});

  useEffect(() => { reloadMeetingTypes(); reloadEventTypes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUsers = useCallback(() => {
    tenantUsersApi.list(userSearch ? { search: userSearch } : undefined)
      .then((r) => setUserOptions(r.data?.data ?? []))
      .catch(() => setUserOptions([]));
  }, [userSearch]);

  useEffect(() => { if (responsibleSearchOpen) loadUsers(); }, [responsibleSearchOpen, loadUsers]);

  const addResponsible = (u: TenantUserOption) => {
    if (responsibleUserIds.includes(u.id)) return;
    setResponsibleUserIds((p) => [...p, u.id]);
    setSelectedResponsibleUsers((p) => [...p, u]);
    setUserSearch(""); setResponsibleSearchOpen(false);
  };
  const removeResponsible = (uid: number) => {
    setResponsibleUserIds((p) => p.filter((x) => x !== uid));
    setSelectedResponsibleUsers((p) => p.filter((u) => u.id !== uid));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setError(null); setSaving(true);
    try {
      await workplanApi.update(event.id, {
        title: title.trim(), type, date,
        end_date: endDate || undefined,
        description: description.trim() || undefined,
        meeting_type_id: type === "meeting" && meetingTypeId !== "" ? Number(meetingTypeId) : null,
        responsible_user_ids: responsibleUserIds,
      });
      setEditMode(false);
      loadEvent();
    } catch {
      setError("Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!event || !e.target.files?.length) return;
    setUploading(true); setError(null);
    try {
      for (const file of Array.from(e.target.files)) await workplanAttachmentsApi.upload(event.id, file);
      const listRes = await workplanAttachmentsApi.list(event.id);
      setAttachments(listRes.data?.data ?? []);
      loadEvent();
    } catch { setError("Failed to upload file(s)."); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!event) return;
    try {
      await workplanAttachmentsApi.delete(event.id, attachmentId);
      setAttachments((p) => p.filter((a) => a.id !== attachmentId));
    } catch { setError("Failed to delete attachment."); }
  };

  const handleDownloadAttachment = async (a: WorkplanAttachment) => {
    if (!event) return;
    try {
      const blob = await workplanAttachmentsApi.downloadBlob(event.id, a.id);
      const url  = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = a.original_filename; link.click();
      URL.revokeObjectURL(url);
    } catch { setError("Failed to download file."); }
  };

  // ─── Loading / error states ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="h-6 w-48 bg-neutral-100 rounded animate-pulse" />
        <div className="h-10 w-80 bg-neutral-100 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map((i) => <div key={i} className="card h-24 animate-pulse bg-neutral-50" />)}
        </div>
        <div className="card h-40 animate-pulse bg-neutral-50" />
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        <Link href="/workplan" className="text-sm font-semibold text-primary hover:underline">Back to Workplan</Link>
      </div>
    );
  }

  if (!event) return null;

  const typeColor  = TYPE_COLORS[event.type] ?? "bg-neutral-100 text-neutral-700 border-neutral-200";
  const typeIcon   = TYPE_ICONS[event.type] ?? "event";
  const durationMs = event.end_date ? new Date(event.end_date).getTime() - new Date(event.date).getTime() : 0;
  const durationDays = Math.max(0, Math.ceil(durationMs / 86400000));
  const nowMs     = Date.now();
  const startMs   = new Date(event.date).getTime();
  const endMs     = event.end_date ? new Date(event.end_date).getTime() : startMs;
  const timelinePercent = durationDays > 0
    ? Math.max(0, Math.min(100, ((nowMs - startMs) / (endMs - startMs)) * 100))
    : (nowMs > startMs ? 100 : 0);
  const isUpcoming = startMs > nowMs;
  const isPast     = endMs < nowMs;
  const statusLabel = isUpcoming ? "Upcoming" : isPast ? "Completed" : "In Progress";
  const statusColor = isUpcoming ? "bg-blue-100 text-blue-700 border-blue-200" : isPast ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200";

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-neutral-500">
        <Link href="/workplan" className="hover:text-primary transition-colors">Workplan</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium truncate max-w-[300px]">{event.title}</span>
      </div>

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <span className={cn("inline-flex items-center gap-1 text-xs font-semibold rounded border px-2.5 py-0.5 uppercase tracking-wide", typeColor)}>
              <span className="material-symbols-outlined text-[14px]">{typeIcon}</span>
              {event.type}
            </span>
            {event.meeting_type && (
              <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded px-2 py-0.5 border border-neutral-200">
                {event.meeting_type.name}
              </span>
            )}
            <span className={cn("inline-flex text-xs font-semibold rounded border px-2.5 py-0.5 uppercase tracking-wide", statusColor)}>
              {statusLabel}
            </span>
          </div>
          <h1 className="page-title">{event.title}</h1>
          <p className="page-subtitle">
            {formatDate(event.date)}
            {event.end_date ? ` – ${formatDate(event.end_date)}` : ""}
            {durationDays > 0 && ` · ${durationDays} day${durationDays !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* iCal / Google Calendar export */}
          <button
            type="button"
            onClick={() => downloadICS(event)}
            title="Download .ics (Apple Calendar / Outlook)"
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <span className="material-symbols-outlined text-[16px]">event</span>
            Add to Calendar
          </button>
          <a
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            title="Add to Google Calendar"
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            Google
          </a>
          {!editMode ? (
            <>
              <button type="button" onClick={() => setEditMode(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-[18px]">edit</span>
                Edit
              </button>
              <label className="btn-primary flex items-center gap-1.5 text-sm cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                {uploading ? "Uploading…" : "Attach File"}
                <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </>
          ) : (
            <button type="button" onClick={() => setEditMode(false)} className="btn-secondary text-sm">
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* KPI summary cards */}
      {!editMode && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-neutral-500 font-medium">Timeline Progress</p>
              <span className="material-symbols-outlined text-neutral-300 text-[18px]">timeline</span>
            </div>
            <p className="text-xl font-bold text-neutral-900">{Math.round(timelinePercent)}%</p>
            <div className="mt-2 w-full bg-neutral-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${timelinePercent}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-neutral-400">
              <span>{formatDate(event.date)}</span>
              <span>{event.end_date ? formatDate(event.end_date) : "—"}</span>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-neutral-500 font-medium">Responsible Staff</p>
              <span className="material-symbols-outlined text-neutral-300 text-[18px]">groups</span>
            </div>
            <p className="text-xl font-bold text-neutral-900">{event.responsible_users?.length ?? 0}</p>
            <div className="mt-2 flex -space-x-2">
              {(event.responsible_users ?? []).slice(0, 5).map((u) => (
                <div key={u.id} title={u.name}
                  className="h-7 w-7 rounded-full bg-primary/10 text-primary border-2 border-white flex items-center justify-center text-[11px] font-bold">
                  {u.name[0]}
                </div>
              ))}
              {(event.responsible_users?.length ?? 0) > 5 && (
                <div className="h-7 w-7 rounded-full bg-neutral-100 text-neutral-500 border-2 border-white flex items-center justify-center text-[10px] font-bold">
                  +{(event.responsible_users?.length ?? 0) - 5}
                </div>
              )}
              {(event.responsible_users?.length ?? 0) === 0 && (
                <p className="text-xs text-neutral-400">Not assigned</p>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-neutral-500 font-medium">Documents</p>
              <span className="material-symbols-outlined text-neutral-300 text-[18px]">attach_file</span>
            </div>
            <p className="text-xl font-bold text-neutral-900">{attachments.length}</p>
            <p className="text-xs text-neutral-400 mt-1">
              {attachments.length === 0 ? "No attachments yet" : `${attachments.length} file${attachments.length !== 1 ? "s" : ""} attached`}
            </p>
          </div>
        </div>
      )}

      {/* Edit form or view detail */}
      {editMode ? (
        <form onSubmit={handleSave} className="card p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input type="text" className="form-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-neutral-700">Event type <span className="text-red-500">*</span></label>
              <button type="button" onClick={() => setManageEventTypes(true)} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[13px]">settings</span>Manage
              </button>
            </div>
            <select className="form-input w-full" value={type} onChange={(e) => setType(e.target.value as WorkplanEvent["type"])}>
              {eventTypes.map((et) => <option key={et.slug} value={et.slug}>{et.name}</option>)}
            </select>
          </div>
          {type === "meeting" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-semibold text-neutral-700">Meeting Category</label>
                <button type="button" onClick={() => setManageMeetingTypes(true)} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">settings</span>Manage
                </button>
              </div>
              <select className="form-input w-full" value={meetingTypeId}
                onChange={(e) => setMeetingTypeId(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">— Select —</option>
                {meetingTypes.map((mt) => <option key={mt.id} value={mt.id}>{mt.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">Date <span className="text-red-500">*</span></label>
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
                  <button type="button" onClick={() => removeResponsible(u.id)}>
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input type="text" className="form-input w-full" placeholder="Search by name or email…"
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setResponsibleSearchOpen(true); }}
                onFocus={() => setResponsibleSearchOpen(true)} />
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: description + team */}
          <div className="lg:col-span-2 space-y-5">
            {/* Description */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-primary text-[18px]">description</span>
                <h3 className="text-sm font-semibold text-neutral-800">Description</h3>
              </div>
              {event.description ? (
                <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{event.description}</p>
              ) : (
                <p className="text-sm text-neutral-400 italic">No description provided.</p>
              )}
            </div>

            {/* Team / Responsible */}
            {(event.responsible_users?.length ?? 0) > 0 && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-[18px]">groups</span>
                  <h3 className="text-sm font-semibold text-neutral-800">Responsible Staff</h3>
                  <span className="text-xs bg-neutral-100 text-neutral-500 rounded-full px-2 py-0.5">{event.responsible_users?.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {event.responsible_users?.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 rounded-xl bg-neutral-50 border border-neutral-100 px-4 py-2.5">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center flex-shrink-0">
                        {u.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-800 truncate">{u.name}</p>
                        <p className="text-[11px] text-neutral-400 truncate">{u.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: metadata */}
          <div className="space-y-4">
            <div className="card p-5 space-y-3">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Event Details</h3>
              <div className="space-y-2.5">
                {[
                  { icon: "calendar_today",   label: "Start Date",   val: formatDate(event.date) },
                  { icon: "event",             label: "End Date",     val: event.end_date ? formatDate(event.end_date) : "—" },
                  { icon: "category",          label: "Type",         val: event.type },
                  { icon: "label",             label: "Category",     val: event.meeting_type?.name ?? "—" },
                  { icon: "person",            label: "Created by",   val: event.creator?.name ?? "—" },
                  { icon: "attach_file",       label: "Attachments",  val: `${attachments.length} file${attachments.length !== 1 ? "s" : ""}` },
                ].map(({ icon, label, val }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-neutral-300 text-[16px] flex-shrink-0">{icon}</span>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-xs text-neutral-400">{label}</span>
                      <span className="text-xs font-medium text-neutral-700 capitalize">{val}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attachments */}
      {!editMode && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 bg-neutral-50">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-neutral-400">attach_file</span>
              <span className="text-sm font-semibold text-neutral-700">Attachments</span>
              {attachments.length > 0 && (
                <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full">{attachments.length}</span>
              )}
            </div>
            <label className={cn("btn-secondary text-xs flex items-center gap-1.5 cursor-pointer", uploading ? "opacity-50 pointer-events-none" : "")}>
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              {uploading ? "Uploading…" : "Upload"}
              <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
          {attachments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-neutral-300">
              <span className="material-symbols-outlined text-[32px]">attach_file</span>
              <p className="text-sm text-neutral-400">No documents attached yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-50">
              {attachments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-[16px]">description</span>
                  </div>
                  <span className="text-sm font-medium text-neutral-800 flex-1 truncate">{a.original_filename}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button type="button" onClick={() => handleDownloadAttachment(a)}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">download</span>
                      Download
                    </button>
                    <button type="button" onClick={() => handleDeleteAttachment(a.id)}
                      className="text-xs text-red-500 hover:underline">
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Back link */}
      <div>
        <Link href="/workplan" className="text-sm text-neutral-500 hover:text-primary transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Workplan
        </Link>
      </div>

      {manageEventTypes && (
        <ManageTypesModal title="Event Types"
          items={eventTypes.map((et) => ({ id: et.id, name: et.name, locked: et.is_system }))}
          onCreate={(name) => workplanEventTypesApi.create({ name }).then(() => reloadEventTypes())}
          onUpdate={(id, name) => workplanEventTypesApi.update(id, { name }).then(() => reloadEventTypes())}
          onDelete={(id) => workplanEventTypesApi.delete(id).then(() => reloadEventTypes())}
          onClose={() => setManageEventTypes(false)} />
      )}
      {manageMeetingTypes && (
        <ManageTypesModal title="Meeting Categories"
          items={meetingTypes.map((mt) => ({ id: mt.id, name: mt.name, locked: false }))}
          onCreate={(name) => workplanMeetingTypesApi.create({ name }).then(() => reloadMeetingTypes())}
          onUpdate={(id, name) => workplanMeetingTypesApi.update(id, { name }).then(() => reloadMeetingTypes())}
          onDelete={(id) => workplanMeetingTypesApi.delete(id).then(() => reloadMeetingTypes())}
          onClose={() => setManageMeetingTypes(false)} />
      )}
    </div>
  );
}
