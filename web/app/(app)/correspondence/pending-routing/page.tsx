"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { correspondenceApi, adminApi, type CorrespondenceLetter } from "@/lib/api";

export default function PendingSgRoutingPage() {
  const [items, setItems] = useState<CorrespondenceLetter[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [routingId, setRoutingId] = useState<number | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    correspondenceApi
      .list({ direction: "incoming", status: "pending_sg_routing", per_page: 50 })
      .then((res) => setItems(res.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    adminApi.listUsers({ per_page: 100 }).then((res) => {
      const rows = (res.data.data ?? res.data) as Array<{ id: number; name: string }>;
      setUsers(Array.isArray(rows) ? rows : []);
    }).catch(() => {});
  }, []);

  async function route(id: number) {
    if (!ownerId) {
      setError("Select a Primary Action Owner.");
      return;
    }
    setError(null);
    try {
      await correspondenceApi.sgRoute(id, {
        action: "route_for_action",
        primary_owner_id: Number(ownerId),
        instruction,
      });
      setMsg("Routed with primary owner.");
      setRoutingId(null);
      setOwnerId("");
      setInstruction("");
      load();
    } catch {
      setError("Routing failed — ensure you have correspondence.route permission.");
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Pending SG Routing</h1>
        <p className="page-subtitle">Registered incoming items awaiting Secretary General routing and primary ownership.</p>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
      {msg && <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">{msg}</div>}

      <div className="card divide-y divide-neutral-100">
        {loading && <div className="p-8 text-center text-neutral-400">Loading…</div>}
        {!loading && items.length === 0 && <div className="p-8 text-center text-neutral-400">Queue clear.</div>}
        {items.map((item) => (
          <div key={item.id} className="p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/correspondence/${item.id}`} className="font-medium text-neutral-900 hover:text-primary">
                  {item.subject}
                </Link>
                <p className="text-xs text-neutral-500 mt-1 font-mono">
                  {item.registry_reference || `#${item.id}`} · {item.sender_name || item.sender_organisation || "Unknown sender"}
                </p>
              </div>
              <button type="button" className="btn-secondary text-xs" onClick={() => setRoutingId(item.id)}>
                Route
              </button>
            </div>
            {routingId === item.id && (
              <div className="grid gap-3 sm:grid-cols-2 rounded-xl bg-neutral-50 p-3">
                <div>
                  <label className="text-xs text-neutral-600">Primary Action Owner *</label>
                  <select className="form-input w-full mt-1" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                    <option value="">Select officer…</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-neutral-600">Instruction</label>
                  <textarea className="form-input w-full mt-1" rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button type="button" className="btn-primary text-xs" onClick={() => route(item.id)}>Confirm route</button>
                  <button type="button" className="btn-secondary text-xs" onClick={() => setRoutingId(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
