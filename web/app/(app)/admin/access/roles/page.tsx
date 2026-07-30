"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Role = {
  id: number;
  name: string;
  purpose?: string;
  risk_level?: string;
  status?: string;
  feature_only?: boolean;
  current_version?: { version: number; permissions: string[] } | null;
};

export default function AccessRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = () =>
    api.get<{ data: Role[] }>("/admin/access/roles").then((r) => r.data)
      .then((res) => setRoles(res.data ?? []))
      .catch((e) => setMessage(e?.message ?? "Failed to load roles"));

  useEffect(() => {
    load();
  }, []);

  const createDraft = async () => {
    setMessage(null);
    await api.post("/admin/access/roles", { name, purpose, permissions: [], changelog: "UI draft" });
    setName("");
    setPurpose("");
    setMessage("Draft role created");
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Role catalogue</h1>
        <p className="text-sm text-[var(--muted-foreground)]">Versioned role templates (draft → publish).</p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-sm">
          Name
          <input className="block border rounded px-2 py-1 mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="text-sm">
          Purpose
          <input className="block border rounded px-2 py-1 mt-1 min-w-[240px]" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </label>
        <button type="button" className="rounded bg-[var(--primary)] text-white px-3 py-2 text-sm" onClick={createDraft} disabled={!name}>
          Create draft
        </button>
      </div>
      {message && <p className="text-sm">{message}</p>}

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Name</th>
            <th>Risk</th>
            <th>Status</th>
            <th>Version</th>
            <th>Perms</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id} className="border-b border-[var(--border)]">
              <td className="py-2">
                {r.name}
                {r.feature_only ? " · feature-only" : ""}
              </td>
              <td>{r.risk_level}</td>
              <td>{r.status}</td>
              <td>{r.current_version?.version ?? "—"}</td>
              <td>{r.current_version?.permissions?.length ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
