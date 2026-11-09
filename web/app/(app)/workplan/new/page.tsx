"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { workplanApi, workplanMeetingTypesApi, workplanEventTypesApi, tenantUsersApi, type MeetingType, type WorkplanEventType, type TenantUserOption, type WorkplanEvent } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function NewWorkplanEventPage() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [eventTypes, setEventTypes] = useState<WorkplanEventType[]>([]);
  const [userOptions, setUserOptions] = useState<TenantUserOption[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<WorkplanEvent["type"]>("meeting");
  const [meetingTypeId, setMeetingTypeId] = useState<number | "">("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [responsibleUserIds, setResponsibleUserIds] = useState<number[]>([]);
  const [selectedResponsibleUsers, setSelectedResponsibleUsers] = useState<TenantUserOption[]>([]);
  const [responsibleSearchOpen, setResponsibleSearchOpen] = useState(false);

  useEffect(() => {
    workplanMeetingTypesApi.list().then((r) => setMeetingTypes(r.data?.data ?? [])).catch(() => setMeetingTypes([]));
    workplanEventTypesApi.list().then((r) => {
      const types = r.data?.data ?? [];
      setEventTypes(types);
      if (types.length > 0) setType(types[0].slug as WorkplanEvent["type"]);
    }).catch(() => setEventTypes([]));
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
      setError(t("workplan.new.required"));
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
      toast.success(t("workplan.new.created"), title.trim());
      router.push(`/workplan/${res.data.data.id}`);
    } catch (err: unknown) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : t("workplan.new.failed"));
      toast.error(t("workplan.new.notCreated"), apiErrorMessage(err, t("workplan.new.failed")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("workplan.new.title")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.workplan", href: "/workplan" }, { label: t("workplan.new.title") }]} />}
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <div>
          <label htmlFor="workplan-new-title" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.new.titleLabel")}</label>
          <input id="workplan-new-title"
            type="text"
            className="form-input w-full"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("workplan.new.titlePlaceholder")}
            required
          />
        </div>
        <div>
          <label htmlFor="workplan-new-event-type" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.new.eventType")}</label>
          <select id="workplan-new-event-type" className="form-input w-full" value={type} onChange={(e) => setType(e.target.value as WorkplanEvent["type"])} required>
            {eventTypes.map((et) => (
              <option key={et.slug} value={et.slug}>{et.name}</option>
            ))}
          </select>
        </div>
        {type === "meeting" && (
          <div>
            <label htmlFor="workplan-new-meeting-category" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.new.meetingCategory")}</label>
            <select id="workplan-new-meeting-category"
              className="form-input w-full"
              value={meetingTypeId}
              onChange={(e) => setMeetingTypeId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">{t("workplan.new.select")}</option>
              {meetingTypes.map((mt) => (
                <option key={mt.id} value={mt.id}>{mt.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="workplan-new-date" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.new.date")}</label>
            <input id="workplan-new-date"
              type="date"
              className="form-input w-full"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="workplan-new-end-date" className="block text-sm font-semibold text-neutral-700 mb-1">{t("common.endDate")}</label>
            <input id="workplan-new-end-date"
              type="date"
              className="form-input w-full"
              min={date || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label htmlFor="workplan-new-description" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.meetingTypes.description")}</label>
          <textarea id="workplan-new-description"
            className="form-input w-full min-h-[100px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("workplan.new.descriptionPlaceholder")}
          />
        </div>
        <div>
          <label htmlFor="workplan-new-responsible-search" className="block text-sm font-semibold text-neutral-700 mb-1">{t("workplan.new.responsible")}</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedResponsibleUsers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-3 py-1 text-sm"
              >
                {u.name}
                <button type="button" onClick={() => removeResponsible(u.id)} aria-label={t("workplan.new.removePerson", { name: u.name })} className="hover:opacity-80">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </span>
            ))}
          </div>
          <div className="relative">
            <input
              id="workplan-new-responsible-search"
              type="text"
              className="form-input w-full"
              placeholder={t("workplan.new.searchPlaceholder")}
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
                  <p className="px-3 py-2 text-sm text-neutral-500">{t("workplan.new.noMatches")}</p>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-1">{t("workplan.new.responsibleHint")}</p>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">{loading ? "progress_activity" : "add"}</span>
            {loading ? t("workplan.new.creating") : t("workplan.new.submit")}
          </button>
          <Link href="/workplan" className="btn-secondary px-4 py-2 text-sm">
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}
