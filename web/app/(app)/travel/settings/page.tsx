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

export default function TravelSettingsPage() {
  const [rates, setRates] = useState<DsaRate[]>([]);
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
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    travelApi.listDsaRates({ per_page: 100 }).then((r) => setRates((r.data.data as DsaRate[]) ?? []));
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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Travel Settings — DSA Rate Register</h1>
        <p className="text-sm text-neutral-500">
          Finance-owned versioned rates with Types 1/2/3. Workflow: Supervisor → Administration Officer → Finance Controller → Director → SG.
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
          <button type="submit" className="btn-primary py-2 px-4 text-sm">Save rate</button>
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
    </div>
  );
}
