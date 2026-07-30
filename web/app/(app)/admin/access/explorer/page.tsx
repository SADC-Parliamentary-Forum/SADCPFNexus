"use client";

import { useState } from "react";
import api from "@/lib/api";

export default function PermissionExplorerPage() {
  const [permission, setPermission] = useState("leave.request.authorise.assigned");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const run = async () => {
    const res = await api.get<{ data: Record<string, unknown> }>(
      `/admin/access/explore`,
      { params: { permission } }
    );
    setResult(res.data.data);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Permission explorer</h1>
      <p className="text-sm text-[var(--muted-foreground)]">Which roles contain a permission, and who holds direct grants/denials.</p>
      <div className="flex gap-2 items-end">
        <label className="text-sm grow">
          Permission key
          <input className="block border rounded px-2 py-1 mt-1 w-full" value={permission} onChange={(e) => setPermission(e.target.value)} />
        </label>
        <button type="button" className="rounded bg-[var(--primary)] text-white px-3 py-2 text-sm" onClick={run}>
          Explore
        </button>
      </div>
      {result && (
        <pre className="text-xs overflow-auto rounded border p-3 bg-[var(--muted)]/30 max-h-[60vh]">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
