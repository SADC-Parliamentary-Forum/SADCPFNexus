"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";

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
  const [nameError, setNameError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api
      .get<{ data: Campaign[] }>("/admin/access/reviews")
      .then((r) => setCampaigns(r.data.data ?? []))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) {
      setNameError("Campaign name is required.");
      return;
    }
    setNameError(null);
    await api.post("/admin/access/reviews", { name: name.trim(), cadence: "quarterly" });
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
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Access review campaigns"
        subtitle="Periodic attestation of privileged and feature-only access."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Access", href: "/admin/access" },
              { label: "Reviews" },
            ]}
          />
        }
      />

      <FormSection title="Create campaign" icon="fact_check" dense>
        <div className="flex flex-wrap items-end gap-3">
          <FormField
            label="Campaign name"
            htmlFor="campaign-name"
            required
            error={nameError ?? undefined}
            className="min-w-[280px] flex-1"
          >
            <input
              id="campaign-name"
              className="form-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
            />
          </FormField>
          <button type="button" className="btn-primary text-sm" onClick={create}>
            Create campaign
          </button>
        </div>
      </FormSection>

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card">
          <EmptyState icon="fact_check" title="No review campaigns" description="Create a campaign to start periodic access attestation." />
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <FormSection
              key={c.id}
              title={c.name}
              description={`${c.status}${c.recurrence ? ` · ${c.recurrence}` : ""}`}
              icon="fact_check"
              dense
            >
              {(c.items ?? []).length === 0 ? (
                <p className="text-xs text-neutral-500">No review items yet.</p>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {(c.items ?? []).slice(0, 20).map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="text-neutral-700">
                        User {i.user_id}: {i.subject_snapshot?.role ?? i.review_type}{" "}
                        <span className="badge badge-muted text-[10px] capitalize">
                          {i.status}
                          {i.decision ? `/${i.decision}` : ""}
                        </span>
                      </span>
                      {i.status === "pending" ? (
                        <div className="flex gap-2">
                          <button type="button" className="text-xs font-medium text-emerald-700 hover:underline" onClick={() => decide(i.id, "confirm")}>
                            Confirm
                          </button>
                          <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => decide(i.id, "revoke")}>
                            Revoke
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>
          ))}
        </div>
      )}
    </div>
  );
}
