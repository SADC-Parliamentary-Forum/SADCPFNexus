"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { workplanApi, workplanMeetingTypesApi, tenantUsersApi, type MeetingType, type TenantUserOption } from "@/lib/api";

const TYPE_OPTIONS = [
  { value: "meeting", label: "Meeting" },
  { value: "travel", label: "Travel" },
  { value: "leave", label: "Leave" },
  { value: "milestone", label: "Milestone" },
  { value: "deadline", label: "Deadline" },
];

export default function NewWorkplanEventPage() {
  const router = useRouter();
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [userOptions, setUserOptions] = useState<TenantUserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"meeting" | "travel" | "leave" | "milestone" | "deadline">("meeting");
  const [meetingTypeId, setMeetingTypeId] = useState<number | "">("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [responsibleUserIds, setResponsibleUserIds] = useState<number[]>([]);
  const [selectedResponsibleUsers, setSelectedResponsibleUsers] = useState<TenantUserOption[]>([]);
  const [responsibleSearchOpen, setResponsibleSearchOpen] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !date) {
      setError("Title and date are required.");
      return;
    }
    setLoading(true);
    try {
      const res = await workplanApi.create({
        title: title.trim(),
        type,
        date,
        end_date: endDate || undefined,
        description: description.trim() || undefined,
        meeting_type_id: type === "meeting" && meetingTypeId ? Number(meetingTypeId) : undefined,
        responsible_user_ids: responsibleUserIds.length ? responsibleUserIds : undefined,
      });
      router.push(`/workplan/${res.data.data.id}`);
    } catch (err: unknown) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Failed to create event.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/workplan" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-block">
          Workplan
        </Link>
        <h1 className="page-title">Add event</h1>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-1">Title *</label>
          <input
            type="text"
            className="form-input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-1">Event type *</label>
          <select className="form-input w-full" value={type} onChange={(e) => setType(e.target.value as "meeting" | "travel" | "leave" | "milestone" | "deadline")} required>
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
            <input
              type="date"
              className="form-input w-full"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">End date</label>
            <input
              type="date"
              className="form-input w-full"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-1">Description</label>
          <textarea
            className="form-input w-full min-h-[100px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-neutral-700 mb-1">Responsible persons</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedResponsibleUsers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-sm"
              >
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
                {userOptions
                  .filter((u) => !responsibleUserIds.includes(u.id))
                  .slice(0, 10)
                  .map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center justify-between"
                      onClick={() => addResponsible(u)}
                    >
                      <span>{u.name}</span>
                      <span className="text-neutral-500 text-xs">{u.email}</span>
                    </button>
                  ))}
                {userOptions.filter((u) => !responsibleUserIds.includes(u.id)).length === 0 && userSearch && (
                  <p className="px-3 py-2 text-sm text-neutral-500">No matches</p>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-1">Start typing to search and add people. You can attach documents after saving.</p>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">{loading ? "progress_activity" : "add"}</span>
            {loading ? "Creating…" : "Create event"}
          </button>
          <Link href="/workplan" className="btn-secondary px-4 py-2 text-sm">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
