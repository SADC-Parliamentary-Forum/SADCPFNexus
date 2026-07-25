"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenderCommitteesApi } from "@/lib/api";

export default function TenderCommitteePage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["procurement", "tender-committees"],
    queryFn: () => tenderCommitteesApi.list().then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => tenderCommitteesApi.create({ name, quorum_minimum: 3 }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["procurement", "tender-committees"] });
    },
  });

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="page-title">Tender Committee</h1>
        <p className="page-subtitle">Standing or ad-hoc committees with quorum enforcement on meetings.</p>
      </div>

      <div className="card p-4 flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold mb-1">New committee</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Standing Tender Committee" />
        </div>
        <button type="button" className="btn-primary" disabled={!name || createMut.isPending} onClick={() => createMut.mutate()}>
          Create
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-neutral-400">Loading…</div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((c) => (
            <div key={String(c.id)} className="card p-4">
              <p className="text-sm font-semibold">{String(c.name)}</p>
              <p className="text-xs text-neutral-500">Quorum min: {String(c.quorum_minimum ?? 3)} · Members: {Array.isArray(c.members) ? c.members.length : 0}</p>
            </div>
          ))}
          {(data ?? []).length === 0 && <div className="card p-8 text-center text-sm text-neutral-400">No committees yet.</div>}
        </div>
      )}
    </div>
  );
}
