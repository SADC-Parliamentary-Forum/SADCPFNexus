"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { correspondenceApi, type CorrespondenceMailboxSuggestion } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function CorrespondenceMailboxPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
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
      toast.success(t("correspondence.mailbox.saved"));
      qc.invalidateQueries({ queryKey: ["correspondence", "mailbox", "settings"] });
    },
    onError: (err) => {
      setError(t("correspondence.mailbox.saveFailed"));
      toast.error(t("correspondence.mailbox.notSaved"), apiErrorMessage(err, t("correspondence.mailbox.saveFailed")));
    },
  });

  const importSuggestion = useMutation({
    mutationFn: () => correspondenceApi.importMailboxSuggestion(importForm),
    onSuccess: () => {
      setError(null);
      setImportForm({ message_id: "", subject: "", from_address: "", from_name: "", body_preview: "", raw_headers: "" });
      toast.success(t("correspondence.mailbox.imported"));
      qc.invalidateQueries({ queryKey: ["correspondence", "mailbox", "suggestions"] });
    },
    onError: (err) => {
      setError(t("correspondence.mailbox.importFailed"));
      toast.error(t("correspondence.mailbox.notImported"), apiErrorMessage(err, t("correspondence.mailbox.importFailed")));
    },
  });

  const registerSuggestion = useMutation({
    mutationFn: (id: number) => correspondenceApi.registerMailboxSuggestion(id),
    onSuccess: () => {
      toast.success(t("correspondence.mailbox.registered"));
      qc.invalidateQueries({ queryKey: ["correspondence", "mailbox"] });
    },
    onError: (err) => {
      setError(t("correspondence.mailbox.registerFailed"));
      toast.error(t("correspondence.mailbox.notRegistered"), apiErrorMessage(err, t("correspondence.mailbox.registerFailed")));
    },
  });

  const dismissSuggestion = useMutation({
    mutationFn: (id: number) => correspondenceApi.dismissMailboxSuggestion(id),
    onSuccess: () => {
      toast.success(t("correspondence.mailbox.dismissed"));
      qc.invalidateQueries({ queryKey: ["correspondence", "mailbox", "suggestions"] });
    },
    onError: (err) => toast.error(t("correspondence.mailbox.dismissFailedTitle"), apiErrorMessage(err, t("correspondence.mailbox.dismissFailed"))),
  });

  const suggestions = (suggestionsQuery.data ?? []) as CorrespondenceMailboxSuggestion[];
  const settings = settingsQuery.data;

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("correspondence.mailbox.title")}
        subtitle={t("correspondence.mailbox.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("correspondence.mailbox.title") }]} />}
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="card space-y-3 p-4">
        <h2 className="text-base font-semibold">{t("correspondence.mailbox.settings")}</h2>
        <p className="text-sm text-neutral-600">
          {t("correspondence.mailbox.current", { address: settings?.mailbox_address || t("correspondence.mailbox.notConfigured"), state: settings?.enabled ? t("correspondence.mailbox.enabled") : t("correspondence.mailbox.disabled") })}
          {" · "}
          {t("correspondence.mailbox.imap", { status: settings?.imap_configured ? t("correspondence.mailbox.imapReady") : t("correspondence.mailbox.imapPartial") })}
          {settings?.last_polled_at ? ` · ${t("correspondence.mailbox.lastPoll", { time: new Date(settings.last_polled_at).toLocaleString() })}` : ""}
          {" · "}
          {t("correspondence.mailbox.adminHint")}{" "}
          <Link href="/admin/email" className="font-medium text-primary">{t("correspondence.mailbox.adminLink")}</Link>.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="form-input" placeholder="registry@sadcpf.org" value={settingsForm.mailbox_address} onChange={(e) => setSettingsForm((f) => ({ ...f, mailbox_address: e.target.value }))} /> {/* i18n-ignore */}
          <label htmlFor="correspondence-mailbox-setsettingsform-f-enabled-for-suggestion-intake" className="flex items-center gap-2 text-sm">
            <input id="correspondence-mailbox-setsettingsform-f-enabled-for-suggestion-intake" type="checkbox" checked={settingsForm.enabled} onChange={(e) => setSettingsForm((f) => ({ ...f, enabled: e.target.checked }))} />
            {t("correspondence.mailbox.enabledLabel")}
          </label>
          <input className="form-input" placeholder={t("correspondence.mailbox.imapHost")} value={settingsForm.imap_host} onChange={(e) => setSettingsForm((f) => ({ ...f, imap_host: e.target.value }))} />
          <input className="form-input" placeholder={t("correspondence.mailbox.imapPort")} value={settingsForm.imap_port} onChange={(e) => setSettingsForm((f) => ({ ...f, imap_port: e.target.value }))} />
          <select className="form-input" value={settingsForm.imap_encryption} onChange={(e) => setSettingsForm((f) => ({ ...f, imap_encryption: e.target.value }))}>
            <option value="ssl">SSL</option> {/* i18n-ignore */}
            <option value="tls">TLS</option> {/* i18n-ignore */}
            <option value="none">{t("correspondence.mailbox.none")}</option>
          </select>
          <input className="form-input" placeholder={t("correspondence.mailbox.imapUsername")} value={settingsForm.imap_username} onChange={(e) => setSettingsForm((f) => ({ ...f, imap_username: e.target.value }))} />
          <input className="form-input md:col-span-2" type="password" placeholder={settings?.has_imap_password ? t("correspondence.mailbox.imapPasswordKeep") : t("correspondence.mailbox.imapPasswordOptional")} value={settingsForm.imap_password} onChange={(e) => setSettingsForm((f) => ({ ...f, imap_password: e.target.value }))} />
          <textarea className="form-input md:col-span-2" rows={2} placeholder={t("correspondence.mailbox.notes")} value={settingsForm.notes} onChange={(e) => setSettingsForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <button type="button" className="btn-primary text-sm" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
          {t("correspondence.mailbox.saveSettings")}
        </button>
      </div>

      <div className="card space-y-3 p-4">
        <h2 className="text-base font-semibold">{t("correspondence.mailbox.importTitle")}</h2>
        <p className="text-sm text-neutral-600">{t("correspondence.mailbox.importHint")}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="form-input" placeholder={t("correspondence.mailbox.messageIdPlaceholder")} value={importForm.message_id} onChange={(e) => setImportForm((f) => ({ ...f, message_id: e.target.value }))} />
          <input className="form-input" placeholder={t("correspondence.col.subject")} value={importForm.subject} onChange={(e) => setImportForm((f) => ({ ...f, subject: e.target.value }))} />
          <input className="form-input" placeholder={t("correspondence.mailbox.fromAddress")} value={importForm.from_address} onChange={(e) => setImportForm((f) => ({ ...f, from_address: e.target.value }))} />
          <input className="form-input" placeholder={t("correspondence.mailbox.fromName")} value={importForm.from_name} onChange={(e) => setImportForm((f) => ({ ...f, from_name: e.target.value }))} />
          <textarea className="form-input md:col-span-2" rows={2} placeholder={t("correspondence.mailbox.bodyPreview")} value={importForm.body_preview} onChange={(e) => setImportForm((f) => ({ ...f, body_preview: e.target.value }))} />
          <textarea className="form-input md:col-span-2" rows={3} placeholder={t("correspondence.mailbox.rawHeaders")} value={importForm.raw_headers} onChange={(e) => setImportForm((f) => ({ ...f, raw_headers: e.target.value }))} />
        </div>
        <button type="button" className="btn-primary text-sm" disabled={!importForm.message_id || importSuggestion.isPending} onClick={() => importSuggestion.mutate()}>
          {t("correspondence.mailbox.importTitle")}
        </button>
      </div>

      <div className="card overflow-x-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("correspondence.mailbox.suggested")}</h2>
          <Link href="/correspondence/incoming" className="btn-secondary text-sm py-1 px-2">{t("correspondence.mailbox.manualRegister")}</Link>
        </div>
        <table className="min-w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-2">Message-ID</th> {/* i18n-ignore */}
              <th className="py-2">{t("correspondence.col.subject")}</th>
              <th className="py-2">{t("correspondence.col.from")}</th>
              <th className="py-2">{t("correspondence.col.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.id} className="border-t border-[var(--border)]">
                <td className="py-2 font-mono text-xs">{s.message_id}</td>
                <td className="py-2">{s.subject || "—"}</td>
                <td className="py-2">{s.from_name || s.from_address || "—"}</td>
                <td className="py-2 space-x-2">
                  <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => registerSuggestion.mutate(s.id)}>{t("correspondence.mailbox.register")}</button>
                  <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => dismissSuggestion.mutate(s.id)}>{t("correspondence.mailbox.dismiss")}</button>
                </td>
              </tr>
            ))}
            {suggestions.length === 0 && (
              <TableEmpty colSpan={4} title={t("correspondence.mailbox.empty")} />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
