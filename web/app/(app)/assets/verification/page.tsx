"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/Button";

type Campaign = { id: number; name: string; status: string; starts_on: string; ends_on?: string };

export default function AssetVerificationPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    const r = await api.get<{ data: Campaign[] }>("/assets-meta/verification-campaigns");
    setCampaigns(Array.isArray(r.data.data) ? r.data.data : []);
  }

  useEffect(() => { load().catch(() => setCampaigns([])); }, []);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;

    setCreating(true);
    setMsg(null);
    setErrorMsg(null);

    try {
      await api.post("/assets-meta/verification-campaigns", { name, starts_on: startsOn });
      setName("");
      setMsg("Campaign created.");
      await load();
    } catch (error: any) {
      setErrorMsg(error?.response?.data?.message ?? "Could not create campaign. Try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="page-header">
        <ModulePageHeader
        title="Physical Verification"
        subtitle="Campaigns for inventory checks; missing/damaged results update asset status"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Physical Verification" }]} />}
      />
      </div>
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {errorMsg && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMsg}</div>}
      <form onSubmit={createCampaign} className="card" style={{ padding: "1rem", marginBottom: "1.5rem", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input className="input" placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
        <Button type="submit" disabled={creating}>{creating ? "Opening..." : "Open campaign"}</Button>
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
