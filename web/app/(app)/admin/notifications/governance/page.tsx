"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  notificationGovernanceApi,
  type NotificationGovernanceDecision,
} from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_LABELS: Record<string, string> = {
  pending: "admin.auditTrail.governance.statusPending",
  decided: "admin.auditTrail.governance.statusDecided",
  not_applicable: "admin.auditTrail.governance.statusNotApplicable",
};

export default function NotificationsGovernancePage() {
  const { t } = useI18n();
  const { success, error, info } = useToast();
  const [rows, setRows] = useState<NotificationGovernanceDecision[]>([]);
  const [channelStatus, setChannelStatus] = useState<{ sms?: string; whatsapp?: string }>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("pending");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    notificationGovernanceApi
      .list()
      .then((r: any) => {
        setRows(r.data?.data ?? r.data ?? []);
        setChannelStatus(r.data?.meta?.channel_status ?? r.meta?.channel_status ?? {});
      })
      .catch(() => error(t("admin.auditTrail.governance.loadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (row: NotificationGovernanceDecision) => {
    setEditing(row.id);
    setStatus(row.status);
    setNotes(row.decision_notes ?? "");
  };

  const save = async (id: number) => {
    setSaving(true);
    try {
      await notificationGovernanceApi.update(id, {
        status,
        decision_notes: notes || null,
      });
      success(t("admin.auditTrail.governance.saved"));
      setEditing(null);
      load();
    } catch {
      error(t("admin.auditTrail.governance.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title={t("admin.notifications.governance.title")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.notifications.governance.title") }]} />}
      />
        <Link href="/admin/notifications" className="btn-secondary text-sm">
          {t("admin.notifications.governance.back")}
        </Link>
      </div>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm space-y-1">
        <div>
          <span className="font-medium">{t("admin.notifications.governance.sms")}</span>{" "}
          {channelStatus.sms ?? t("admin.auditTrail.governance.configPending")}
        </div>
        <div>
          <span className="font-medium">{t("admin.notifications.governance.whatsapp")}</span>{" "}
          {channelStatus.whatsapp ?? t("admin.auditTrail.governance.configPending")}
        </div>
        <p className="text-[var(--muted-foreground)]">
          {t("admin.notifications.governance.stubNotice")}
        </p>
      </div>
{loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">{t("common.loading")}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="border border-[var(--border)] rounded-md p-4 space-y-2 bg-[var(--background)]"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    #{row.sort_order} · {row.decision_key}
                  </div>
                  <h2 className="font-medium text-[var(--foreground)]">{row.title}</h2>
                  {row.description && (
                    <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{row.description}</p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-md ${
                    row.status === "decided"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : row.status === "not_applicable"
                        ? "bg-[var(--muted)] text-[var(--muted-foreground)]"
                        : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {STATUS_LABELS[row.status] ? t(STATUS_LABELS[row.status]) : row.status}
                </span>
              </div>

              {row.decision_notes && editing !== row.id && (
                <p className="text-sm whitespace-pre-wrap">{row.decision_notes}</p>
              )}
              {(row.decided_by || row.decided_at) && editing !== row.id && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  {row.decided_by_user?.name && row.decided_at
                    ? t("admin.notifications.governance.decidedByAt", { name: row.decided_by_user.name, at: new Date(row.decided_at).toLocaleString() })
                    : row.decided_by_user?.name
                      ? t("admin.notifications.governance.decidedBy", { name: row.decided_by_user.name })
                      : row.decided_at
                        ? t("admin.notifications.governance.decidedAt", { at: new Date(row.decided_at).toLocaleString() })
                        : t("admin.auditTrail.governance.statusDecided")}
                </p>
              )}

              {editing === row.id ? (
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <label htmlFor={`admin-notifications-governance-status-${row.id}`} className="block text-sm">
                    {t("admin.common.status")}
                    <select id={`admin-notifications-governance-status-${row.id}`}
                      className="mt-1 w-full border border-[var(--border)] rounded-md px-2 py-1.5 bg-[var(--background)]"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="pending">{t("admin.auditTrail.governance.statusPending")}</option>
                      <option value="decided">{t("admin.auditTrail.governance.statusDecided")}</option>
                      <option value="not_applicable">{t("admin.auditTrail.governance.statusNotApplicable")}</option>
                    </select>
                  </label>
                  <label htmlFor={`admin-notifications-governance-decision-notes-${row.id}`} className="block text-sm">
                    {t("admin.access.governance.decisionNotes")}
                    <textarea id={`admin-notifications-governance-decision-notes-${row.id}`}
                      className="mt-1 w-full border border-[var(--border)] rounded-md px-2 py-1.5 bg-[var(--background)] min-h-[80px]"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t("admin.notifications.governance.notesPlaceholder")}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => save(row.id)}
                      className="px-3 py-1.5 text-sm rounded-md bg-primary text-white disabled:opacity-50"
                    >
                      {saving ? t("admin.common.saving") : t("common.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="px-3 py-1.5 text-sm rounded-md bg-[var(--muted)]"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(row)}
                  className="btn-secondary text-sm"
                >
                  {t("admin.notifications.governance.updateStatus")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
