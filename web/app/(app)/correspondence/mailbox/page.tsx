"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { correspondenceApi, type CorrespondenceMailboxSuggestion } from "@/lib/api";

export default function CorrespondenceMailboxPage() {
  const qc = useQueryClient();
  const [settingsForm, setSettingsForm] = useState({
    mailbox_address: "",
    enabled: true,
    notes: "",
    imap_host: "",
    imap_port: "993",
    imap_encryption: "ssl",
    imap_username: "",
    imap_password: "",
  });
  const [importForm, setImportForm] = useState({
    message_id: "",
    subject: "",
    from_address: "",
    from_name: "",
    body_preview: "",
    raw_headers: "",
  });
  const [error, setError] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["correspondence", "mailbox", "settings"],
    queryFn: () => correspondenceApi.mailboxSettings().then((r) => r.data.data),
  });

  const suggestionsQuery = useQuery({
    queryKey: ["correspondence", "mailbox", "suggestions"],
    queryFn: () => correspondenceApi.mailboxSuggestions({ status: "suggested" }).then((r) => r.data.data ?? []),
  });

  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setSettingsForm((f) => ({
      ...f,
      mailbox_address: s.mailbox_address ?? "",
      enabled: Boolean(s.enabled),
      notes: s.notes ?? "",
      imap_host: s.imap_host ?? "",
      imap_port: String(s.imap_port ?? 993),
      imap_encryption: s.imap_encryption ?? "ssl",
      imap_username: s.imap_username ?? "",
    }));
  }, [settingsQuery.data]);

  const saveSettings = useMutation({
    mutationFn: () =>
      correspondenceApi.updateMailboxSettings({
        mailbox_address: settingsForm.mailbox_address || null,
        enabled: settingsForm.enabled,
        notes: settingsForm.notes || null,
        imap_host: settingsForm.imap_host || null,
        imap_port: settingsForm.imap_port ? Number(settingsForm.imap_port) : null,
        imap_encryption: settingsForm.imap_encryption || null,
        imap_username: settingsForm.imap_username || null,
        ...(settingsForm.imap_password ? { imap_password: settingsForm.imap_password } : {}),
      }),
    onSuccess: () => {
      setError(null);
      setSettingsForm((f) => ({ ...f, imap_password: "" }));
      qc.invalidateQueries({ queryKey: ["correspondence", "mailbox", "settings"] });
    },
    onError: () => setError("Could not save mailbox settings."),
  });

  const importSuggestion = useMutation({
    mutationFn: () => correspondenceApi.importMailboxSuggestion(importForm),
    onSuccess: () => {
      setError(null);
      setImportForm({ message_id: "", subject: "", from_address: "", from_name: "", body_preview: "", raw_headers: "" });
      qc.invalidateQueries({ queryKey: ["correspondence", "mailbox", "suggestions"] });
    },
    onError: () => setError("Import failed — Message-ID may already exist."),
  });

  const registerSuggestion = useMutation({
    mutationFn: (id: number) => correspondenceApi.registerMailboxSuggestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["correspondence", "mailbox"] }),
    onError: () => setError("Could not register suggestion into the correspondence register."),
  });

  const dismissSuggestion = useMutation({
    mutationFn: (id: number) => correspondenceApi.dismissMailboxSuggestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["correspondence", "mailbox", "suggestions"] }),
  });

  const suggestions = (suggestionsQuery.data ?? []) as CorrespondenceMailboxSuggestion[];
  const settings = settingsQuery.data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ModulePageHeader
        title="Registry Mailbox"
        subtitle="Suggestion-only intake for the designated registry mailbox. Not all-employee email ingest, and nothing auto-submits.\r\n          Poll via php artisan corresponde"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Registry Mailbox" }]} />}
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="card space-y-3 p-4">
        <h2 className="text-base font-semibold">Mailbox settings</h2>
        <p className="text-sm text-neutral-600">
          Current: {settings?.mailbox_address || "not configured"} {settings?.enabled ? "(enabled)" : "(disabled)"}
          {" · "}
          IMAP {settings?.imap_configured ? "ready" : "not fully configured"}
          {settings?.last_polled_at ? ` · last poll ${new Date(settings.last_polled_at).toLocaleString()}` : ""}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="form-input" placeholder="registry@sadcpf.org" value={settingsForm.mailbox_address} onChange={(e) => setSettingsForm((f) => ({ ...f, mailbox_address: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settingsForm.enabled} onChange={(e) => setSettingsForm((f) => ({ ...f, enabled: e.target.checked }))} />
            Enabled for suggestion intake
          </label>
          <input className="form-input" placeholder="IMAP host" value={settingsForm.imap_host} onChange={(e) => setSettingsForm((f) => ({ ...f, imap_host: e.target.value }))} />
          <input className="form-input" placeholder="IMAP port" value={settingsForm.imap_port} onChange={(e) => setSettingsForm((f) => ({ ...f, imap_port: e.target.value }))} />
          <select className="form-input" value={settingsForm.imap_encryption} onChange={(e) => setSettingsForm((f) => ({ ...f, imap_encryption: e.target.value }))}>
            <option value="ssl">SSL</option>
            <option value="tls">TLS</option>
            <option value="none">None</option>
          </select>
          <input className="form-input" placeholder="IMAP username" value={settingsForm.imap_username} onChange={(e) => setSettingsForm((f) => ({ ...f, imap_username: e.target.value }))} />
          <input className="form-input md:col-span-2" type="password" placeholder={settings?.has_imap_password ? "IMAP password (leave blank to keep / use CORRESPONDENCE_IMAP_PASSWORD)" : "IMAP password (optional if env set)"} value={settingsForm.imap_password} onChange={(e) => setSettingsForm((f) => ({ ...f, imap_password: e.target.value }))} />
          <textarea className="form-input md:col-span-2" rows={2} placeholder="Notes — designated registry mailbox only" value={settingsForm.notes} onChange={(e) => setSettingsForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
          Save settings
        </button>
      </div>

      <div className="card space-y-3 p-4">
        <h2 className="text-base font-semibold">Import suggested message</h2>
        <p className="text-sm text-neutral-600">Paste Message-ID (required). Duplicate Message-IDs are rejected.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="form-input" placeholder="Message-ID e.g. <abc@mail>" value={importForm.message_id} onChange={(e) => setImportForm((f) => ({ ...f, message_id: e.target.value }))} />
          <input className="form-input" placeholder="Subject" value={importForm.subject} onChange={(e) => setImportForm((f) => ({ ...f, subject: e.target.value }))} />
          <input className="form-input" placeholder="From address" value={importForm.from_address} onChange={(e) => setImportForm((f) => ({ ...f, from_address: e.target.value }))} />
          <input className="form-input" placeholder="From name" value={importForm.from_name} onChange={(e) => setImportForm((f) => ({ ...f, from_name: e.target.value }))} />
          <textarea className="form-input md:col-span-2" rows={2} placeholder="Body preview" value={importForm.body_preview} onChange={(e) => setImportForm((f) => ({ ...f, body_preview: e.target.value }))} />
          <textarea className="form-input md:col-span-2" rows={3} placeholder="Raw headers (optional)" value={importForm.raw_headers} onChange={(e) => setImportForm((f) => ({ ...f, raw_headers: e.target.value }))} />
        </div>
        <button type="button" className="btn-primary text-sm" disabled={!importForm.message_id || importSuggestion.isPending} onClick={() => importSuggestion.mutate()}>
          Import suggested message
        </button>
      </div>

      <div className="card overflow-x-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Suggested messages</h2>
          <Link href="/correspondence/incoming" className="text-sm text-primary hover:underline">Manual incoming register →</Link>
        </div>
        <table className="min-w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-2">Message-ID</th>
              <th className="py-2">Subject</th>
              <th className="py-2">From</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.id} className="border-t border-[var(--border)]">
                <td className="py-2 font-mono text-xs">{s.message_id}</td>
                <td className="py-2">{s.subject || "—"}</td>
                <td className="py-2">{s.from_name || s.from_address || "—"}</td>
                <td className="py-2 space-x-2">
                  <button type="button" className="text-primary hover:underline" onClick={() => registerSuggestion.mutate(s.id)}>Register</button>
                  <button type="button" className="text-neutral-500 hover:underline" onClick={() => dismissSuggestion.mutate(s.id)}>Dismiss</button>
                </td>
              </tr>
            ))}
            {suggestions.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-neutral-400">No open suggestions.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
