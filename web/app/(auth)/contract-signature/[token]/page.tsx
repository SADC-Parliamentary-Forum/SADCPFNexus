"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { contractExternalApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_LABEL: Record<string, string> = {
  pending: "contracts.signature.status.pending", signed: "contracts.signature.status.signed", declined: "contracts.signature.status.declined", changes_requested: "contracts.signature.status.changes_requested",
};

type Mode = "sign" | "decline" | "changes" | "done";

export default function ExternalContractSignaturePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("sign");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["external-contract", token],
    queryFn: () => contractExternalApi.view(token).then((r) => r.data.data),
    retry: false,
  });

  const run = async (fn: () => Promise<{ data: { message?: string } }>, done: string) => {
    setBusy(true); setError(null);
    try { await fn(); setResult(done); setMode("done"); }
    catch (e: unknown) { setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("common.error")); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-lg card p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">draw</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-neutral-900">{t("contracts.signature.title")}</h1>
            <p className="text-xs text-neutral-500">{t("contracts.signature.subtitle")}</p>
          </div>
        </div>

        {isLoading && <p className="text-sm text-neutral-500">{t("contracts.detail.loading")}</p>}
        {isError && <p className="text-sm text-red-600">{t("contracts.signature.invalid")}</p>}

        {data && mode !== "done" && (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-y border-neutral-100 py-4">
              <dt className="text-neutral-500">{t("contracts.field.reference")}</dt><dd className="font-mono text-neutral-900">{data.reference_number}</dd>
              <dt className="text-neutral-500">{t("contracts.field.title")}</dt><dd className="text-neutral-900">{data.title}</dd>
              <dt className="text-neutral-500">{t("contracts.field.value")}</dt><dd className="text-neutral-900 font-semibold">{data.currency} {Number(data.value).toLocaleString()}</dd>
              <dt className="text-neutral-500">{t("contracts.signature.period")}</dt><dd className="text-neutral-900">{data.start_date ?? "—"} → {data.end_date ?? "—"}</dd>
              {data.signature_deadline && (<><dt className="text-neutral-500">{t("contracts.signature.signBy")}</dt><dd className="text-neutral-900">{data.signature_deadline}</dd></>)}
            </dl>

            {data.purpose && <p className="text-sm text-neutral-600">{data.purpose}</p>}

            {data.document_available && (
              <a href={contractExternalApi.documentUrl(token)} className="btn-secondary inline-flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-[16px]">download</span>{t("contracts.signature.downloadDocument")}
              </a>
            )}

            {data.signatories.length > 0 && (
              <div className="text-sm">
                <p className="font-semibold text-neutral-700 mb-1">{t("contracts.signature.progress")}</p>
                <ul className="space-y-1">
                  {data.signatories.map((s, i) => (
                    <li key={i} className="flex justify-between text-neutral-600">
                      <span>{s.party === "sadcpf" ? "SADC PF" : t("contracts.signature.youCounterparty")}</span>
                      <span className={s.status === "signed" ? "text-green-700" : "text-neutral-500"}>{STATUS_LABEL[s.status] ? t(STATUS_LABEL[s.status]) : s.status}{s.signed_at ? ` · ${s.signed_at}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.deliverables.length > 0 && (
              <div className="text-sm">
                <p className="font-semibold text-neutral-700 mb-1">{t("contracts.signature.deliver")}</p>
                <ul className="list-disc pl-5 text-neutral-600 space-y-0.5">
                  {data.deliverables.map((d, i) => (<li key={i}>{d.name}{d.due_date ? ` — ${t("contracts.signature.dueOn", { date: d.due_date })}` : ""}</li>))}
                </ul>
              </div>
            )}

            {data.obligations.length > 0 && (
              <div className="text-sm">
                <p className="font-semibold text-neutral-700 mb-1">{t("contracts.create.obligations")}</p>
                <ul className="list-disc pl-5 text-neutral-600 space-y-0.5">
                  {data.obligations.map((o, i) => (<li key={i}>{o.obligation} <span className="text-neutral-400">({o.responsible_party === "sadcpf" ? "SADC PF" : t("contracts.signature.you")})</span></li>))}
                </ul>
              </div>
            )}

            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            {mode === "sign" && (
              <div className="space-y-3">
                <input className="form-input" placeholder={t("contracts.signature.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
                <label className="flex items-start gap-2 text-sm text-neutral-600">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                  {t("contracts.signature.consent")}
                </label>
                <button className="btn-primary w-full disabled:opacity-60" disabled={busy || !name.trim() || !consent}
                  onClick={() => run(() => contractExternalApi.sign(token, name.trim()), t("contracts.signature.signed"))}>
                  {t("contracts.signature.sign")}
                </button>
                <div className="flex gap-2 text-xs">
                  <button className="text-neutral-500 underline" onClick={() => setMode("changes")}>{t("contracts.signature.requestChanges")}</button>
                  <span className="text-neutral-300">·</span>
                  <button className="text-red-600 underline" onClick={() => setMode("decline")}>{t("contracts.signature.declineToSign")}</button>
                </div>
              </div>
            )}

            {mode === "decline" && (
              <div className="space-y-3">
                <textarea className="form-input h-24 resize-none" placeholder={t("contracts.signature.declineReason")} value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1" onClick={() => setMode("sign")}>{t("common.back")}</button>
                  <button className="btn-primary flex-1 text-red-600 disabled:opacity-60" disabled={busy || !reason.trim()}
                    onClick={() => run(() => contractExternalApi.decline(token, reason.trim()), t("contracts.signature.decisionRecorded"))}>{t("contracts.signature.decline")}</button>
                </div>
              </div>
            )}

            {mode === "changes" && (
              <div className="space-y-3">
                <textarea className="form-input h-24 resize-none" placeholder={t("contracts.signature.changesPlaceholder")} value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1" onClick={() => setMode("sign")}>{t("common.back")}</button>
                  <button className="btn-primary flex-1 disabled:opacity-60" disabled={busy || !reason.trim()}
                    onClick={() => run(() => contractExternalApi.requestChanges(token, reason.trim()), t("contracts.signature.changesSubmitted"))}>{t("common.submit")}</button>
                </div>
              </div>
            )}
          </>
        )}

        {mode === "done" && (
          <div className="text-center space-y-3 py-6">
            <span className="material-symbols-outlined text-5xl text-green-600">check_circle</span>
            <p className="text-sm text-neutral-700">{result}</p>
          </div>
        )}
      </div>
    </div>
  );
}
