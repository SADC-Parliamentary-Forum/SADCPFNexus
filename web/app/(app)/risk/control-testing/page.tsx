"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { riskApi, type RiskControlTestingCampaign, type RiskControlTestingItem } from "@/lib/api";

export default function RiskControlTestingPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [controlIds, setControlIds] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const campaignsQuery = useQuery({
    queryKey: ["risk", "control-testing"],
    queryFn: () => riskApi.listControlTestingCampaigns().then((r) => r.data.data ?? []),
  });

  const detailQuery = useQuery({
    queryKey: ["risk", "control-testing", selectedId],
    queryFn: () => riskApi.getControlTestingCampaign(selectedId!).then((r) => r.data.data),
    enabled: !!selectedId,
  });

  const create = useMutation({
    mutationFn: () =>
      riskApi.createControlTestingCampaign({
        title,
        scheduled_end: scheduledEnd || null,
        control_ids: controlIds
          .split(",")
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n) && n > 0),
      }),
    onSuccess: () => {
      setError(null);
      setTitle("");
      setControlIds("");
      qc.invalidateQueries({ queryKey: ["risk", "control-testing"] });
    },
    onError: () => setError("Could not create campaign."),
  });

  const complete = useMutation({
    mutationFn: ({ id, result }: { id: number; result: "pass" | "fail" | "waive" }) =>
      riskApi.completeControlTestItem(id, { result, checklist_notes: "Completed via UI" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["risk", "control-testing"] });
    },
    onError: () => setError("Could not complete control test."),
  });

  const markOverdue = useMutation({
    mutationFn: () => riskApi.markControlTestsOverdue(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["risk", "control-testing"] }),
  });

  const campaigns = (campaignsQuery.data ?? []) as RiskControlTestingCampaign[];
  const detail = detailQuery.data as (RiskControlTestingCampaign & { items?: RiskControlTestingItem[] }) | undefined;

  function onCreate(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title="Control Testing Campaigns"
        subtitle="Schedule control tests against Risk Register controls, record pass/fail with checklist evidence, and surface overdue items."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Control Testing Campaigns" }]} />}
      />
        <div className="flex gap-2">
          <Link href="/risk/kri" className="btn-secondary">
            KRI alerts
          </Link>
          <button type="button" className="btn-secondary" onClick={() => markOverdue.mutate()} disabled={markOverdue.isPending}>
            Refresh overdue
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <form onSubmit={onCreate} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-4">
        <label className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium">Campaign title</span>
          <input className="input w-full" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Due / end date</span>
          <input type="date" className="input w-full" value={scheduledEnd} onChange={(e) => setScheduledEnd(e.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Control IDs (comma)</span>
          <input className="input w-full" placeholder="12,15" value={controlIds} onChange={(e) => setControlIds(e.target.value)} />
        </label>
        <div className="md:col-span-4">
          <button type="submit" className="btn-primary" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create campaign"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">Campaign</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Items</th>
              <th className="px-3 py-2 font-medium">Overdue</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-t border-neutral-100">
                <td className="px-3 py-3">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-neutral-500">{c.campaign_code}</div>
                </td>
                <td className="px-3 py-3">{c.status}</td>
                <td className="px-3 py-3">{c.items_count ?? c.items?.length ?? "—"}</td>
                <td className="px-3 py-3">{c.overdue_items_count ?? 0}</td>
                <td className="px-3 py-3 text-right">
                  <button type="button" className="btn-secondary" onClick={() => setSelectedId(c.id)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                  No campaigns yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-lg font-semibold">{detail.title}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Control</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(detail.items ?? []).map((item) => (
                  <tr key={item.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">
                      {item.control?.control_code ?? item.control_id} — {item.control?.title}
                    </td>
                    <td className="px-3 py-2">{item.due_at ?? "—"}</td>
                    <td className="px-3 py-2">{item.status}</td>
                    <td className="px-3 py-2">
                      {["pending", "in_progress", "overdue"].includes(item.status) && (
                        <div className="flex gap-1">
                          <button type="button" className="btn-primary" onClick={() => complete.mutate({ id: item.id, result: "pass" })}>
                            Pass
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => complete.mutate({ id: item.id, result: "fail" })}>
                            Fail
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
