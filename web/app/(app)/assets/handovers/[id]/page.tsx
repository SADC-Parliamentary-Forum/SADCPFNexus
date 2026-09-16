"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { assetsApi, type AssetHandover, type AssetHandoverLine } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { canManageHandovers, getStoredUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const RESPONSES: Array<{ value: string; key: string }> = [
  { value: "received", key: "assets.handover.received" },
  { value: "not_received", key: "assets.handover.notReceived" },
  { value: "incorrect_asset", key: "assets.handover.incorrectAsset" },
  { value: "condition_different", key: "assets.handover.conditionDifferent" },
  { value: "accessories_missing", key: "assets.handover.accessoriesMissing" },
];

export default function HandoverDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const [handover, setHandover] = useState<AssetHandover | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | "sign" | "paper" | null>(null);
  const [error, setError] = useState("");
  const [paperNumber, setPaperNumber] = useState("");
  const me = getStoredUser();

  const load = useCallback(async () => {
    const r = await assetsApi.getHandover(numericId);
    setHandover(r.data.data);
  }, [numericId]);

  useEffect(() => {
    load().catch(() => setError(t("assets.loadFailed")));
  }, [load, t]);

  async function respond(line: AssetHandoverLine, response: string) {
    setBusy(line.id);
    setError("");
    try {
      await assetsApi.respondHandoverLine(numericId, line.id, {
        response,
        dispute_notes: notes[line.id] || undefined,
        condition_in: response === "condition_different" ? "poor" : undefined,
      });
      await load();
    } catch {
      setError(t("assets.mine.actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function sign() {
    setBusy("sign");
    setError("");
    try {
      await assetsApi.signHandover(numericId, { auth_level: "password" });
      await load();
    } catch {
      setError(t("assets.mine.actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  async function paperSign() {
    if (!paperNumber.trim()) return;
    setBusy("paper");
    setError("");
    try {
      await assetsApi.paperSignHandover(numericId, { paper_receipt_number: paperNumber.trim() });
      await load();
    } catch {
      setError(t("assets.mine.actionFailed"));
    } finally {
      setBusy(null);
    }
  }

  const canRespond = handover && (me?.id === handover.to_user_id || me?.id === handover.delegate_user_id || handover.status === "return_initiated");
  const canPaper = handover && canManageHandovers(me);
  const awaiting = handover && ["awaiting_acceptance", "partially_accepted", "return_initiated"].includes(handover.status);

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={handover?.reference ?? "assets.handover.title"}
        subtitle="assets.handover.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ href: "/assets/handovers", label: t("assets.handover.title") }, { label: handover?.reference ?? "" }]} />}
      />
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {handover && (
        <>
          <p className="text-sm"><strong>{t("assets.handover.owner")}:</strong> {handover.owner || t("assets.handover.ownerValue")}</p>
          <p className="text-sm">{handover.type} · {handover.status} · {handover.to_user?.name ?? handover.custody_target_type}</p>
          {handover.delegate_user ? <p className="text-sm">{t("assets.handover.delegate")}: {handover.delegate_user.name}</p> : null}
          {handover.paper_receipt_number ? <p className="text-sm">{t("assets.handover.paperNumber")}: {handover.paper_receipt_number}</p> : null}
          <p className="text-sm text-neutral-600">{t("assets.handover.partialHint")}</p>
          <div className="space-y-3">
            {(handover.lines ?? []).map((line) => (
              <div key={line.id} className="card p-4 space-y-2" data-testid={`handover-line-${line.id}`}>
                <p className="font-mono text-xs">{line.snapshot_tag} — {line.snapshot_name}</p>
                <p className="text-xs">{t("assets.view.fieldCustody")}: {line.line_status} · {line.condition_out}</p>
                {canRespond && awaiting && line.line_status === "pending" && (
                  <div className="flex flex-wrap gap-2">
                    {RESPONSES.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={busy === line.id}
                        data-testid={`handover-respond-${opt.value}`}
                        onClick={() => void respond(line, opt.value)}
                      >
                        {t(opt.key)}
                      </button>
                    ))}
                    <input
                      className="form-input text-xs"
                      placeholder={t("assets.handover.disputeNotes")}
                      value={notes[line.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [line.id]: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          {handover.declaration && (
            <blockquote className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
              <p className="text-xs font-semibold">{t("assets.handover.declaration")} {handover.declaration.version_key}</p>
              <p className="mt-2">{handover.declaration.statement}</p>
            </blockquote>
          )}
          {canRespond && awaiting && (
            <button type="button" className="btn-primary" disabled={busy === "sign"} onClick={() => void sign()} data-testid="handover-sign">
              {busy === "sign" ? t("common.loading") : t("assets.handover.sign")}
            </button>
          )}
          {canPaper && awaiting && (
            <div className="flex flex-wrap gap-2">
              <input
                className="form-input"
                value={paperNumber}
                onChange={(e) => setPaperNumber(e.target.value)}
                placeholder={t("assets.handover.paperNumber")}
                data-testid="handover-paper-number"
              />
              <button type="button" className="btn-secondary" disabled={busy === "paper" || !paperNumber.trim()} onClick={() => void paperSign()} data-testid="handover-paper-sign">
                {t("assets.handover.paperSign")}
              </button>
            </div>
          )}
          {handover.status === "accepted" || handover.status === "partially_accepted" || handover.status === "return_verified" ? (
            <a className="btn-secondary inline-block" href={assetsApi.handoverCertificateUrl(handover.id)}>{t("assets.handover.certificate")}</a>
          ) : null}
        </>
      )}
    </div>
  );
}
