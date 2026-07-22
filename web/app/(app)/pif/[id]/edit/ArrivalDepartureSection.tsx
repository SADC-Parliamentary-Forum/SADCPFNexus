"use client";

import { useState } from "react";
import { programmeApi, type ProgrammeArrivalDeparture } from "@/lib/api";

type DraftRow = {
  category: string;
  arrival_date: string;
  departure_date: string;
  airport: string;
  flight_details: string;
  transport_required: boolean;
  accommodation_required: boolean;
  comments: string;
};

const emptyDraft: DraftRow = {
  category: "",
  arrival_date: "",
  departure_date: "",
  airport: "",
  flight_details: "",
  transport_required: false,
  accommodation_required: false,
  comments: "",
};

function toDraft(r: ProgrammeArrivalDeparture): DraftRow {
  return {
    category: r.category ?? "",
    arrival_date: r.arrival_date ?? "",
    departure_date: r.departure_date ?? "",
    airport: r.airport ?? "",
    flight_details: r.flight_details ?? "",
    transport_required: r.transport_required ?? false,
    accommodation_required: r.accommodation_required ?? false,
    comments: r.comments ?? "",
  };
}

function buildPayload(d: DraftRow): Partial<ProgrammeArrivalDeparture> {
  return {
    category: d.category.trim(),
    arrival_date: d.arrival_date || null,
    departure_date: d.departure_date || null,
    airport: d.airport.trim() || null,
    flight_details: d.flight_details.trim() || null,
    transport_required: d.transport_required,
    accommodation_required: d.accommodation_required,
    comments: d.comments.trim() || null,
  };
}

/** Mirrors the server-side rule in ProgrammeArrivalDepartureController: departure
 * must not be before arrival. Surfacing this client-side avoids a round-trip
 * for the most common input mistake. */
function validateDraft(d: DraftRow): string | null {
  if (!d.category.trim()) return "Category is required.";
  if (d.arrival_date && d.departure_date) {
    const arrival = new Date(d.arrival_date);
    const departure = new Date(d.departure_date);
    if (!Number.isNaN(arrival.getTime()) && !Number.isNaN(departure.getTime()) && departure < arrival) {
      return "Departure date must not be before arrival date.";
    }
  }
  return null;
}

export default function ArrivalDepartureSection({
  programmeId,
  initialRows,
  onToast,
}: {
  programmeId: number;
  initialRows: ProgrammeArrivalDeparture[];
  onToast: (msg: string) => void;
}) {
  const [rows, setRows] = useState<ProgrammeArrivalDeparture[]>(initialRows);
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
      const res = await programmeApi.updateArrivalDeparture(programmeId, id, buildPayload(draft));
      setRows((prev) => prev.map((r) => (r.id === id ? res.data.data : r)));
    } catch {
      onToast("Failed to save arrival/departure row.");
    }
  };

  const removeRow = async (id: number) => {
    try {
      await programmeApi.deleteArrivalDeparture(programmeId, id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onToast("Arrival/departure row removed.");
    } catch {
      onToast("Failed to remove arrival/departure row.");
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
      const res = await programmeApi.addArrivalDeparture(programmeId, buildPayload(pending));
      const created = res.data.data;
      setRows((prev) => [...prev, created]);
      setDrafts((prev) => ({ ...prev, [created.id]: toDraft(created) }));
      setPending(null);
      onToast("Arrival/departure row added.");
    } catch {
      onToast("Failed to add arrival/departure row.");
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
      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-1">Category <span className="text-red-500">*</span></label>
        <input className="form-input w-full" placeholder="e.g. Delegate, Speaker, Staff" value={draft.category} onChange={(e) => onChange({ category: e.target.value })} onBlur={onFieldBlur} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Arrival date</label>
          <input type="date" className="form-input w-full" value={draft.arrival_date} onChange={(e) => onChange({ arrival_date: e.target.value })} onBlur={onFieldBlur} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Departure date</label>
          <input type="date" className="form-input w-full" value={draft.departure_date} onChange={(e) => onChange({ departure_date: e.target.value })} onBlur={onFieldBlur} />
        </div>
      </div>
      {draft.arrival_date && draft.departure_date && new Date(draft.departure_date) < new Date(draft.arrival_date) && (
        <p className="text-xs text-red-500">Departure date must not be before arrival date.</p>
      )}
      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-1">Airport</label>
        <input className="form-input w-full" value={draft.airport} onChange={(e) => onChange({ airport: e.target.value })} onBlur={onFieldBlur} />
      </div>
      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-1">Flight details</label>
        <textarea rows={2} className="form-input w-full resize-none" value={draft.flight_details} onChange={(e) => onChange({ flight_details: e.target.value })} onBlur={onFieldBlur} />
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.transport_required}
            onChange={(e) => { onChange({ transport_required: e.target.checked }); onFieldBlur?.(); }}
            className="rounded border-neutral-300"
          />
          <span className="text-sm text-neutral-700">Transport required</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.accommodation_required}
            onChange={(e) => { onChange({ accommodation_required: e.target.checked }); onFieldBlur?.(); }}
            className="rounded border-neutral-300"
          />
          <span className="text-sm text-neutral-700">Accommodation required</span>
        </label>
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
              <span className="text-xs font-semibold text-neutral-500">Arrival / Departure</span>
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
          <span className="text-xs font-semibold text-primary">New row</span>
          {renderFields(pending, (patch) => setPending((p) => (p ? { ...p, ...patch } : p)))}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPending(null)} className="btn-secondary px-3 py-1.5 text-xs">Discard</button>
            <button type="button" disabled={saving} onClick={savePending} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
              {saving ? "Saving…" : "Save row"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setPending(emptyDraft)} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">add</span>
          Add arrival/departure row
        </button>
      )}
    </div>
  );
}
