"use client";

import { useState } from "react";
import api from "@/lib/api";

export default function AccessSimulatorPage() {
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setError(null);
    setResult(null);
    try {
      const res = await api.post<{ data: Record<string, unknown> }>(`/admin/access/users/${userId}/simulate`);
      setResult(res.data.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Access simulator</h1>
      <p className="text-sm text-[var(--muted-foreground)]">
        Preview what a user can see and do. Does not create a live impersonation session.
      </p>
      <div className="flex gap-2 items-end">
        <label className="text-sm">
          User ID
          <input className="block border rounded px-2 py-1 mt-1" value={userId} onChange={(e) => setUserId(e.target.value)} />
        </label>
        <button type="button" className="rounded bg-[var(--primary)] text-white px-3 py-2 text-sm" onClick={run} disabled={!userId}>
          Simulate
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <pre className="text-xs overflow-auto rounded border p-3 bg-[var(--muted)]/30 max-h-[60vh]">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
