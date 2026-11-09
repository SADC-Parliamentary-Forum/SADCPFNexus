"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import api, { correspondenceApi, type CorrespondenceLetter } from "@/lib/api";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { exportToCsv } from "@/lib/csvExport";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type HoldRow = {
  id: number;
  reference_number?: string;
  registry_reference?: string;
  title: string;
  retention_policy?: string;
  retain_until?: string;
  legal_hold: boolean;
  legal_hold_reason?: string;
};

export default function CorrespondenceRetentionPage() {
  const { t } = useI18n();
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [letters, setLetters] = useState<CorrespondenceLetter[]>([]);
  const [letterId, setLetterId] = useState("");
  const [form, setForm] = useState({
    retention_policy: "general_3y",
    retain_until: "",
    legal_hold: true,
    legal_hold_reason: "",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [releasingId, setReleasingId] = useState<number | null>(null);
  const { confirm } = useConfirm();

  async function loadHolds() {
    const r = await api.get<{ data: HoldRow[] }>("/correspondence/legal-holds");
    const body = r.data as { data?: HoldRow[] };
    setHolds(Array.isArray(body.data) ? body.data : []);
  }

  useEffect(() => {
    loadHolds().catch(() => setHolds([]));
    correspondenceApi
      .list({ per_page: 100 })
      .then((r) => setLetters(r.data.data ?? []))
      .catch(() => setLetters([]));
  }, []);

  async function saveRetention(e: FormEvent) {
    e.preventDefault();
    const targetLetterId = letterId.trim();
    if (!targetLetterId || saving) return;

    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      await api.put(`/correspondence/letters/${targetLetterId}/retention`, {
        retention_policy: form.retention_policy,
        retain_until: form.retain_until || null,
        legal_hold: form.legal_hold,
        legal_hold_reason: form.legal_hold_reason || null,
      });
      setMsg(t("correspondence.retention.updated"));
      await loadHolds();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : t("correspondence.retention.updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function release(id: number) {
    if (releasingId) return;
    const ok = await confirm({
      title: t("correspondence.retention.releaseTitle"),
      message: t("correspondence.retention.releaseMessage"),
      confirmText: t("documents.register.releaseHold"),
      variant: "danger",
    });
    if (!ok) return;

    setErr(null);
    setReleasingId(id);
    try {
      await api.post(`/correspondence/letters/${id}/release-hold`);
      setMsg(t("correspondence.retention.released"));
      await loadHolds();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : t("correspondence.retention.releaseFailed"));
    } finally {
      setReleasingId(null);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("correspondence.retention.title")}
        subtitle={t("correspondence.retention.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("correspondence.retention.crumbCorrespondence"), href: "/correspondence" },
              { label: t("correspondence.retention.crumbRetention") },
            ]}
          />
        }
        actions={
          <>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() =>
                exportToCsv(
                  "correspondence-legal-holds.csv",
                  holds.map((h) => ({
                    ref: h.registry_reference || h.reference_number || h.id,
                    title: h.title,
                    policy: h.retention_policy ?? "",
                    retain_until: h.retain_until ?? "",
                    reason: h.legal_hold_reason ?? "",
                  })),
                  [
                    { key: "ref", header: t("correspondence.retention.colRef") },
                    { key: "title", header: t("correspondence.retention.colTitle") },
                    { key: "policy", header: t("correspondence.retention.colPolicy") },
                    { key: "retain_until", header: t("documents.register.retainUntil") },
                    { key: "reason", header: t("correspondence.retention.colReason") },
                  ],
                )
              }
              disabled={holds.length === 0}
            >
              {t("correspondence.retention.exportCsv")}
            </button>
            <Link href="/correspondence/master-register" className="btn-secondary btn-sm">
              {t("correspondence.retention.masterRegister")}
            </Link>
          </>
        }
      />
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

      <form onSubmit={saveRetention} className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-neutral-900">{t("correspondence.retention.formTitle")}</h2>
        <label htmlFor="retention-letter-select" className="block text-sm">
          {t("correspondence.retention.letter")}
          <select
            id="retention-letter-select"
            className="form-input mt-1 w-full disabled:opacity-60"
            required
            value={letterId}
            data-testid="retention-letter-select"
            onChange={(e) => setLetterId(e.target.value)}
            disabled={saving}
          >
            <option value="">{t("pickers.none")}</option>
            {letters.map((letter) => (
              <option key={letter.id} value={String(letter.id)}>
                {letter.reference_number || letter.registry_reference || `#${letter.id}`} — {letter.title}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label htmlFor="correspondence-retention-retention-policy-setform-disabled-general-3-year" className="block text-sm">
            {t("documents.register.policy")}
            <select id="correspondence-retention-retention-policy-setform-disabled-general-3-year"
              className="form-input mt-1 w-full disabled:opacity-60"
              value={form.retention_policy}
              onChange={(e) => setForm({ ...form, retention_policy: e.target.value })}
              disabled={saving}
            >
              <option value="general_3y">{t("correspondence.retention.policyGeneral3y")}</option>
              <option value="financial_7y">{t("correspondence.retention.policyFinancial7y")}</option>
              <option value="hr_permanent">{t("correspondence.retention.policyHrPermanent")}</option>
              <option value="legal_hold_only">{t("documents.register.holdOnly")}</option>
              <option value="custom">{t("correspondence.retention.policyCustom")}</option>
            </select>
          </label>
          <label htmlFor="correspondence-retention-retain-until-setform-disabled" className="block text-sm">
            {t("documents.register.retainUntil")}
            <input id="correspondence-retention-retain-until-setform-disabled"
              type="date"
              className="form-input mt-1 w-full disabled:opacity-60"
              value={form.retain_until}
              onChange={(e) => setForm({ ...form, retain_until: e.target.value })}
              disabled={saving}
            />
          </label>
        </div>
        <label htmlFor="correspondence-retention-setform-disabled-place-legal-hold" className="flex items-center gap-2 text-sm">
          <input id="correspondence-retention-setform-disabled-place-legal-hold"
            type="checkbox"
            checked={form.legal_hold}
            onChange={(e) => setForm({ ...form, legal_hold: e.target.checked })}
            disabled={saving}
          />
          {t("correspondence.retention.placeHold")}
        </label>
        <label htmlFor="correspondence-retention-hold-reason-setform-disabled" className="block text-sm">
          {t("correspondence.retention.holdReason")}
          <textarea id="correspondence-retention-hold-reason-setform-disabled"
            className="form-input mt-1 w-full disabled:opacity-60"
            rows={2}
            value={form.legal_hold_reason}
            onChange={(e) => setForm({ ...form, legal_hold_reason: e.target.value })}
            disabled={saving}
          />
        </label>
        <button type="submit" className="btn-primary btn-sm disabled:opacity-60 disabled:cursor-not-allowed" disabled={saving || !letterId.trim()}>
          {saving ? t("correspondence.retention.saving") : t("common.save")}
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-card dark:border-neutral-700 dark:bg-neutral-900">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("correspondence.retention.colRef")}</th>
              <th>{t("correspondence.retention.colTitle")}</th>
              <th>{t("correspondence.retention.colPolicy")}</th>
              <th>{t("documents.register.retainUntil")}</th>
              <th>{t("correspondence.retention.colReason")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {holds.map((h) => (
              <tr key={h.id}>
                <td>
                  <Link href={`/correspondence/${h.id}`} className="btn-secondary text-xs py-1 px-2">
                    {h.registry_reference || h.reference_number || h.id}
                  </Link>
                </td>
                <td>{h.title}</td>
                <td>{h.retention_policy ?? "—"}</td>
                <td>{h.retain_until ?? "—"}</td>
                <td className="max-w-xs truncate">{h.legal_hold_reason ?? "—"}</td>
                <td>
                  <button
                    type="button"
                    className="btn-secondary text-xs disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => void release(h.id)}
                    disabled={releasingId === h.id}
                  >
                    {releasingId === h.id ? t("correspondence.retention.releasing") : t("documents.register.releaseHold")}
                  </button>
                </td>
              </tr>
            ))}
            {holds.length === 0 && (
              <TableEmpty colSpan={6} title={t("correspondence.retention.empty")} />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
