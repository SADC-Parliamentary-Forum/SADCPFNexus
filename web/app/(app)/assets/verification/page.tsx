"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Campaign = { id: number; name: string; status: string; starts_on: string; ends_on?: string };

export default function AssetVerificationPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await api.get<{ data: Campaign[] }>("/assets-meta/verification-campaigns");
    setCampaigns(Array.isArray(r.data.data) ? r.data.data : []);
  }

  useEffect(() => { load().catch(() => setCampaigns([])); }, []);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/assets-meta/verification-campaigns", { name, starts_on: startsOn });
    setName("");
    setMsg("Campaign created.");
    await load();
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Physical Verification</h1>
          <p className="page-subtitle">Campaigns for inventory checks; missing/damaged results update asset status</p>
        </div>
      </div>
      {msg && <div className="alert alert-success">{msg}</div>}
      <form onSubmit={createCampaign} className="card" style={{ padding: "1rem", marginBottom: "1.5rem", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input className="input" placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
        <button className="btn btn-primary" type="submit">Open campaign</button>
      </form>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Status</th><th>Starts</th><th>Ends</th></tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.status}</td>
                <td>{c.starts_on}</td>
                <td>{c.ends_on ?? "—"}</td>
              </tr>
            ))}
            {campaigns.length === 0 && <tr><td colSpan={4}>No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
