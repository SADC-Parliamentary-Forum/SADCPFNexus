"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  notificationGovernanceApi,
  type NotificationGovernanceDecision,
} from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  decided: "Decided",
  not_applicable: "Not Applicable",
};

export default function NotificationsGovernancePage() {
  const [rows, setRows] = useState<NotificationGovernanceDecision[]>([]);
  const [channelStatus, setChannelStatus] = useState<{ sms?: string; whatsapp?: string }>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
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
      .catch(() => setToast("Could not load governance checklist"))
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
      setToast("Decision saved");
      setEditing(null);
      load();
    } catch {
      setToast("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Notifications governance checklist
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            PRD §124 — institutional decisions required before final configuration. All items
            default to Pending; do not invent answers here.
          </p>
        </div>
        <Link href="/admin/notifications" className="text-sm text-primary underline">
          Back to notifications admin
        </Link>
      </div>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm space-y-1">
        <div>
          <span className="font-medium">SMS:</span>{" "}
          {channelStatus.sms ?? "Governance Configuration Pending"}
        </div>
        <div>
          <span className="font-medium">WhatsApp:</span>{" "}
          {channelStatus.whatsapp ?? "Governance Configuration Pending"}
        </div>
        <p className="text-[var(--muted-foreground)]">
          Live SMS/WhatsApp remain Null stubs until this checklist records an approved decision
          and credentials are provisioned through governance — never invent secrets.
        </p>
      </div>

      {toast && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          {toast}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
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
                  {STATUS_LABELS[row.status] ?? row.status}
                </span>
              </div>

              {row.decision_notes && editing !== row.id && (
                <p className="text-sm whitespace-pre-wrap">{row.decision_notes}</p>
              )}
              {(row.decided_by || row.decided_at) && editing !== row.id && (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Decided
                  {row.decided_by_user?.name ? ` by ${row.decided_by_user.name}` : ""}
                  {row.decided_at ? ` at ${new Date(row.decided_at).toLocaleString()}` : ""}
                </p>
              )}

              {editing === row.id ? (
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <label className="block text-sm">
                    Status
                    <select
                      className="mt-1 w-full border border-[var(--border)] rounded-md px-2 py-1.5 bg-[var(--background)]"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="decided">Decided</option>
                      <option value="not_applicable">Not Applicable</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    Decision notes
                    <textarea
                      className="mt-1 w-full border border-[var(--border)] rounded-md px-2 py-1.5 bg-[var(--background)] min-h-[80px]"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Record the institutional decision when available — leave empty while Pending."
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => save(row.id)}
                      className="px-3 py-1.5 text-sm rounded-md bg-primary text-white disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="px-3 py-1.5 text-sm rounded-md bg-[var(--muted)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(row)}
                  className="text-sm text-primary underline"
                >
                  Update status
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
