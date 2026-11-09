"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  notificationAdminApi,
  notificationTemplatesApi,
  notificationsPhase23Api,
  type NotifTemplate,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ObjectSummary } from "@/components/ui/ObjectSummary";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Tab = "templates" | "deliveries" | "failures" | "analytics" | "broadcasts" | "maintenance" | "acks";

function unwrapData<T>(payload: unknown): T | null {
  if (!payload || typeof payload !== "object") return null;
  const rec = payload as Record<string, unknown>;
  if ("data" in rec) return (rec.data as T) ?? null;
  return payload as T;
}

export default function AdminNotificationsPage() {
  const { success, error } = useToast();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [failures, setFailures] = useState<{ failed_deliveries: any[]; dead_letters: any[] } | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [guards, setGuards] = useState<any>(null);
  const [fatigue, setFatigue] = useState<unknown>(null);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [broadcastForm, setBroadcastForm] = useState({
    title: "",
    body: "",
    impact: "normal",
    broadcast_type: "general",
    scheduled_at: "",
  });
  const [draftBroadcast, setDraftBroadcast] = useState<{ id?: number; status?: string; title?: string } | null>(null);
  const [broadcastId, setBroadcastId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: "",
    body: "",
    starts_at: "",
    ends_at: "",
  });
  const [ackForm, setAckForm] = useState({ title: "", body: "", deadline_at: "", user_ids: "" });
  const [ackId, setAckId] = useState("");
  const [ackReport, setAckReport] = useState<unknown>(null);
  const [draftAck, setDraftAck] = useState<{ id?: number; status?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    if (tab === "templates") {
      notificationTemplatesApi.list()
        .then((r) => setTemplates(r.data))
        .catch(() => error(t("admin.notifications.err.templates")))
        .finally(() => setLoading(false));
    } else if (tab === "deliveries") {
      notificationAdminApi.deliveries({ per_page: 50 })
        .then((r: any) => setDeliveries(r.data?.data ?? r.data ?? []))
        .catch(() => error(t("admin.notifications.err.deliveries")))
        .finally(() => setLoading(false));
    } else if (tab === "analytics") {
      Promise.all([
        notificationAdminApi.analytics(),
        notificationAdminApi.aiGuards(),
        notificationAdminApi.fatigue(),
      ])
        .then(([a, g, f]: any[]) => {
          setAnalytics(a.data?.data ?? a.data ?? null);
          setGuards(g.data?.data ?? g.data ?? null);
          setFatigue(f.data?.data ?? f.data ?? null);
        })
        .catch(() => error(t("admin.notifications.err.analytics")))
        .finally(() => setLoading(false));
    } else if (tab === "broadcasts" || tab === "acks") {
      setLoading(false);
    } else if (tab === "maintenance") {
      notificationAdminApi.listMaintenance()
        .then((r: any) => setMaintenance(r.data?.data ?? r.data ?? []))
        .catch(() => error(t("admin.notifications.err.maintenance")))
        .finally(() => setLoading(false));
    } else {
      notificationAdminApi.failures()
        .then((r: any) => setFailures(r.data?.data ?? r.data ?? null))
        .catch(() => error(t("admin.notifications.err.failures")))
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const retry = async (id: number) => {
    try {
      await notificationAdminApi.retry(id);
      success(t("admin.notifications.retryQueued"));
      setTab("failures");
    } catch {
      error(t("admin.notifications.retryFailed"));
    }
  };

  const suppress = async (id: number) => {
    try {
      await notificationAdminApi.suppress(id, "admin_suppressed");
      success(t("admin.notifications.suppressed"));
    } catch {
      error(t("admin.notifications.suppressFailed"));
    }
  };

  const createDraftBroadcast = async () => {
    if (!broadcastForm.title.trim() || !broadcastForm.body.trim()) return;
    setBusy("create");
    try {
      const res = await notificationsPhase23Api.createBroadcast({
        title: broadcastForm.title.trim(),
        body: broadcastForm.body.trim(),
        impact: broadcastForm.impact,
        broadcast_type: broadcastForm.broadcast_type,
        scheduled_at: broadcastForm.scheduled_at || undefined,
      });
      const created = unwrapData<{ id?: number; status?: string; title?: string }>(res.data);
      setDraftBroadcast(created);
      if (created?.id) setBroadcastId(String(created.id));
      setBroadcastForm({ title: "", body: "", impact: "normal", broadcast_type: "general", scheduled_at: "" });
      success(t("admin.notifications.broadcast.draftSaved"));
    } catch {
      error(t("admin.notifications.broadcast.createFailed"));
    } finally {
      setBusy(null);
    }
  };

  const actOnBroadcast = async (action: "submit" | "approve" | "cancel") => {
    const id = broadcastId.trim();
    if (!id) return;
    setBusy(action);
    try {
      if (action === "submit") await notificationsPhase23Api.submitBroadcast(id);
      if (action === "approve") await notificationsPhase23Api.approveBroadcast(id);
      if (action === "cancel") await notificationsPhase23Api.cancelBroadcast(id, cancelReason || undefined);
      success(
        action === "submit"
          ? t("admin.notifications.broadcast.submitted")
          : action === "approve"
            ? t("admin.notifications.broadcast.approved")
            : t("admin.notifications.broadcast.cancelled"),
      );
      if (action === "cancel") setCancelReason("");
    } catch {
      error(
        action === "approve"
          ? t("admin.notifications.broadcast.approveFailed")
          : action === "submit"
            ? t("admin.notifications.broadcast.submitFailed")
            : t("admin.notifications.broadcast.cancelFailed"),
      );
    } finally {
      setBusy(null);
    }
  };

  const scheduleWindow = async () => {
    if (!maintenanceForm.title.trim() || !maintenanceForm.body.trim() || !maintenanceForm.starts_at) return;
    setBusy("maintenance");
    try {
      await notificationAdminApi.scheduleMaintenance({
        title: maintenanceForm.title.trim(),
        body: maintenanceForm.body.trim(),
        starts_at: maintenanceForm.starts_at,
        ends_at: maintenanceForm.ends_at || undefined,
      });
      success(t("admin.notifications.maint.scheduled"));
      setMaintenanceForm({ title: "", body: "", starts_at: "", ends_at: "" });
      const r: any = await notificationAdminApi.listMaintenance();
      setMaintenance(r.data?.data ?? r.data ?? []);
    } catch {
      error(t("admin.notifications.maint.scheduleFailed"));
    } finally {
      setBusy(null);
    }
  };

  const createDraftAck = async () => {
    if (!ackForm.title.trim() || !ackForm.body.trim()) return;
    setBusy("ack-create");
    try {
      const userIds = ackForm.user_ids
        .split(/[,\s]+/)
        .map((part) => Number(part))
        .filter((n) => Number.isFinite(n) && n > 0);
      const res = await notificationsPhase23Api.createAckCampaign({
        title: ackForm.title.trim(),
        body: ackForm.body.trim(),
        deadline_at: ackForm.deadline_at || undefined,
        audience: { user_ids: userIds },
      });
      const created = unwrapData<{ id?: number; status?: string }>(res.data);
      setDraftAck(created);
      if (created?.id) setAckId(String(created.id));
      setAckForm({ title: "", body: "", deadline_at: "", user_ids: "" });
      success(t("admin.notifications.ack.draftSaved"));
    } catch {
      error(t("admin.notifications.ack.createFailed"));
    } finally {
      setBusy(null);
    }
  };

  const activateAck = async () => {
    const id = ackId.trim();
    if (!id) return;
    setBusy("ack-activate");
    try {
      await notificationsPhase23Api.activateAckCampaign(id);
      success(t("admin.notifications.ack.activated"));
    } catch {
      error(t("admin.notifications.ack.activateFailed"));
    } finally {
      setBusy(null);
    }
  };

  const loadAckReport = async () => {
    const id = ackId.trim();
    if (!id) return;
    setBusy("ack-report");
    try {
      const res = await notificationsPhase23Api.ackReport(id);
      setAckReport(unwrapData(res.data) ?? res.data);
    } catch {
      error(t("admin.notifications.ack.reportFailed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title={t("admin.notifications.title")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.notifications.title") }]} />}
      />
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/notifications" className="btn-secondary text-sm">
            {t("admin.notifications.openInbox")}
          </Link>
          <Link href="/admin/notifications/governance" className="btn-secondary text-sm">
            {t("admin.notifications.governanceLink")}
          </Link>
        </div>
      </div>
<div className="flex gap-2 border-b border-[var(--border)] pb-2 flex-wrap">
        {([
          ["templates", "admin.notifications.tab.templates"],
          ["deliveries", "admin.notifications.tab.deliveries"],
          ["failures", "admin.notifications.tab.failures"],
          ["analytics", "admin.notifications.tab.analytics"],
          ["broadcasts", "admin.notifications.tab.broadcasts"],
          ["acks", "admin.notifications.tab.acks"],
          ["maintenance", "admin.notifications.tab.maintenance"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-sm rounded-md ${tab === key ? "bg-primary text-white" : "bg-[var(--muted)]"}`}
          >
            {t(label)}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-[var(--muted-foreground)]">{t("common.loading")}</p>}

      {!loading && tab === "templates" && (
        <div className="space-y-2">
          <p className="text-sm text-[var(--muted-foreground)]">
            {t("admin.notifications.templatesIntro", { count: templates.length })}
          </p>
          <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
            {templates.slice(0, 40).map((tpl) => (
              <li key={tpl.trigger_key} className="px-3 py-2 text-sm">
                <div className="font-medium">{tpl.trigger_key}</div>
                <div className="text-[var(--muted-foreground)] truncate">{tpl.subject}</div>
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
                <th className="px-3 py-2">{t("admin.notifications.col.id")}</th>
                <th className="px-3 py-2">{t("admin.notifications.col.channel")}</th>
                <th className="px-3 py-2">{t("admin.notifications.col.status")}</th>
                <th className="px-3 py-2">{t("admin.notifications.col.priority")}</th>
                <th className="px-3 py-2">{t("admin.notifications.col.subject")}</th>
                <th className="px-3 py-2">{t("admin.notifications.col.actions")}</th>
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
                    <button type="button" className="btn-secondary text-xs" onClick={() => retry(d.id)}>{t("common.retry")}</button>
                    <button type="button" className="btn-secondary text-xs text-red-600" onClick={() => suppress(d.id)}>{t("admin.notifications.suppress")}</button>
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
            <h2 className="font-medium mb-2">{t("admin.notifications.failedRetrying")}</h2>
            <ul className="space-y-2 text-sm">
              {(failures.failed_deliveries ?? []).map((d) => (
                <li key={d.id} className="flex justify-between gap-2">
                  <span>#{d.id} {d.channel} — {d.failure_code || d.status}</span>
                  <button type="button" className="btn-secondary text-xs" onClick={() => retry(d.id)}>{t("common.retry")}</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-[var(--border)] p-3">
            <h2 className="font-medium mb-2">{t("admin.notifications.deadLetters")}</h2>
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
              <div className="font-medium mb-1">{t("admin.notifications.channelGovernance")}</div>
              <div>{t("admin.notifications.smsLine", { status: guards.sms_status, provider: guards.sms_provider })}</div>
              <div>{t("admin.notifications.whatsappLine", { status: guards.whatsapp_status, provider: guards.whatsapp_provider })}</div>
              <div className="flex items-center gap-2">
                {t("admin.notifications.aiProvider", { provider: guards.provider })}
                <span className={`badge ${guards.ai_enabled ? "badge-success" : "badge-muted"}`}>
                  {guards.ai_enabled ? t("admin.notifications.enabled") : t("admin.notifications.disabled")}
                </span>
              </div>
            </div>
          )}
          {analytics && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="font-medium mb-2">{t("admin.notifications.totals")}</div>
                <ObjectSummary value={analytics.totals} />
              </div>
              <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="font-medium mb-2">{t("admin.notifications.byChannel")}</div>
                <ObjectSummary value={analytics.by_channel} />
              </div>
              <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="font-medium mb-2">{t("admin.notifications.deadLetters")}</div>
                <ObjectSummary value={analytics.dead_letters} />
              </div>
              <div className="rounded-md border border-[var(--border)] p-3 text-sm">
                <div className="font-medium mb-2">{t("admin.notifications.byModule")}</div>
                <ObjectSummary value={analytics.by_module} />
              </div>
            </div>
          )}
          {fatigue != null && (
            <div className="rounded-md border border-[var(--border)] p-3 text-sm">
              <div className="font-medium mb-2">{t("admin.notifications.fatigue")}</div>
              <LabelledRecord value={fatigue} />
            </div>
          )}
        </div>
      )}

      {!loading && tab === "broadcasts" && (
        <div className="space-y-4">
          <FormSection
            title={t("admin.notifications.broadcast.createTitle")}
            description={t("admin.notifications.broadcast.createDesc")}
            icon="campaign"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("admin.notifications.field.title")} htmlFor="broadcast-title" required>
                <input
                  id="broadcast-title"
                  className="form-input"
                  value={broadcastForm.title}
                  onChange={(e) => setBroadcastForm((f) => ({ ...f, title: e.target.value }))}
                />
              </FormField>
              <FormField label={t("admin.notifications.field.impact")} htmlFor="broadcast-impact">
                <select
                  id="broadcast-impact"
                  className="form-input"
                  value={broadcastForm.impact}
                  onChange={(e) => setBroadcastForm((f) => ({ ...f, impact: e.target.value }))}
                >
                  <option value="normal">{t("admin.notifications.impact.normal")}</option>
                  <option value="high">{t("admin.notifications.impact.high")}</option>
                  <option value="critical">{t("admin.notifications.impact.critical")}</option>
                </select>
              </FormField>
              <FormField label={t("admin.notifications.field.type")} htmlFor="broadcast-type">
                <input
                  id="broadcast-type"
                  className="form-input"
                  value={broadcastForm.broadcast_type}
                  onChange={(e) => setBroadcastForm((f) => ({ ...f, broadcast_type: e.target.value }))}
                />
              </FormField>
              <FormField label={t("admin.notifications.field.schedule")} htmlFor="broadcast-schedule" hint={t("admin.notifications.field.scheduleHint")}>
                <input
                  id="broadcast-schedule"
                  type="datetime-local"
                  className="form-input"
                  value={broadcastForm.scheduled_at}
                  onChange={(e) => setBroadcastForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                />
              </FormField>
              <FormField label={t("admin.notifications.field.body")} htmlFor="broadcast-body" required className="sm:col-span-2">
                <textarea
                  id="broadcast-body"
                  className="form-input"
                  rows={4}
                  value={broadcastForm.body}
                  onChange={(e) => setBroadcastForm((f) => ({ ...f, body: e.target.value }))}
                />
              </FormField>
            </div>
            <button
              type="button"
              className="btn-primary mt-3 disabled:opacity-60"
              disabled={busy !== null || !broadcastForm.title.trim() || !broadcastForm.body.trim()}
              onClick={() => void createDraftBroadcast()}
            >
              {busy === "create" ? t("admin.notifications.saving") : t("admin.notifications.saveDraft")}
            </button>
            {draftBroadcast?.id ? (
              <p className="mt-2 text-sm text-neutral-600">
                {t("admin.notifications.broadcast.draftNote", { id: draftBroadcast.id, status: draftBroadcast.status ?? "draft" })}
              </p>
            ) : null}
          </FormSection>

          <FormSection
            title={t("admin.notifications.broadcast.actTitle")}
            description={t("admin.notifications.broadcast.actDesc")}
            icon="verified"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("admin.notifications.field.broadcastId")} htmlFor="broadcast-id" required>
                <input
                  id="broadcast-id"
                  className="form-input"
                  value={broadcastId}
                  onChange={(e) => setBroadcastId(e.target.value)}
                />
              </FormField>
              <FormField label={t("admin.notifications.field.cancelReason")} htmlFor="broadcast-cancel-reason">
                <input
                  id="broadcast-cancel-reason"
                  className="form-input"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </FormField>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary text-sm disabled:opacity-60" disabled={busy !== null || !broadcastId.trim()} onClick={() => void actOnBroadcast("submit")}>
                {busy === "submit" ? t("admin.notifications.submitting") : t("admin.notifications.submitForApproval")}
              </button>
              <button type="button" className="btn-secondary text-sm disabled:opacity-60" disabled={busy !== null || !broadcastId.trim()} onClick={() => void actOnBroadcast("approve")}>
                {busy === "approve" ? t("admin.notifications.approving") : t("common.approve")}
              </button>
              <button type="button" className="btn-secondary text-sm text-red-600 disabled:opacity-60" disabled={busy !== null || !broadcastId.trim()} onClick={() => void actOnBroadcast("cancel")}>
                {busy === "cancel" ? t("admin.notifications.cancelling") : t("common.cancel")}
              </button>
            </div>
          </FormSection>
        </div>
      )}

      {!loading && tab === "maintenance" && (
        <div className="space-y-4">
          <FormSection
            title={t("admin.notifications.maint.title")}
            description={t("admin.notifications.maint.desc")}
            icon="construction"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("admin.notifications.field.title")} htmlFor="maint-title" required>
                <input
                  id="maint-title"
                  className="form-input"
                  value={maintenanceForm.title}
                  onChange={(e) => setMaintenanceForm((f) => ({ ...f, title: e.target.value }))}
                />
              </FormField>
              <FormField label={t("admin.notifications.field.startsAt")} htmlFor="maint-start" required>
                <input
                  id="maint-start"
                  type="datetime-local"
                  className="form-input"
                  value={maintenanceForm.starts_at}
                  onChange={(e) => setMaintenanceForm((f) => ({ ...f, starts_at: e.target.value }))}
                />
              </FormField>
              <FormField label={t("admin.notifications.field.endsAt")} htmlFor="maint-end">
                <input
                  id="maint-end"
                  type="datetime-local"
                  className="form-input"
                  value={maintenanceForm.ends_at}
                  onChange={(e) => setMaintenanceForm((f) => ({ ...f, ends_at: e.target.value }))}
                />
              </FormField>
              <FormField label={t("admin.notifications.field.body")} htmlFor="maint-body" required className="sm:col-span-2">
                <textarea
                  id="maint-body"
                  className="form-input"
                  rows={3}
                  value={maintenanceForm.body}
                  onChange={(e) => setMaintenanceForm((f) => ({ ...f, body: e.target.value }))}
                />
              </FormField>
            </div>
            <button
              type="button"
              className="btn-primary mt-3 disabled:opacity-60"
              disabled={busy !== null || !maintenanceForm.title.trim() || !maintenanceForm.body.trim() || !maintenanceForm.starts_at}
              onClick={() => void scheduleWindow()}
            >
              {busy === "maintenance" ? t("admin.notifications.saving") : t("admin.notifications.maint.schedule")}
            </button>
          </FormSection>
          <div className="rounded-md border border-[var(--border)] p-3 text-sm">
            <h2 className="font-medium mb-2">{t("admin.notifications.maint.listTitle")}</h2>
            {maintenance.length === 0 ? (
              <p className="text-[var(--muted-foreground)]">{t("admin.notifications.maint.empty")}</p>
            ) : (
              <ul className="space-y-3">
                {maintenance.map((row, idx) => (
                  <li key={String(row.id ?? idx)}>
                    <LabelledRecord value={row} nested />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!loading && tab === "acks" && (
        <div className="space-y-4">
          <FormSection
            title={t("admin.notifications.ack.createTitle")}
            description={t("admin.notifications.ack.createDesc")}
            icon="fact_check"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("admin.notifications.field.title")} htmlFor="ack-title" required>
                <input
                  id="ack-title"
                  className="form-input"
                  value={ackForm.title}
                  onChange={(e) => setAckForm((f) => ({ ...f, title: e.target.value }))}
                />
              </FormField>
              <FormField label={t("admin.notifications.field.deadline")} htmlFor="ack-deadline">
                <input
                  id="ack-deadline"
                  type="datetime-local"
                  className="form-input"
                  value={ackForm.deadline_at}
                  onChange={(e) => setAckForm((f) => ({ ...f, deadline_at: e.target.value }))}
                />
              </FormField>
              <FormField
                label={t("admin.notifications.field.audience")}
                htmlFor="ack-users"
                hint={t("admin.notifications.field.audienceHint")}
                className="sm:col-span-2"
              >
                <input
                  id="ack-users"
                  className="form-input"
                  value={ackForm.user_ids}
                  onChange={(e) => setAckForm((f) => ({ ...f, user_ids: e.target.value }))}
                />
              </FormField>
              <FormField label={t("admin.notifications.field.body")} htmlFor="ack-body" required className="sm:col-span-2">
                <textarea
                  id="ack-body"
                  className="form-input"
                  rows={4}
                  value={ackForm.body}
                  onChange={(e) => setAckForm((f) => ({ ...f, body: e.target.value }))}
                />
              </FormField>
            </div>
            <button
              type="button"
              className="btn-primary mt-3 disabled:opacity-60"
              disabled={busy !== null || !ackForm.title.trim() || !ackForm.body.trim()}
              onClick={() => void createDraftAck()}
            >
              {busy === "ack-create" ? t("admin.notifications.saving") : t("admin.notifications.saveDraft")}
            </button>
            {draftAck?.id ? (
              <p className="mt-2 text-sm text-neutral-600">
                {t("admin.notifications.ack.draftNote", { id: draftAck.id, status: draftAck.status ?? "draft" })}
              </p>
            ) : null}
          </FormSection>

          <FormSection
            title={t("admin.notifications.ack.actTitle")}
            description={t("admin.notifications.ack.actDesc")}
            icon="campaign"
          >
            <FormField label={t("admin.notifications.field.campaignId")} htmlFor="ack-id" required>
              <input
                id="ack-id"
                className="form-input"
                value={ackId}
                onChange={(e) => setAckId(e.target.value)}
              />
            </FormField>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary text-sm disabled:opacity-60" disabled={busy !== null || !ackId.trim()} onClick={() => void activateAck()}>
                {busy === "ack-activate" ? t("admin.notifications.activating") : t("admin.notifications.activate")}
              </button>
              <button type="button" className="btn-secondary text-sm disabled:opacity-60" disabled={busy !== null || !ackId.trim()} onClick={() => void loadAckReport()}>
                {busy === "ack-report" ? t("common.loading") : t("admin.notifications.loadReport")}
              </button>
            </div>
            {ackReport != null ? (
              <div className="mt-3">
                <LabelledRecord value={ackReport} />
              </div>
            ) : null}
          </FormSection>
        </div>
      )}
    </div>
  );
}
