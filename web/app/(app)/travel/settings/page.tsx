"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormEvent, useEffect, useState } from "react";
import { travelApi } from "@/lib/api";

type DsaRate = {
  id: number;
  country: string;
  city?: string | null;
  rate_type: number;
  rate_per_day: number;
  currency: string;
  accommodation_component?: number | null;
  meal_component?: number | null;
  incidentals_component?: number | null;
  effective_from?: string | null;
  is_active: boolean;
};

type FxRate = {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  source: string;
  notes?: string | null;
};

const RATE_TYPE_LABELS: Record<number, string> = {
  1: "Type 1 — Acc + meals + incidentals",
  2: "Type 2 — Meals + incidentals",
  3: "Type 3 — Incidentals only",
};

const defaultDsaForm = {
  country: "Namibia",
  city: "",
  rate_type: 1,
  rate_per_day: 100,
  currency: "USD",
  accommodation_component: 60,
  meal_component: 30,
  incidentals_component: 10,
  effective_from: "2026-01-01",
  is_active: true,
};

const nonNegativeNumber = (value: string) => Math.max(0, Number(value));

const formatDate = (value?: string | null) => (value ? String(value).slice(0, 10) : "—");

const componentSummary = (rate: DsaRate) => {
  const parts = [
    rate.accommodation_component != null ? `Acc ${rate.accommodation_component}` : null,
    rate.meal_component != null ? `Meals ${rate.meal_component}` : null,
    rate.incidentals_component != null ? `Inc ${rate.incidentals_component}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
};

export default function TravelSettingsPage() {
  const [rates, setRates] = useState<DsaRate[]>([]);
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [sponsoredRates, setSponsoredRates] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({ ...defaultDsaForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fxForm, setFxForm] = useState({
    from_currency: "USD",
    to_currency: "NAD",
    rate: 18.5,
    effective_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [sponsoredForm, setSponsoredForm] = useState({
    name: "Host meals provided",
    code: "host_meals",
    meal_deduction_percent: 40,
    accommodation_deduction_percent: 0,
    is_active: true,
  });
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    travelApi.listDsaRates({ per_page: 100 }).then((r) => setRates((r.data.data as DsaRate[]) ?? []));
    travelApi.listFxRates({ per_page: 100 }).then((r) => setFxRates((r.data.data as FxRate[]) ?? [])).catch(() => setFxRates([]));
    travelApi.listSponsoredRates().then((r) => setSponsoredRates(r.data.data ?? [])).catch(() => setSponsoredRates([]));
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ ...defaultDsaForm });
    setEditingId(null);
  };

  const startEdit = (rate: DsaRate) => {
    setEditingId(rate.id);
    setForm({
      country: rate.country,
      city: rate.city ?? "",
      rate_type: rate.rate_type,
      rate_per_day: Number(rate.rate_per_day),
      currency: rate.currency,
      accommodation_component: Number(rate.accommodation_component ?? 0),
      meal_component: Number(rate.meal_component ?? 0),
      incidentals_component: Number(rate.incidentals_component ?? 0),
      effective_from: formatDate(rate.effective_from) === "—" ? defaultDsaForm.effective_from : formatDate(rate.effective_from),
      is_active: rate.is_active,
    });
    setMsg(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await travelApi.saveDsaRate({
        ...form,
        ...(editingId ? { id: editingId } : {}),
      });
      setMsg(editingId ? "DSA rate updated." : "DSA rate saved (Rate Types 1/2/3 register).");
      load();
      if (!editingId) {
        resetForm();
      } else {
        setEditingId(null);
        setForm({ ...defaultDsaForm });
      }
    } catch {
      setMsg("Failed to save DSA rate.");
    }
  };

  const onFxSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await travelApi.saveFxRate({ ...fxForm, source: "manual" });
      setMsg("FX rate saved (manual/admin table). Snapshotted onto DSA lines at calculation time.");
      load();
    } catch {
      setMsg("Failed to save FX rate.");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <ModulePageHeader
        title="Travel Settings — DSA & FX Rates"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Travel", href: "/travel" }, { label: "Settings" }]} />}
      />
      {msg && <p className="text-sm text-primary">{msg}</p>}

      <section data-testid="travel-dsa-settings">
        <h2 className="text-lg font-semibold text-neutral-900">DSA rate register</h2>
        <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 bg-neutral-50 border rounded-lg p-4 mt-3">
          <label className="text-xs font-semibold">Country
            <input className="form-input w-full mt-1" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </label>
          <label className="text-xs font-semibold">City
            <input className="form-input w-full mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Leave blank for country-level rate" />
          </label>
          <label className="text-xs font-semibold">Rate type
            <select className="form-input w-full mt-1" value={form.rate_type} onChange={(e) => setForm({ ...form, rate_type: Number(e.target.value) })}>
              <option value={1}>{RATE_TYPE_LABELS[1]}</option>
              <option value={2}>{RATE_TYPE_LABELS[2]}</option>
              <option value={3}>{RATE_TYPE_LABELS[3]}</option>
            </select>
          </label>
          <label className="text-xs font-semibold">Rate / day
            <input type="number" min={0} className="form-input w-full mt-1" value={form.rate_per_day} onChange={(e) => setForm({ ...form, rate_per_day: nonNegativeNumber(e.target.value) })} />
          </label>
          <label className="text-xs font-semibold">Currency
            <input className="form-input w-full mt-1" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
          </label>
          <label className="text-xs font-semibold">Effective from
            <input type="date" className="form-input w-full mt-1" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
          </label>
          <label className="text-xs font-semibold">Accommodation
            <input type="number" min={0} className="form-input w-full mt-1" value={form.accommodation_component} onChange={(e) => setForm({ ...form, accommodation_component: nonNegativeNumber(e.target.value) })} />
          </label>
          <label className="text-xs font-semibold">Meals
            <input type="number" min={0} className="form-input w-full mt-1" value={form.meal_component} onChange={(e) => setForm({ ...form, meal_component: nonNegativeNumber(e.target.value) })} />
          </label>
          <label className="text-xs font-semibold">Incidentals
            <input type="number" min={0} className="form-input w-full mt-1" value={form.incidentals_component} onChange={(e) => setForm({ ...form, incidentals_component: nonNegativeNumber(e.target.value) })} />
          </label>
          <label className="text-xs font-semibold flex items-center gap-2 mt-5">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Active rate
          </label>
          <div className="col-span-2 flex justify-end gap-2">
            {editingId && (
              <button type="button" className="btn-secondary py-2 px-4 text-sm" onClick={resetForm}>Cancel edit</button>
            )}
            <button type="submit" className="btn-primary py-2 px-4 text-sm" data-testid="travel-save-dsa">
              {editingId ? "Update DSA rate" : "Save DSA rate"}
            </button>
          </div>
        </form>
        <table className="data-table w-full mt-3">
          <thead>
            <tr>
              <th>Country</th>
              <th>City</th>
              <th>Type</th>
              <th>Components</th>
              <th>Rate/day</th>
              <th>Effective</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-neutral-400">No rates yet.</td></tr>
            ) : rates.map((r) => (
              <tr key={r.id}>
                <td>{r.country}</td>
                <td>{r.city ?? "—"}</td>
                <td>{RATE_TYPE_LABELS[r.rate_type] ?? r.rate_type}</td>
                <td className="text-xs text-neutral-600">{componentSummary(r)}</td>
                <td>{r.rate_per_day} {r.currency}</td>
                <td>{formatDate(r.effective_from)}</td>
                <td>{r.is_active ? "Yes" : "No"}</td>
                <td>
                  <button type="button" className="text-primary text-xs font-semibold" onClick={() => startEdit(r)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div data-testid="travel-fx-settings">
        <h2 className="text-lg font-semibold text-neutral-900 mt-8">FX rate register</h2>
        <form onSubmit={onFxSubmit} className="grid grid-cols-2 gap-3 bg-neutral-50 border rounded-lg p-4 mt-3">
          <label className="text-xs font-semibold">From
            <input className="form-input w-full mt-1" maxLength={3} value={fxForm.from_currency} onChange={(e) => setFxForm({ ...fxForm, from_currency: e.target.value.toUpperCase() })} />
          </label>
          <label className="text-xs font-semibold">To
            <input className="form-input w-full mt-1" maxLength={3} value={fxForm.to_currency} onChange={(e) => setFxForm({ ...fxForm, to_currency: e.target.value.toUpperCase() })} />
          </label>
          <label className="text-xs font-semibold">Rate
            <input type="number" step="0.000001" className="form-input w-full mt-1" value={fxForm.rate} onChange={(e) => setFxForm({ ...fxForm, rate: Number(e.target.value) })} />
          </label>
          <label className="text-xs font-semibold">Effective date
            <input type="date" className="form-input w-full mt-1" value={fxForm.effective_date} onChange={(e) => setFxForm({ ...fxForm, effective_date: e.target.value })} />
          </label>
          <label className="text-xs font-semibold col-span-2">Notes
            <input className="form-input w-full mt-1" value={fxForm.notes} onChange={(e) => setFxForm({ ...fxForm, notes: e.target.value })} />
          </label>
          <div className="col-span-2 flex justify-end">
            <button type="submit" className="btn-primary py-2 px-4 text-sm" data-testid="travel-save-fx">Save FX rate</button>
          </div>
        </form>
        <table className="data-table w-full mt-3">
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Rate</th>
              <th>Effective</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {fxRates.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-neutral-400">No FX rates yet.</td></tr>
            ) : fxRates.map((r) => (
              <tr key={r.id}>
                <td>{r.from_currency}</td>
                <td>{r.to_currency}</td>
                <td>{r.rate}</td>
                <td>{String(r.effective_date).slice(0, 10)}</td>
                <td>{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div data-testid="travel-sponsored-rates">
        <h2 className="text-lg font-semibold text-neutral-900 mt-8">Sponsored / top-up deduction rates</h2>
        <p className="text-sm text-neutral-500 mb-3">
          Policy table for Finance DSA meal/accommodation deductions when host or donor provides support. Percents apply to DSA rate components — not invented ad-hoc %.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await travelApi.saveSponsoredRate(sponsoredForm);
              setMsg("Sponsored deduction rate saved.");
              load();
            } catch {
              setMsg("Failed to save sponsored rate.");
            }
          }}
          className="grid grid-cols-2 gap-3 bg-neutral-50 border rounded-lg p-4"
        >
          <label className="text-xs font-semibold">Name
            <input className="form-input w-full mt-1" value={sponsoredForm.name} onChange={(e) => setSponsoredForm({ ...sponsoredForm, name: e.target.value })} />
          </label>
          <label className="text-xs font-semibold">Code
            <input className="form-input w-full mt-1" value={sponsoredForm.code} onChange={(e) => setSponsoredForm({ ...sponsoredForm, code: e.target.value })} />
          </label>
          <label className="text-xs font-semibold">Meal deduction %
            <input type="number" className="form-input w-full mt-1" value={sponsoredForm.meal_deduction_percent} onChange={(e) => setSponsoredForm({ ...sponsoredForm, meal_deduction_percent: Number(e.target.value) })} />
          </label>
          <label className="text-xs font-semibold">Accommodation deduction %
            <input type="number" className="form-input w-full mt-1" value={sponsoredForm.accommodation_deduction_percent} onChange={(e) => setSponsoredForm({ ...sponsoredForm, accommodation_deduction_percent: Number(e.target.value) })} />
          </label>
          <div className="col-span-2 flex justify-end">
            <button type="submit" className="btn-primary py-2 px-4 text-sm">Save policy rate</button>
          </div>
        </form>
        <table className="data-table w-full mt-3">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Meal %</th>
              <th>Accom %</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {sponsoredRates.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-neutral-400">No sponsored rates yet.</td></tr>
            ) : sponsoredRates.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.name)}</td>
                <td>{String(r.code)}</td>
                <td>{String(r.meal_deduction_percent ?? 0)}</td>
                <td>{String(r.accommodation_deduction_percent ?? 0)}</td>
                <td>{r.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
