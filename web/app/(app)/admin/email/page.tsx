"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { settingsApi, type AdminEmailSettings } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

type SmtpForm = {
  enabled: boolean;
  host: string;
  port: string;
  encryption: string;
  username: string;
  password: string;
  from_address: string;
  from_name: string;
};

type ImapForm = {
  enabled: boolean;
  mailbox_address: string;
  host: string;
  port: string;
  encryption: string;
  username: string;
  password: string;
  notes?: string;
  allowlist?: string;
};

const emptySmtp = (): SmtpForm => ({
  enabled: true,
  host: "",
  port: "587",
  encryption: "tls",
  username: "",
  password: "",
  from_address: "",
  from_name: "SADC-PF Nexus",
});

const emptyImap = (port = "993"): ImapForm => ({
  enabled: true,
  mailbox_address: "",
  host: "",
  port,
  encryption: "ssl",
  username: "",
  password: "",
  notes: "",
  allowlist: "",
});

export default function AdminEmailPage() {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [smtp, setSmtp] = useState<SmtpForm>(emptySmtp());
  const [smtpMeta, setSmtpMeta] = useState({ configured: false, has_password: false });
  const [registry, setRegistry] = useState<ImapForm>(emptyImap());
  const [registryMeta, setRegistryMeta] = useState({ configured: false, has_password: false });
  const [invoices, setInvoices] = useState<ImapForm>(emptyImap());
  const [invoicesMeta, setInvoicesMeta] = useState({ configured: false, has_password: false });

  const load = async () => {
    setLoading(true);
    try {
      const res = await settingsApi.email();
      const data = res.data.data as AdminEmailSettings;
      setSmtp({
        enabled: data.smtp.enabled,
        host: data.smtp.host ?? "",
        port: String(data.smtp.port ?? 587),
        encryption: data.smtp.encryption ?? "tls",
        username: data.smtp.username ?? "",
        password: "",
        from_address: data.smtp.from_address ?? "",
        from_name: data.smtp.from_name ?? "SADC-PF Nexus",
      });
      setSmtpMeta({ configured: data.smtp.configured, has_password: data.smtp.has_password });
      setRegistry({
        enabled: data.correspondence_imap.enabled,
        mailbox_address: data.correspondence_imap.mailbox_address ?? "",
        host: data.correspondence_imap.host ?? "",
        port: String(data.correspondence_imap.port ?? 993),
        encryption: data.correspondence_imap.encryption ?? "ssl",
        username: data.correspondence_imap.username ?? "",
        password: "",
        notes: data.correspondence_imap.notes ?? "",
      });
      setRegistryMeta({ configured: data.correspondence_imap.configured, has_password: data.correspondence_imap.has_password });
      setInvoices({
        enabled: data.procurement_imap.enabled,
        mailbox_address: data.procurement_imap.mailbox_address ?? "",
        host: data.procurement_imap.host ?? "",
        port: String(data.procurement_imap.port ?? 993),
        encryption: data.procurement_imap.encryption ?? "ssl",
        username: data.procurement_imap.username ?? "",
        password: "",
        allowlist: data.procurement_imap.allowlist ?? "",
      });
      setInvoicesMeta({ configured: data.procurement_imap.configured, has_password: data.procurement_imap.has_password });
    } catch {
      error("Could not load email settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.updateEmail({
        smtp: {
          enabled: smtp.enabled,
          host: smtp.host || null,
          port: smtp.port ? Number(smtp.port) : 587,
          encryption: smtp.encryption,
          username: smtp.username || null,
          from_address: smtp.from_address || null,
          from_name: smtp.from_name || null,
          ...(smtp.password ? { password: smtp.password } : {}),
        },
        correspondence_imap: {
          enabled: registry.enabled,
          mailbox_address: registry.mailbox_address || null,
          host: registry.host || null,
          port: registry.port ? Number(registry.port) : 993,
          encryption: registry.encryption,
          username: registry.username || null,
          notes: registry.notes || null,
          ...(registry.password ? { password: registry.password } : {}),
        },
        procurement_imap: {
          enabled: invoices.enabled,
          mailbox_address: invoices.mailbox_address || null,
          host: invoices.host || null,
          port: invoices.port ? Number(invoices.port) : 993,
          encryption: invoices.encryption,
          username: invoices.username || null,
          allowlist: invoices.allowlist || null,
          ...(invoices.password ? { password: invoices.password } : {}),
        },
      });
      setSmtp((s) => ({ ...s, password: "" }));
      setRegistry((s) => ({ ...s, password: "" }));
      setInvoices((s) => ({ ...s, password: "" }));
      success("Email settings saved.");
      await load();
    } catch {
      error("Could not save email settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/admin" className="transition-colors hover:text-primary">Admin</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="font-medium text-neutral-900">Email</span>
      </div>

      <ModulePageHeader
        title="Email"
        subtitle="Outgoing SMTP for notifications, plus designated incoming mailboxes. Passwords are stored encrypted and never displayed. These are not all-employee inboxes."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Email" }]} />}
      />

      {loading ? (
        <div className="h-48 animate-pulse rounded-xl bg-neutral-100" />
      ) : (
        <>
          <section className="card space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Outgoing SMTP</h2>
                <p className="mt-1 text-xs text-neutral-500">Used for notifications, password resets, and LPO emails. Env MAIL_* is used if this form is incomplete.</p>
              </div>
              <StatusPill configured={smtpMeta.configured} />
            </div>
            <label htmlFor="smtp-enabled" className="flex items-center gap-2 text-sm">
              <input id="smtp-enabled" type="checkbox" checked={smtp.enabled} onChange={(e) => setSmtp((s) => ({ ...s, enabled: e.target.checked }))} />
              Enable Admin SMTP
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="smtp-host" className="mb-1 block text-xs font-semibold text-neutral-700">Host</label>
                <input id="smtp-host" className="form-input" value={smtp.host} onChange={(e) => setSmtp((s) => ({ ...s, host: e.target.value }))} autoComplete="off" />
              </div>
              <div>
                <label htmlFor="smtp-port" className="mb-1 block text-xs font-semibold text-neutral-700">Port</label>
                <input id="smtp-port" className="form-input" value={smtp.port} onChange={(e) => setSmtp((s) => ({ ...s, port: e.target.value }))} inputMode="numeric" />
              </div>
              <div>
                <label htmlFor="smtp-encryption" className="mb-1 block text-xs font-semibold text-neutral-700">Encryption</label>
                <select id="smtp-encryption" className="form-input" value={smtp.encryption} onChange={(e) => setSmtp((s) => ({ ...s, encryption: e.target.value }))}>
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label htmlFor="smtp-username" className="mb-1 block text-xs font-semibold text-neutral-700">Username</label>
                <input id="smtp-username" className="form-input" value={smtp.username} onChange={(e) => setSmtp((s) => ({ ...s, username: e.target.value }))} autoComplete="off" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="smtp-password" className="mb-1 block text-xs font-semibold text-neutral-700">Password</label>
                <input id="smtp-password" type="password" className="form-input" value={smtp.password} onChange={(e) => setSmtp((s) => ({ ...s, password: e.target.value }))} placeholder={smtpMeta.has_password ? "Leave blank to keep the saved password" : "SMTP password"} autoComplete="new-password" />
              </div>
              <div>
                <label htmlFor="smtp-from-address" className="mb-1 block text-xs font-semibold text-neutral-700">From address</label>
                <input id="smtp-from-address" className="form-input" value={smtp.from_address} onChange={(e) => setSmtp((s) => ({ ...s, from_address: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="smtp-from-name" className="mb-1 block text-xs font-semibold text-neutral-700">From name</label>
                <input id="smtp-from-name" className="form-input" value={smtp.from_name} onChange={(e) => setSmtp((s) => ({ ...s, from_name: e.target.value }))} />
              </div>
            </div>
          </section>

          <section className="card space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Incoming — correspondence registry</h2>
                <p className="mt-1 text-xs text-neutral-500">Designated registry mailbox only. Suggestions are never auto-registered. <Link href="/correspondence/mailbox" className="text-primary hover:underline">Open mailbox queue</Link></p>
              </div>
              <StatusPill configured={registryMeta.configured} />
            </div>
            <ImapFields idPrefix="registry" form={registry} setForm={setRegistry} hasPassword={registryMeta.has_password} showNotes />
          </section>

          <section className="card space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">Incoming — procurement invoices</h2>
                <p className="mt-1 text-xs text-neutral-500">Designated invoice mailbox. Attachments become intakes for review and are never auto-confirmed. <Link href="/procurement/inbox" className="text-primary hover:underline">Open procurement inbox</Link></p>
              </div>
              <StatusPill configured={invoicesMeta.configured} />
            </div>
            <ImapFields idPrefix="invoices" form={invoices} setForm={setInvoices} hasPassword={invoicesMeta.has_password} showAllowlist />
          </section>

          <div className="flex justify-end">
            <button type="button" className="btn-primary px-6 py-2.5 text-sm disabled:opacity-60" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Save email settings"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatusPill({ configured }: { configured: boolean }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
      {configured ? "Configured" : "Not configured"}
    </span>
  );
}

function ImapFields({
  idPrefix,
  form,
  setForm,
  hasPassword,
  showNotes = false,
  showAllowlist = false,
}: {
  idPrefix: string;
  form: ImapForm;
  setForm: (fn: (current: ImapForm) => ImapForm) => void;
  hasPassword: boolean;
  showNotes?: boolean;
  showAllowlist?: boolean;
}) {
  return (
    <>
      <label htmlFor={`${idPrefix}-enabled`} className="flex items-center gap-2 text-sm">
        <input id={`${idPrefix}-enabled`} type="checkbox" checked={form.enabled} onChange={(e) => setForm((s) => ({ ...s, enabled: e.target.checked }))} />
        Enable this mailbox
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-mailbox`} className="mb-1 block text-xs font-semibold text-neutral-700">Mailbox address</label>
          <input id={`${idPrefix}-mailbox`} className="form-input" value={form.mailbox_address} onChange={(e) => setForm((s) => ({ ...s, mailbox_address: e.target.value }))} />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-host`} className="mb-1 block text-xs font-semibold text-neutral-700">IMAP host</label>
          <input id={`${idPrefix}-host`} className="form-input" value={form.host} onChange={(e) => setForm((s) => ({ ...s, host: e.target.value }))} autoComplete="off" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-port`} className="mb-1 block text-xs font-semibold text-neutral-700">Port</label>
          <input id={`${idPrefix}-port`} className="form-input" value={form.port} onChange={(e) => setForm((s) => ({ ...s, port: e.target.value }))} inputMode="numeric" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-encryption`} className="mb-1 block text-xs font-semibold text-neutral-700">Encryption</label>
          <select id={`${idPrefix}-encryption`} className="form-input" value={form.encryption} onChange={(e) => setForm((s) => ({ ...s, encryption: e.target.value }))}>
            <option value="ssl">SSL</option>
            <option value="tls">TLS</option>
            <option value="none">None</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-username`} className="mb-1 block text-xs font-semibold text-neutral-700">Username</label>
          <input id={`${idPrefix}-username`} className="form-input" value={form.username} onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))} autoComplete="off" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-password`} className="mb-1 block text-xs font-semibold text-neutral-700">Password</label>
          <input id={`${idPrefix}-password`} type="password" className="form-input" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} placeholder={hasPassword ? "Leave blank to keep the saved password" : "IMAP password"} autoComplete="new-password" />
        </div>
        {showAllowlist ? (
          <div className="sm:col-span-2">
            <label htmlFor={`${idPrefix}-allowlist`} className="mb-1 block text-xs font-semibold text-neutral-700">Sender allowlist (optional)</label>
            <input id={`${idPrefix}-allowlist`} className="form-input" value={form.allowlist ?? ""} onChange={(e) => setForm((s) => ({ ...s, allowlist: e.target.value }))} placeholder="trusted@example.org, accounts@supplier.test" />
          </div>
        ) : null}
        {showNotes ? (
          <div className="sm:col-span-2">
            <label htmlFor={`${idPrefix}-notes`} className="mb-1 block text-xs font-semibold text-neutral-700">Notes</label>
            <textarea id={`${idPrefix}-notes`} className="form-input" rows={2} value={form.notes ?? ""} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
          </div>
        ) : null}
      </div>
    </>
  );
}
