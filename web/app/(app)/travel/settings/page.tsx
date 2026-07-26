"use client";

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

export default function TravelSettingsPage() {
  const [rates, setRates] = useState<DsaRate[]>([]);
  const [fxRates, setFxRates] = useState<FxRate[]>([]);
  const [sponsoredRates, setSponsoredRates] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({
    country: "Namibia",
    city: "",
    rate_type: 1,
    rate_per_day: 100,
    currency: "USD",
    accommodation_component: 60,
    meal_component: 30,
    incidentals_component: 10,
  });
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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await travelApi.saveDsaRate(form);
      setMsg("DSA rate saved (Rate Types 1/2/3 register).");
      load();
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
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Travel Settings — DSA &amp; FX Rates</h1>
        <p className="text-sm text-neutral-500">
          Finance-owned versioned DSA rates (Types 1/2/3) and manual FX table. Optional HTTP FX feed via env only — no paid API keys in code.
        </p>
      </div>
      {msg && <p className="text-sm text-primary">{msg}</p>}
      <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 bg-neutral-50 border rounded-lg p-4">
        <label className="text-xs font-semibold">Country
          <input className="form-input w-full mt-1" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </label>
        <label className="text-xs font-semibold">City
          <input className="form-input w-full mt-1" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </label>
        <label className="text-xs font-semibold">Rate type
          <select className="form-input w-full mt-1" value={form.rate_type} onChange={(e) => setForm({ ...form, rate_type: Number(e.target.value) })}>
            <option value={1}>Type 1</option>
            <option value={2}>Type 2</option>
            <option value={3}>Type 3</option>
          </select>
        </label>
        <label className="text-xs font-semibold">Rate / day
          <input type="number" className="form-input w-full mt-1" value={form.rate_per_day} onChange={(e) => setForm({ ...form, rate_per_day: Number(e.target.value) })} />
        </label>
        <label className="text-xs font-semibold">Accommodation
          <input type="number" className="form-input w-full mt-1" value={form.accommodation_component} onChange={(e) => setForm({ ...form, accommodation_component: Number(e.target.value) })} />
        </label>
        <label className="text-xs font-semibold">Meals
          <input type="number" className="form-input w-full mt-1" value={form.meal_component} onChange={(e) => setForm({ ...form, meal_component: Number(e.target.value) })} />
        </label>
        <label className="text-xs font-semibold">Incidentals
          <input type="number" className="form-input w-full mt-1" value={form.incidentals_component} onChange={(e) => setForm({ ...form, incidentals_component: Number(e.target.value) })} />
        </label>
        <div className="col-span-2 flex justify-end">
          <button type="submit" className="btn-primary py-2 px-4 text-sm">Save DSA rate</button>
        </div>
      </form>
      <table className="data-table w-full">
        <thead>
          <tr>
            <th>Country</th>
            <th>City</th>
            <th>Type</th>
            <th>Rate/day</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {rates.length === 0 ? (
            <tr><td colSpan={5} className="py-8 text-center text-neutral-400">No rates yet.</td></tr>
          ) : rates.map((r) => (
            <tr key={r.id}>
              <td>{r.country}</td>
              <td>{r.city ?? "—"}</td>
              <td>{r.rate_type}</td>
              <td>{r.rate_per_day} {r.currency}</td>
              <td>{r.is_active ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
