"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { calendarApi, type CalendarEntry, type CalendarEntryInput } from "@/lib/api";
import { getStoredUser, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";

const SADC_COUNTRY_CODES: Record<string, string> = {
  NA: "Namibia (LIL uses NA only)",
  ZA: "South Africa",
  ZW: "Zimbabwe",
  BW: "Botswana",
  MZ: "Mozambique",
  ZM: "Zambia",
  MW: "Malawi",
  TZ: "Tanzania",
  AO: "Angola",
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
  const [deleteEntry, setDeleteEntry] = useState<CalendarEntry | null>(null);
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

  const handleDeleteConfirm = async () => {
    if (!deleteEntry) return;
    setSubmitting(true);
    resetMessages();
    try {
      await calendarApi.delete(deleteEntry.id);
      setSuccess("Entry deleted.");
      setDeleteEntry(null);
      loadList();
    } catch {
      setError("Failed to delete entry.");
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
      setError("Date and title are required.");
      return;
    }
    if (type === "sadc_holiday" && !countryCode) {
      setError("Country is required for public holidays.");
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
      setSuccess("Entry created.");
      setTitle("");
      setDate("");
    } catch {
      setError("Failed to create entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = bulkJson.trim();
    if (!trimmed) {
      setError("Paste JSON with entries array.");
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
      setSuccess(`${entries.length} entries created.`);
      setBulkJson("");
      if (tab === "manage") loadList();
    } catch {
      setError("Invalid JSON or upload failed. Check format.");
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
      setSuccess("Entry updated.");
      setEditEntry(null);
      loadList();
    } catch {
      setError("Failed to update entry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-700 mb-1 block">
            ← Admin
          </Link>
          <h1 className="page-title">Calendar Upload</h1>
          <p className="page-subtitle">
            Upload SADC public holidays, UN days, and calendar entries. Public holidays can be for the whole SADC region.
            Leave in lieu uses Namibia (NA) holidays only.
          </p>
        </div>
      </div>

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
          Manage
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
              Single Entry
            </button>
            <button
              type="button"
              onClick={() => { setTab("bulk"); resetMessages(); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === "bulk" ? "bg-primary text-white shadow-sm" : "text-neutral-500 hover:bg-neutral-50"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              Bulk Upload
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
            <span className="text-sm font-semibold text-neutral-700">Filters</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="form-input py-1.5 text-sm w-40"
            >
              <option value="">All types</option>
              <option value="sadc_holiday">Public holidays</option>
              <option value="un_day">UN days</option>
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
              <option value="">All countries</option>
              {Object.entries(SADC_COUNTRY_CODES).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            <button type="button" onClick={loadList} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Refresh
            </button>
          </div>
          {loadingList ? (
            <div className="p-12 text-center text-neutral-500">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center text-neutral-500">No entries match the filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Country</th>
                    <th>Alert</th>
                    <th className="w-32">Actions</th>
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
                          {e.type === "un_day" ? "UN Day" : "Public Holiday"}
                        </span>
                      </td>
                      <td className="text-neutral-600">{e.country_code ?? "—"}</td>
                      <td>{e.is_alert ? "Yes" : "—"}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => setViewEntry(e)} className="text-primary hover:underline text-xs font-medium">View</button>
                          {isAdmin && (
                            <>
                              <button type="button" onClick={() => setEditEntry(e)} className="text-primary hover:underline text-xs font-medium">Edit</button>
                              <button type="button" onClick={() => setDeleteEntry(e)} className="text-red-600 hover:underline text-xs font-medium">Delete</button>
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
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("sadc_holiday")}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  type === "sadc_holiday" ? "bg-primary/10 border-primary text-primary" : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                Public Holiday
              </button>
              <button
                type="button"
                onClick={() => { setType("un_day"); setCountryCode("NA"); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  type === "un_day" ? "bg-primary/10 border-primary text-primary" : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                UN Day
              </button>
            </div>
          </div>

          {type === "sadc_holiday" && (
            <div>
              <label htmlFor="country" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
                Country (LIL uses Namibia only)
              </label>
              <select
                id="country"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="form-input"
              >
                {Object.entries(SADC_COUNTRY_CODES).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="date" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Date</label>
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
            <label htmlFor="title" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Independence Day"
              className="form-input"
              required
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Creating…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Entry
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleBulkSubmit} className="card p-6 space-y-4 max-w-2xl">
          <p className="text-sm text-neutral-600">
            Paste JSON with an entries array. Public holidays: use <code className="text-xs bg-neutral-100 px-1 rounded">country_code</code> (NA, ZA, ZW, etc.).
            UN days: use <code className="text-xs bg-neutral-100 px-1 rounded">type: &quot;un_day&quot;</code>, no country_code.
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
                Uploading…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Upload
              </>
            )}
          </button>
        </form>
      )}

      {/* View modal */}
      {viewEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setViewEntry(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold text-neutral-900">View entry</h2>
              <button type="button" onClick={() => setViewEntry(null)} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div><dt className="font-semibold text-neutral-500">Date</dt><dd className="text-neutral-900">{formatDateShort(viewEntry.date)}</dd></div>
              <div><dt className="font-semibold text-neutral-500">Title</dt><dd className="text-neutral-900">{viewEntry.title}</dd></div>
              <div><dt className="font-semibold text-neutral-500">Type</dt><dd className="text-neutral-900">{viewEntry.type === "un_day" ? "UN Day" : "Public Holiday"}</dd></div>
              {viewEntry.country_code && <div><dt className="font-semibold text-neutral-500">Country</dt><dd className="text-neutral-900">{viewEntry.country_code}</dd></div>}
              <div><dt className="font-semibold text-neutral-500">Show as alert</dt><dd className="text-neutral-900">{viewEntry.is_alert ? "Yes" : "No"}</dd></div>
              {viewEntry.description && <div><dt className="font-semibold text-neutral-500">Description</dt><dd className="text-neutral-700">{viewEntry.description}</dd></div>}
            </dl>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setViewEntry(null)} className="btn-secondary px-4 py-2 text-sm">Close</button>
            </div>
          </div>
        </div>
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

      {/* Delete confirm modal */}
      {deleteEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setDeleteEntry(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-neutral-900 mb-2">Delete entry?</h2>
            <p className="text-sm text-neutral-600 mb-4">
              &quot;{deleteEntry.title}&quot; ({formatDateShort(deleteEntry.date)}) will be removed.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteEntry(null)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={handleDeleteConfirm} disabled={submitting} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                Delete
              </button>
            </div>
          </div>
        </div>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-bold text-neutral-900">Edit entry</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <form onSubmit={(e) => onSubmit(e, { type, country_code: type === "un_day" ? null : countryCode, date, title, description: description || null, is_alert: isAlert })} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Type</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setType("sadc_holiday")} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${type === "sadc_holiday" ? "bg-primary/10 border-primary text-primary" : "border-neutral-200"}`}>Public Holiday</button>
              <button type="button" onClick={() => setType("un_day")} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${type === "un_day" ? "bg-primary/10 border-primary text-primary" : "border-neutral-200"}`}>UN Day</button>
            </div>
          </div>
          {type === "sadc_holiday" && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Country</label>
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="form-input">
                {Object.entries(countryCodes).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" required />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="form-input" required />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">Description (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="form-input resize-none" rows={2} />
          </div>
          {type === "un_day" && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="edit-is-alert" checked={isAlert} onChange={(e) => setIsAlert(e.target.checked)} className="rounded border-neutral-300" />
              <label htmlFor="edit-is-alert" className="text-sm text-neutral-700">Show as alert</label>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm">
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
