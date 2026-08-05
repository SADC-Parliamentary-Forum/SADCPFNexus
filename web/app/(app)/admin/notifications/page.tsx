"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { notificationAdminApi, notificationTemplatesApi, type NotifTemplate } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ObjectSummary } from "@/components/ui/ObjectSummary";

type Tab = "templates" | "deliveries" | "failures" | "analytics";

export default function AdminNotificationsPage() {
  const { success, error } = useToast();
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [failures, setFailures] = useState<{ failed_deliveries: any[]; dead_letters: any[] } | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [guards, setGuards] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === "templates") {
      notificationTemplatesApi.list()
        .then((r) => setTemplates(r.data))
        .catch(() => error("Could not load templates"))
        .finally(() => setLoading(false));
    } else if (tab === "deliveries") {
      notificationAdminApi.deliveries({ per_page: 50 })
        .then((r: any) => setDeliveries(r.data?.data ?? r.data ?? []))
        .catch(() => error("Could not load deliveries"))
        .finally(() => setLoading(false));
    } else if (tab === "analytics") {
      Promise.all([
        notificationAdminApi.analytics(),
        notificationAdminApi.aiGuards(),
      ])
        .then(([a, g]: any[]) => {
          setAnalytics(a.data?.data ?? a.data ?? null);
          setGuards(g.data?.data ?? g.data ?? null);
        })
        .catch(() => error("Could not load analytics"))
        .finally(() => setLoading(false));
    } else {
      notificationAdminApi.failures()
        .then((r: any) => setFailures(r.data?.data ?? r.data ?? null))
        .catch(() => error("Could not load failures"))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const retry = async (id: number) => {
    try {
      await notificationAdminApi.retry(id);
      success("Retry queued");
      setTab("failures");
    } catch {
      error("Retry failed");
    }
  };

  const suppress = async (id: number) => {
    try {
      await notificationAdminApi.suppress(id, "admin_suppressed");
      success("Delivery suppressed");
    } catch {
      error("Suppress failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title="Notifications admin"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Notifications admin" }]} />}
      />
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/notifications" className="text-sm text-primary underline">
            Open user inbox
          </Link>
          <Link href="/admin/notifications/governance" className="text-sm text-primary underline">
            Governance checklist (§124)
          </Link>
        </div>
      </div>
<div className="flex gap-2 border-b border-[var(--border)] pb-2 flex-wrap">
        {([
          ["templates", "Templates"],
          ["deliveries", "Deliveries"],
          ["failures", "Failures / DLQ"],
          ["analytics", "Analytics"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-sm rounded-md ${tab === key ? "bg-primary text-white" : "bg-[var(--muted)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>}

      {!loading && tab === "templates" && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted-foreground)]">
            {templates.length} template(s), identified by trigger key. This is a read-only list — publish versioned EN/FR/PT templates via the API.
          </p>
          <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
            {templates.slice(0, 40).map((t) => (
              <li key={t.trigger_key} className="px-3 py-2 text-sm">
                <div className="font-medium">{t.trigger_key}</div>
                <div className="text-[var(--muted-foreground)] truncate">{t.subject}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && tab === "deliveries" && (
        <div className="overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--muted)] text-left">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">{d.id}</td>
                  <td className="px-3 py-2">{d.channel}</td>
                  <td className="px-3 py-2">{d.status}</td>
                  <td className="px-3 py-2">{d.queue_priority}</td>
                  <td className="px-3 py-2 max-w-xs truncate">{d.rendered_subject}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button type="button" className="text-primary underline" onClick={() => retry(d.id)}>Retry</button>
                    <button type="button" className="text-red-600 underline" onClick={() => suppress(d.id)}>Suppress</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === "failures" && failures && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-[var(--border)] p-3">
            <h2 className="font-medium mb-2">Failed / retrying</h2>
            <ul className="space-y-2 text-sm">
              {(failures.failed_deliveries ?? []).map((d) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <span>#{d.id} {d.channel} — {d.failure_code || d.status}</span>
                  <button type="button" className="text-primary underline" onClick={() => retry(d.id)}>Retry</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-[var(--border)] p-3">
            <h2 className="font-medium mb-2">Dead letters</h2>
            <ul className="space-y-2 text-sm">
              {(failures.dead_letters ?? []).map((d) => (
                <li key={d.id}>
                  #{d.id} {d.failure_code}: {d.failure_summary}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!loading && tab === "analytics" && (
        <div className="space-y-4">
          {guards && (
            <div className="rounded-md border border-[var(--border)] p-3 text-sm">
              <div className="font-medium mb-1">Channel governance</div>
              <div>SMS: {guards.sms_status} ({guards.sms_provider})</div>
              <div>WhatsApp: {guards.whatsapp_status} ({guards.whatsapp_provider})</div>
              <div className="flex items-center gap-2">
                AI provider: {guards.provider} ·
                <span className={`badge ${guards.ai_enabled ? "badge-success" : "badge-muted"}`}>
                  {guards.ai_enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          )}
          {analytics && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="font-medium mb-2">Totals</div>
                <ObjectSummary value={analytics.totals} />
              </div>
              <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="font-medium mb-2">By channel</div>
                <ObjectSummary value={analytics.by_channel} />
              </div>
              <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="font-medium mb-2">Dead letters</div>
                <ObjectSummary value={analytics.dead_letters} />
              </div>
              <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="font-medium mb-2">By module</div>
                <ObjectSummary value={analytics.by_module} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
