"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notificationAdminApi, notificationTemplatesApi, type NotifTemplate } from "@/lib/api";

type Tab = "templates" | "deliveries" | "failures" | "analytics";

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [failures, setFailures] = useState<{ failed_deliveries: any[]; dead_letters: any[] } | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [guards, setGuards] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    if (tab === "templates") {
      notificationTemplatesApi.list()
        .then((r) => setTemplates(r.data))
        .catch(() => setToast("Could not load templates"))
        .finally(() => setLoading(false));
    } else if (tab === "deliveries") {
      notificationAdminApi.deliveries({ per_page: 50 })
        .then((r: any) => setDeliveries(r.data?.data ?? r.data ?? []))
        .catch(() => setToast("Could not load deliveries"))
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
        .catch(() => setToast("Could not load analytics"))
        .finally(() => setLoading(false));
    } else {
      notificationAdminApi.failures()
        .then((r: any) => setFailures(r.data?.data ?? r.data ?? null))
        .catch(() => setToast("Could not load failures"))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const retry = async (id: number) => {
    try {
      await notificationAdminApi.retry(id);
      setToast("Retry queued");
      setTab("failures");
    } catch {
      setToast("Retry failed");
    }
  };

  const suppress = async (id: number) => {
    try {
      await notificationAdminApi.suppress(id, "admin_suppressed");
      setToast("Delivery suppressed");
    } catch {
      setToast("Suppress failed");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Notifications admin</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Phase 2/3 delivery health, analytics, broadcasts and ack campaigns. Provider failure never rolls back business decisions.
          </p>
        </div>
        <Link href="/notifications" className="text-sm text-primary underline">
          Open user inbox
        </Link>
      </div>

      {toast && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">{toast}</div>
      )}

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
            {templates.length} template(s). Edit via trigger key in the legacy editor below or publish versioned EN/FR/PT templates via API.
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
              <div>AI provider: {guards.provider} · enabled={String(guards.ai_enabled)}</div>
            </div>
          )}
          {analytics && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="font-medium mb-2">Totals</div>
                <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(analytics.totals, null, 2)}</pre>
              </div>
              <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="font-medium mb-2">By channel</div>
                <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(analytics.by_channel, null, 2)}</pre>
              </div>
              <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="font-medium mb-2">Dead letters</div>
                <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(analytics.dead_letters, null, 2)}</pre>
              </div>
              <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="font-medium mb-2">By module</div>
                <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(analytics.by_module, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
