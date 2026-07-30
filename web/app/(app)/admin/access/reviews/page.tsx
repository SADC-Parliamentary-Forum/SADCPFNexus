"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Campaign = {
  id: number;
  name: string;
  status: string;
  recurrence?: string;
  items?: Array<{
    id: number;
    user_id: number;
    review_type?: string;
    subject_snapshot?: { role?: string };
    status: string;
    decision?: string;
  }>;
};

export default function AccessReviewsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("Q3 privileged access review");

  const load = () =>
    api.get<{ data: Campaign[] }>("/admin/access/reviews").then((r) => setCampaigns(r.data.data ?? []));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    await api.post("/admin/access/reviews", { name, cadence: "quarterly" });
    load();
  };

  const decide = async (itemId: number, decision: "confirm" | "revoke") => {
    await api.post(`/admin/access/reviews/items/${itemId}/decide`, {
      decision,
      reason: decision === "revoke" ? "Review revoke" : "Confirmed",
    });
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Access review campaigns</h1>
      <div className="flex gap-2 items-end">
        <label className="text-sm">
          Campaign name
          <input className="block border rounded px-2 py-1 mt-1 min-w-[280px]" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="button" className="rounded bg-[var(--primary)] text-white px-3 py-2 text-sm" onClick={create}>
          Create campaign
        </button>
      </div>
      {campaigns.map((c) => (
        <div key={c.id} className="border rounded p-3 space-y-2">
          <div className="font-medium">{c.name} · {c.status} · {c.recurrence}</div>
          <ul className="text-sm space-y-1">
            {(c.items ?? []).slice(0, 20).map((i) => (
              <li key={i.id} className="flex gap-3 items-center">
                <span>
                  User {i.user_id}: {i.subject_snapshot?.role ?? i.review_type} ({i.status}
                  {i.decision ? `/${i.decision}` : ""})
                </span>
                {i.status === "pending" && (
                  <>
                    <button type="button" className="underline" onClick={() => decide(i.id, "confirm")}>Confirm</button>
                    <button type="button" className="underline" onClick={() => decide(i.id, "revoke")}>Revoke</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
