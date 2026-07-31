"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { documentServiceApi } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function DocumentRetentionPage() {
  const { success, error, info } = useToast();
  const [data, setData] = useState<any>(null);
  const [name, setName] = useState("");

  const load = () => {
    documentServiceApi
      .retentionDashboard()
      .then((r: any) => setData(r.data?.data ?? r.data))
      .catch(() => error("Could not load retention dashboard"));
  };

  useEffect(() => {
    load();
  }, []);

  const createCampaign = async () => {
    if (!name.trim()) return;
    try {
      await documentServiceApi.createRetentionCampaign({ name });
      setName("");
      success("Campaign created");
      load();
    } catch {
      error("Failed to create campaign");
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex justify-between gap-3 flex-wrap">
        <ModulePageHeader
        title="Retention campaigns"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Retention campaigns" }]} />}
      />
        <Link href="/admin/documents" className="text-sm text-primary underline">
          Document register
        </Link>
      </div>

      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div className="border rounded p-3">Total: {data.total}</div>
          <div className="border rounded p-3">On hold: {data.on_legal_hold}</div>
          <div className="border rounded p-3">Past retain-until: {data.past_retain_until}</div>
          <div className="border rounded p-3">Archived: {data.archived}</div>
          <div className="border rounded p-3">Pending disposal: {data.pending_disposal}</div>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs mb-1">New campaign name</label>
          <input className="form-input text-sm w-full" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button type="button" className="btn-primary text-sm" onClick={createCampaign}>
          Create
        </button>
      </div>

      <ul className="space-y-2 text-sm">
        {(data?.campaigns ?? []).map((c: any) => (
          <li key={c.id} className="border rounded px-3 py-2">
            <strong>{c.name}</strong> — {c.status} · candidates {c.candidate_count} · held {c.held_count}
          </li>
        ))}
      </ul>
    </div>
  );
}
