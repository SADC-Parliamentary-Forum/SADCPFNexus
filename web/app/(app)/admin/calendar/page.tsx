"use client";

import { useState, useEffect } from "react";
import { calendarApi, type CalendarEntry, type CalendarEntryInput } from "@/lib/api";
import { getStoredUser, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/** Country labels are catalog keys, translated where they render. */
const SADC_COUNTRY_CODES: Record<string, string> = {
  NA: "admin.calendar.country.NA",
  ZA: "admin.calendar.country.ZA",
  ZW: "admin.calendar.country.ZW",
  BW: "admin.calendar.country.BW",
  MZ: "admin.calendar.country.MZ",
  ZM: "admin.calendar.country.ZM",
  MW: "admin.calendar.country.MW",
  TZ: "admin.calendar.country.TZ",
  AO: "admin.calendar.country.AO",
};

const BULK_EXAMPLE = `{
  "entries": [
    {"type": "sadc_holiday", "country_code": "NA", "date": "2025-03-21", "title": "Independence Day"},
    {"type": "un_day", "date": "2025-03-08", "title": "International Women's Day", "is_alert": true}
  ]
}`;

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

export default function AdminCalendarPage() {
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<"manage" | "single" | "bulk">("manage");
  const [type, setType] = useState<"sadc_holiday" | "un_day">("sadc_holiday");
  const [countryCode, setCountryCode] = useState<string>("NA");
  const [date, setDate] = useState<string>("");
  const [title, setTitle] = useState("");
  const [bulkJson, setBulkJson] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manage list
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [filterCountry, setFilterCountry] = useState<string>("");
  const [viewEntry, setViewEntry] = useState<CalendarEntry | null>(null);
  const [editEntry, setEditEntry] = useState<CalendarEntry | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(isSystemAdmin(getStoredUser()));
  }, []);

  useEffect(() => {
    if (!isAdmin && (tab === "single" || tab === "bulk")) setTab("manage");
  }, [isAdmin, tab]);

  const loadList = async () => {
    setLoadingList(true);
    try {
      const params: { year?: number; type?: string; country_code?: string; per_page: number } = { per_page: 500 };
      if (filterYear) params.year = filterYear;
      if (filterType) params.type = filterType;
      if (filterCountry) params.country_code = filterCountry;
      const res = await calendarApi.list(params);
      const data = res.data as { data?: CalendarEntry[] };
      setEntries(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (tab === "manage") loadList();
  }, [tab, filterType, filterYear, filterCountry]);

  const handleDeleteRequest = async (entry: CalendarEntry) => {
    if (
      !(await confirm({
        title: t("admin.calendar.deleteTitle"),
        message: t("admin.calendar.deleteMessage", { title: entry.title, date: formatDateShort(entry.date) }),
        confirmText: t("common.delete"),
        variant: "danger",
      }))
    ) return;
    setSubmitting(true);
    resetMessages();
    try {
      await calendarApi.delete(entry.id);
      setSuccess(t("admin.calendar.deleted"));
      toast.success(t("admin.calendar.deletedToast"));
      loadList();
    } catch (err) {
      setError(t("admin.calendar.deleteFailed"));
      toast.error(t("admin.calendar.deleteFailedTitle"), apiErrorMessage(err, t("admin.calendar.deleteFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !title.trim()) {
      setError(t("admin.calendar.dateTitleRequired"));
      return;
    }
    if (type === "sadc_holiday" && !countryCode) {
      setError(t("admin.calendar.countryRequired"));
      return;
    }
    setSubmitting(true);
    resetMessages();
    try {
      await calendarApi.create({
        type,
        country_code: type === "un_day" ? null : countryCode,
        date,
        title: title.trim(),
        is_alert: type === "un_day",
      });
      setSuccess(t("admin.calendar.created"));
      toast.success(t("admin.calendar.createdToast"));
      setTitle("");
      setDate("");
    } catch (err) {
      setError(t("admin.calendar.createFailed"));
      toast.error(t("admin.calendar.notCreated"), apiErrorMessage(err, t("admin.calendar.createFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = bulkJson.trim();
    if (!trimmed) {
      setError(t("admin.calendar.pasteJson"));
      return;
    }
    setSubmitting(true);
    resetMessages();
    try {
      const parsed = JSON.parse(trimmed) as { entries?: CalendarEntryInput[] };
      const entries = parsed.entries;
      if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error("entries array required");
      }
      await calendarApi.upload(entries);
      setSuccess(t("admin.calendar.entriesCreated", { count: entries.length }));
      toast.success(t("admin.calendar.uploaded"), t("admin.calendar.entriesCreated", { count: entries.length }));
      setBulkJson("");
      if (tab === "manage") loadList();
    } catch (err) {
      setError(t("admin.calendar.invalidJson"));
      toast.error(t("admin.calendar.notUploaded"), apiErrorMessage(err, t("admin.calendar.invalidJson")));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent, entryId: number, form: { type: string; country_code: string | null; date: string; title: string; description?: string | null; is_alert: boolean }) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    setSubmitting(true);
    resetMessages();
    try {
      await calendarApi.update(entryId, {
        type: form.type as CalendarEntryInput["type"],
        country_code: form.type === "un_day" ? null : form.country_code || null,
        date: form.date,
        title: form.title.trim(),
        description: form.description ?? null,
        is_alert: form.is_alert,
      });
      setSuccess(t("admin.calendar.updated"));
      toast.success(t("admin.calendar.updatedToast"));
      setEditEntry(null);
      loadList();
    } catch (err) {
      setError(t("admin.calendar.updateFailed"));
      toast.error(t("admin.calendar.notUpdated"), apiErrorMessage(err, t("admin.calendar.updateFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ModulePageHeader
        title={t("admin.home.calendarUpload")}
        subtitle={t("admin.calendar.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("admin.homeLabel"), href: "/admin" },
              { label: t("admin.home.calendarUpload") },
            ]}
          />
        }
      />

      {/* Tabs */}
      <div className="card p-1 flex gap-1">
        <button
          type="button"
          onClick={() => { setTab("manage"); resetMessages(); }}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === "manage" ? "bg-primary text-white shadow-sm" : "text-neutral-500 hover:bg-neutral-50"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">list</span>
          {t("admin.calendar.tabManage")}
        </button>
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => { setTab("single"); resetMessages(); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === "single" ? "bg-primary text-white shadow-sm" : "text-neutral-500 hover:bg-neutral-50"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">add_circle_outline</span>
              {t("admin.calendar.tabSingle")}
            </button>
            <button
              type="button"
              onClick={() => { setTab("bulk"); resetMessages(); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === "bulk" ? "bg-primary text-white shadow-sm" : "text-neutral-500 hover:bg-neutral-50"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              {t("admin.calendar.tabBulk")}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          {success}
        </div>
      )}

      {tab === "manage" && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-neutral-100 flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-neutral-700">{t("admin.calendar.filters")}</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="form-input py-1.5 text-sm w-40"
            >
              <option value="">{t("admin.calendar.allTypes")}</option>
              <option value="sadc_holiday">{t("admin.calendar.publicHolidays")}</option>
              <option value="un_day">{t("admin.calendar.unDays")}</option>
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="form-input py-1.5 text-sm w-28"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="form-input py-1.5 text-sm w-44"
            >
              <option value="">{t("admin.calendar.allCountries")}</option>
              {Object.entries(SADC_COUNTRY_CODES).map(([code, label]) => (
                <option key={code} value={code}>{t(label)}</option>
              ))}
            </select>
            <button type="button" onClick={loadList} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              {t("admin.common.refresh")}
            </button>
          </div>
          {loadingList ? (
            <div className="p-12 text-center text-neutral-500">{t("common.loading")}</div>
          ) : entries.length === 0 ? (
            <EmptyState icon="calendar_month" title={t("admin.calendar.noMatch")} />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("admin.common.date")}</th>
                    <th>{t("admin.common.title")}</th>
                    <th>{t("admin.common.type")}</th>
                    <th>{t("admin.calendar.country")}</th>
                    <th>{t("admin.calendar.alert")}</th>
                    <th className="w-32">{t("admin.common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="font-medium text-neutral-700 whitespace-nowrap">{formatDateShort(e.date)}</td>
                      <td>{e.title}</td>
                      <td>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          e.type === "un_day" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {e.type === "un_day" ? t("admin.calendar.unDay") : t("admin.calendar.publicHoliday")}
                        </span>
                      </td>
                      <td className="text-neutral-600">{e.country_code ?? "—"}</td>
                      <td>{e.is_alert ? t("admin.common.yes") : "—"}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setViewEntry(e)} className="btn-secondary text-xs">{t("admin.common.view")}</button>
                          {isAdmin && (
                            <>
                              <button type="button" onClick={() => setEditEntry(e)} className="btn-secondary text-xs">{t("common.edit")}</button>
                              <button type="button" onClick={() => handleDeleteRequest(e)} className="btn-secondary text-xs text-red-600">{t("common.delete")}</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "single" ? (
        <form onSubmit={handleSingleSubmit} className="card p-6 space-y-6 max-w-xl">
          <div>
            <p className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">{t("admin.common.type")}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("sadc_holiday")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  type === "sadc_holiday" ? "bg-primary/10 border-primary text-primary" : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                {t("admin.calendar.publicHoliday")}
              </button>
              <button
                type="button"
                onClick={() => { setType("un_day"); setCountryCode("NA"); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  type === "un_day" ? "bg-primary/10 border-primary text-primary" : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                {t("admin.calendar.unDay")}
              </button>
            </div>
          </div>

          {type === "sadc_holiday" && (
            <div>
              <label htmlFor="country" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
                {t("admin.calendar.countryLil")}
              </label>
              <select
                id="country"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="form-input"
              >
                {Object.entries(SADC_COUNTRY_CODES).map(([code, label]) => (
                  <option key={code} value={code}>{t(label)}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="date" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">{t("admin.common.date")}</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div>
            <label htmlFor="title" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">{t("admin.common.title")}</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("admin.calendar.titlePlaceholder")}
              className="form-input"
              required
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                {t("admin.calendar.creating")}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">add</span>
                {t("admin.calendar.addEntry")}
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleBulkSubmit} className="card p-6 space-y-4 max-w-2xl">
          <p className="text-sm text-neutral-600">
            {t("admin.calendar.bulkIntro")}{" "}
            {t("admin.calendar.bulkHolidays")} <code className="text-xs bg-neutral-100 px-1 rounded">{"country_code"}</code> {t("admin.calendar.bulkHolidaysCodes")}{" "}
            {t("admin.calendar.bulkUn")} <code className="text-xs bg-neutral-100 px-1 rounded">{`type: "un_day"`}</code>{t("admin.calendar.bulkUnNoCountry")}
          </p>
          <textarea
            value={bulkJson}
            onChange={(e) => setBulkJson(e.target.value)}
            placeholder={BULK_EXAMPLE}
            rows={14}
            className="form-input font-mono text-sm"
          />
          <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                {t("admin.calendar.uploading")}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">upload</span>
                {t("common.upload")}
              </>
            )}
          </button>
        </form>
      )}

      {/* View modal */}
      {viewEntry && (
        <Modal
          open
          title={t("admin.calendar.viewTitle")}
          onClose={() => setViewEntry(null)}
          size="md"
          footer={<button type="button" onClick={() => setViewEntry(null)} className="btn-secondary px-4 py-2 text-sm">{t("common.close")}</button>}
        >
          <dl className="space-y-2 text-sm">
            <div><dt className="font-semibold text-neutral-500 dark:text-neutral-400">{t("admin.common.date")}</dt><dd className="text-neutral-900 dark:text-neutral-100">{formatDateShort(viewEntry.date)}</dd></div>
            <div><dt className="font-semibold text-neutral-500 dark:text-neutral-400">{t("admin.common.title")}</dt><dd className="text-neutral-900 dark:text-neutral-100">{viewEntry.title}</dd></div>
            <div><dt className="font-semibold text-neutral-500 dark:text-neutral-400">{t("admin.common.type")}</dt><dd className="text-neutral-900 dark:text-neutral-100">{viewEntry.type === "un_day" ? t("admin.calendar.unDay") : t("admin.calendar.publicHoliday")}</dd></div>
            {viewEntry.country_code && <div><dt className="font-semibold text-neutral-500 dark:text-neutral-400">{t("admin.calendar.country")}</dt><dd className="text-neutral-900 dark:text-neutral-100">{viewEntry.country_code}</dd></div>}
            <div><dt className="font-semibold text-neutral-500 dark:text-neutral-400">{t("admin.calendar.showAsAlert")}</dt><dd className="text-neutral-900 dark:text-neutral-100">{viewEntry.is_alert ? t("admin.common.yes") : t("admin.common.no")}</dd></div>
            {viewEntry.description && <div><dt className="font-semibold text-neutral-500 dark:text-neutral-400">{t("admin.common.description")}</dt><dd className="text-neutral-700 dark:text-neutral-300">{viewEntry.description}</dd></div>}
          </dl>
        </Modal>
      )}

      {/* Edit modal */}
      {editEntry && (
        <EditCalendarModal
          entry={editEntry}
          countryCodes={SADC_COUNTRY_CODES}
          onClose={() => setEditEntry(null)}
          onSubmit={(e, form) => handleEditSubmit(e, editEntry.id, form)}
          submitting={submitting}
        />
      )}

    </div>
  );
}

function EditCalendarModal({
  entry,
  countryCodes,
  onClose,
  onSubmit,
  submitting,
}: {
  entry: CalendarEntry;
  countryCodes: Record<string, string>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent, form: { type: string; country_code: string | null; date: string; title: string; description?: string | null; is_alert: boolean }) => void;
  submitting: boolean;
}) {
  const [type, setType] = useState(entry.type);
  const [countryCode, setCountryCode] = useState(entry.country_code ?? "NA");
  const [date, setDate] = useState(entry.date);
  const [title, setTitle] = useState(entry.title);
  const [description, setDescription] = useState(entry.description ?? "");
  const [isAlert, setIsAlert] = useState(entry.is_alert);
  const { t } = useI18n();

  return (
    <Modal open title={t("admin.calendar.editTitle")} onClose={onClose} size="md">
      <form onSubmit={(e) => onSubmit(e, { type, country_code: type === "un_day" ? null : countryCode, date, title, description: description || null, is_alert: isAlert })} className="space-y-4">
          <div>
            <p className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">{t("admin.common.type")}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setType("sadc_holiday")} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${type === "sadc_holiday" ? "bg-primary/10 border-primary text-primary" : "border-neutral-200"}`}>{t("admin.calendar.publicHoliday")}</button>
              <button type="button" onClick={() => setType("un_day")} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${type === "un_day" ? "bg-primary/10 border-primary text-primary" : "border-neutral-200"}`}>{t("admin.calendar.unDay")}</button>
            </div>
          </div>
          {type === "sadc_holiday" && (
            <div>
              <label htmlFor="edit-cal-country" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">{t("admin.calendar.country")}</label>
              <select id="edit-cal-country" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="form-input">
                {Object.entries(countryCodes).map(([code, label]) => <option key={code} value={code}>{t(label)}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="edit-cal-date" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">{t("admin.common.date")}</label>
            <input id="edit-cal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" required />
          </div>
          <div>
            <label htmlFor="edit-cal-title" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">{t("admin.common.title")}</label>
            <input id="edit-cal-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="form-input" required />
          </div>
          <div>
            <label htmlFor="edit-cal-desc" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">{t("admin.calendar.descOptional")}</label>
            <textarea id="edit-cal-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="form-input resize-none" rows={2} />
          </div>
          {type === "un_day" && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit-is-alert" checked={isAlert} onChange={(e) => setIsAlert(e.target.checked)} className="rounded border-neutral-300" />
              <label htmlFor="edit-is-alert" className="text-sm text-neutral-700">{t("admin.calendar.showAsAlert")}</label>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
            <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm">
              {submitting ? t("admin.common.saving") : t("common.save")}
            </button>
          </div>
      </form>
    </Modal>
  );
}
