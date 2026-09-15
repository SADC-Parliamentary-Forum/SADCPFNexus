"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { numberingProfilesApi } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function NumberingProfilesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, ["procurement.admin", "procurement.sequence.manage"]);
  const [legacy, setLegacy] = useState("");
  const [reason, setReason] = useState("");
  const [nextSeq, setNextSeq] = useState("");
  const [nextReason, setNextReason] = useState("");
  const [parsed, setParsed] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["numbering-profiles"],
    queryFn: () => numberingProfilesApi.show().then((r) => r.data.data),
    enabled: canAdmin,
  });

  const parseMut = useMutation({
    mutationFn: () => numberingProfilesApi.parse(legacy.trim()),
    onSuccess: (res) => setParsed(res.data.data.next_example),
  });

  const activateMut = useMutation({
    mutationFn: () => numberingProfilesApi.activate({ last_existing_reference: legacy.trim(), reason: reason.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["numbering-profiles"] });
      qc.invalidateQueries({ queryKey: ["procurement", "lpo-sequence"] });
      setMessage(t("po.numbering.activated"));
    },
  });

  const nextMut = useMutation({
    mutationFn: () => numberingProfilesApi.setNext(Number(nextSeq), nextReason.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["numbering-profiles"] });
      setMessage(t("po.numbering.nextUpdated"));
    },
  });

  if (!canAdmin) {
    return <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 max-w-xl">{t("po.templates.needAdmin")}</div>;
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="po.numbering.title"
        subtitle="po.numbering.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "po.settings.hub", href: "/procurement/settings" },
              { label: "po.numbering.title" },
            ]}
          />
        }
      />
      {message && <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">{message}</p>}
      <div className="card p-5 space-y-4">
        {data && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-neutral-500">{t("po.numbering.status")}</dt><dd className="font-medium">{data.status}</dd></div>
            <div><dt className="text-xs text-neutral-500">{t("po.numbering.pattern")}</dt><dd className="font-mono">{data.pattern}</dd></div>
            <div><dt className="text-xs text-neutral-500">{t("po.numbering.next")}</dt><dd className="font-mono" data-testid="numbering-next">{data.next_example}</dd></div>
            <div><dt className="text-xs text-neutral-500">{t("po.numbering.current")}</dt><dd className="font-mono">{data.current_value}</dd></div>
          </dl>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="form-input" data-testid="numbering-legacy" placeholder={t("po.numbering.legacyPlaceholder")} value={legacy} onChange={(e) => setLegacy(e.target.value)} />
          <input className="form-input" placeholder={t("common.reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-sm" disabled={!legacy.trim() || parseMut.isPending} onClick={() => parseMut.mutate()}>{t("po.numbering.parse")}</button>
          <button type="button" className="btn-primary text-sm" data-testid="numbering-activate" disabled={!legacy.trim() || reason.trim().length < 3 || activateMut.isPending} onClick={() => activateMut.mutate()}>{t("po.numbering.activate")}</button>
        </div>
        {parsed && <p className="text-sm font-mono text-neutral-700" data-testid="numbering-parsed">{t("po.numbering.nextWouldBe", { value: parsed })}</p>}
      </div>
      <div className="card p-5 space-y-3">
        <h2 className="text-base font-semibold">{t("po.numbering.setNext")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="form-input" type="number" min={1} placeholder={t("po.numbering.nextSequence")} value={nextSeq} onChange={(e) => setNextSeq(e.target.value)} />
          <input className="form-input" placeholder={t("common.reason")} value={nextReason} onChange={(e) => setNextReason(e.target.value)} />
        </div>
        <button type="button" className="btn-secondary text-sm" disabled={!nextSeq || nextReason.trim().length < 3 || nextMut.isPending} onClick={() => nextMut.mutate()}>{t("po.numbering.setNext")}</button>
      </div>
    </div>
  );
}
