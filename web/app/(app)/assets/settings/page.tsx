"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Policy = {
  id: number;
  version: string;
  threshold_amount: number;
  threshold_currency: string;
  effective_from: string;
  is_active: boolean;
};

type Location = { id: number; code: string; name: string; building?: string };

export default function AssetSettingsPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    api.get<{ data: Policy[] }>("/assets-meta/capitalisation-policies")
      .then((r) => setPolicies(r.data ?? []))
      .catch(() => setPolicies([]));
    api.get<{ data: Location[] }>("/assets-meta/locations")
      .then((r) => setLocations(r.data ?? []))
      .catch(() => setLocations([]));
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Settings</h1>
          <p className="page-subtitle">Versioned capitalisation policy and structured locations</p>
        </div>
      </div>

      <section className="card" style={{ padding: "1rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Capitalisation policies</h2>
        <p className="text-muted">Threshold is not hard-coded — historical assets keep the policy at acquisition.</p>
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>Version</th><th>Threshold</th><th>Effective from</th><th>Active</th></tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <tr key={p.id}>
                <td>{p.version}</td>
                <td>{p.threshold_currency} {Number(p.threshold_amount).toFixed(2)}</td>
                <td>{p.effective_from}</td>
                <td>{p.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {policies.length === 0 && <tr><td colSpan={4}>No policies — default USD 250 is created on first capitalisation.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ padding: "1rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Locations</h2>
        <table className="data-table" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>Code</th><th>Name</th><th>Building</th></tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>{l.code}</td>
                <td>{l.name}</td>
                <td>{l.building ?? "—"}</td>
              </tr>
            ))}
            {locations.length === 0 && <tr><td colSpan={3}>No locations configured.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
