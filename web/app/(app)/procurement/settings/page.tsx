"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  policyProfilesApi,
  procurementSettingsApi,
  procurementWorkbenchApi,
  type ProcurementPolicyProfile,
  type ProcurementSettings,
} from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { SupplierDocumentRequirementTypesCard } from "@/components/procurement/SupplierDocumentRequirementTypesCard";
import { SupplierCategoriesHierarchyCard } from "@/components/procurement/SupplierCategoriesHierarchyCard";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";

/** Replaces {name} placeholders in translated copy with React nodes. */
function richText(template: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const name = part.startsWith("{") && part.endsWith("}") ? part.slice(1, -1) : null;
    return <Fragment key={i}>{name && name in nodes ? nodes[name] : part}</Fragment>;
  });
}

const emptyProfile = {
  key: "",
  name: "",
  description: "",
  donor_codes: "",
  direct_purchase_limit: 10000,
  quotation_limit: 100000,
  tender_threshold: 100000,
  minimum_quotes_required: 3,
  split_lookback_days: 30,
  split_enforcement: "hard" as const,
};

export default function ProcurementSettingsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "procurement.admin");
  const [form, setForm] = useState<ProcurementSettings | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [newProfile, setNewProfile] = useState(emptyProfile);
  const [legacyNumber, setLegacyNumber] = useState("");
  const [sequenceReason, setSequenceReason] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["procurement", "settings"],
    queryFn: () => procurementSettingsApi.get().then((r) => r.data.data),
    staleTime: 30_000,
  });

  const profilesQuery = useQuery({
    queryKey: ["procurement", "policy-profiles"],
    queryFn: () => policyProfilesApi.list().then((r) => r.data.data),
    enabled: canAdmin,
  });

  useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (payload: Partial<ProcurementSettings>) => procurementSettingsApi.update(payload),
    onSuccess: (res) => {
      qc.setQueryData(["procurement", "settings"], res.data.data);
      setForm(res.data.data);
      setSavedMsg(t("admin.settings.saved"));
      setTimeout(() => setSavedMsg(null), 2500);
      toast.success(t("po.settingsPage.saved"));
    },
    onError: (err: unknown) => {
      toast.error(t("mande.settings.notSaved"), apiErrorMessage(err, t("po.settingsPage.saveFailed")));
    },
  });

  const createProfileMut = useMutation({
    mutationFn: () =>
      policyProfilesApi.create({
        key: newProfile.key.trim(),
        name: newProfile.name.trim(),
        description: newProfile.description || null,
        donor_codes: newProfile.donor_codes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        direct_purchase_limit: newProfile.direct_purchase_limit,
        quotation_limit: newProfile.quotation_limit,
        tender_threshold: newProfile.tender_threshold,
        minimum_quotes_required: newProfile.minimum_quotes_required,
        split_lookback_days: newProfile.split_lookback_days,
        split_enforcement: newProfile.split_enforcement,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procurement", "policy-profiles"] });
      setNewProfile(emptyProfile);
      setSavedMsg(t("po.settingsPage.profileCreatedMsg"));
      setTimeout(() => setSavedMsg(null), 2500);
      toast.success(t("po.settingsPage.profileCreated"));
    },
    onError: (err: unknown) => {
      toast.error(t("po.settingsPage.profileNotCreated"), apiErrorMessage(err, t("po.settingsPage.profileCreateFailed")));
    },
  });

  const sequenceQuery = useQuery({
    queryKey: ["procurement", "lpo-sequence"],
    queryFn: () => procurementWorkbenchApi.sequence().then((r) => r.data.data),
    enabled: canAdmin,
  });

  const activateSequenceMut = useMutation({
    mutationFn: () =>
      procurementWorkbenchApi.activateSequence(Number(legacyNumber), sequenceReason.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procurement", "lpo-sequence"] });
      setSavedMsg(t("po.settingsPage.sequenceActivatedMsg"));
      setTimeout(() => setSavedMsg(null), 2500);
      toast.success(t("po.settingsPage.sequenceActivated"));
    },
    onError: (err: unknown) => {
      toast.error(t("po.settingsPage.sequenceNotActivated"), apiErrorMessage(err, t("po.settingsPage.sequenceFailed")));
    },
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => policyProfilesApi.activate(id),
    onSuccess: (res) => {
      qc.setQueryData(["procurement", "settings"], res.data.data);
      setForm(res.data.data);
      qc.invalidateQueries({ queryKey: ["procurement", "policy-profiles"] });
      setSavedMsg(t("po.settingsPage.profileActivatedMsg"));
      setTimeout(() => setSavedMsg(null), 2500);
      toast.success(t("po.settingsPage.profileActivated"));
    },
    onError: (err: unknown) => {
      toast.error(t("po.settingsPage.profileNotActivated"), apiErrorMessage(err, t("po.settingsPage.profileActivateFailed")));
    },
  });

  if (!canAdmin) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 max-w-xl">
        {richText(t("po.settingsPage.needAdmin"), { permission: <code className="font-mono">{"procurement.admin"}</code> })}
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="po.settings.hub"
        subtitle="po.settingsPage.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "po.settings.hub" }]} />}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/procurement/settings/po-templates" className="card p-4 hover:border-primary/40 transition-colors" data-testid="settings-po-templates">
          <p className="text-sm font-semibold text-neutral-900">{t("po.settings.templatesCard")}</p>
          <p className="text-xs text-neutral-500 mt-1">{t("po.settings.templatesHelp")}</p>
        </Link>
        <Link href="/procurement/settings/numbering" className="card p-4 hover:border-primary/40 transition-colors" data-testid="settings-numbering">
          <p className="text-sm font-semibold text-neutral-900">{t("po.settings.numberingCard")}</p>
          <p className="text-xs text-neutral-500 mt-1">{t("po.settings.numberingHelp")}</p>
        </Link>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {(error as { response?: { data?: { message?: string }; status?: number } })?.response?.status === 404
            ? t("po.settingsPage.loadMissing")
            : ((error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("mande.settings.loadFailed"))}
        </div>
      )}

      {isLoading || !form ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
      ) : (
        <>
          <div className="card p-5 space-y-5">
            {savedMsg && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">{savedMsg}</div>
            )}

            {form.has_tenant_override && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {t("po.settingsPage.tenantOverride")}
              </p>
            )}

            {(
              [
                { key: "direct_purchase_limit", label: "po.settingsPage.directLimit", help: "po.settingsPage.directLimitHelp", step: 0.01 },
                { key: "quotation_limit", label: "po.settingsPage.quotationLimit", help: "po.settingsPage.quotationLimitHelp", step: 0.01 },
                { key: "tender_threshold", label: "po.settingsPage.tenderThreshold", help: "po.settingsPage.tenderThresholdHelp", step: 0.01 },
                { key: "minimum_quotes_required", label: "po.settingsPage.minQuotes", help: "po.settingsPage.minQuotesHelp", step: 1 },
                { key: "split_lookback_days", label: "po.settingsPage.splitLookback", help: "po.settingsPage.splitLookbackHelp", step: 1 },
              ] as const
            ).map((field) => (
              <div key={field.key}>
                <label htmlFor="procurement-settings-field" className="block text-xs font-semibold text-neutral-700 mb-1">{t(field.label)}</label>
                <input id="procurement-settings-field"
                  type="number"
                  min={0}
                  step={field.step}
                  className="form-input max-w-[200px]"
                  value={form[field.key]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      [field.key]: field.step === 1 ? Number(e.target.value) || 0 : parseFloat(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-neutral-500 mt-1">{t(field.help)}</p>
              </div>
            ))}

            <div>
              <label htmlFor="procurement-settings-split-enforcement" className="block text-xs font-semibold text-neutral-700 mb-1">{t("po.settingsPage.splitEnforcement")}</label>
              <select id="procurement-settings-split-enforcement"
                className="form-input max-w-[240px]"
                value={form.split_enforcement ?? "hard"}
                onChange={(e) => setForm({ ...form, split_enforcement: e.target.value as "soft" | "hard" })}
              >
                <option value="hard">{t("po.settingsPage.splitHard")}</option>
                <option value="soft">{t("po.settingsPage.splitSoft")}</option>
              </select>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 space-y-2">
              <label htmlFor="procurement-settings-setform-enable-ai-comparison-summaries-assistive" className="flex items-start gap-2 text-sm text-neutral-800">
                <input id="procurement-settings-setform-enable-ai-comparison-summaries-assistive"
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!form.ai_comparison_enabled}
                  onChange={(e) => setForm({ ...form, ai_comparison_enabled: e.target.checked })}
                />
                <span>
                  <span className="font-semibold">{t("po.settingsPage.aiEnable")}</span>
                  <span className="block text-xs text-neutral-500 mt-0.5">
                    {t("po.settingsPage.aiHelp")}
                  </span>
                </span>
              </label>
            </div>

            <button
              type="button"
              className="btn-primary disabled:opacity-50"
              disabled={saveMut.isPending}
              onClick={() =>
                saveMut.mutate({
                  direct_purchase_limit: form.direct_purchase_limit,
                  quotation_limit: form.quotation_limit,
                  tender_threshold: form.tender_threshold,
                  minimum_quotes_required: form.minimum_quotes_required,
                  split_lookback_days: form.split_lookback_days,
                  split_enforcement: form.split_enforcement ?? "hard",
                  ai_comparison_enabled: !!form.ai_comparison_enabled,
                })
              }
            >
              {saveMut.isPending ? t("stock.common.saving") : t("correspondence.mailbox.saveSettings")}
            </button>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">{t("po.settingsPage.profilesTitle")}</h2>
              <p className="text-xs text-neutral-500 mt-1">
                {richText(t("po.settingsPage.activeProfile"), { key: <code className="font-mono">{form.policy_profile_key ?? "sadc_pf_core"}</code> })}
                {(form.donor_codes?.length ?? 0) > 0 && t("po.settingsPage.donors", { donors: (form.donor_codes ?? []).join(", ") })}
              </p>
            </div>

            <div className="space-y-2">
              {(profilesQuery.data ?? []).map((p: ProcurementPolicyProfile) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border border-neutral-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {p.name}{" "}
                      <span className="font-mono text-xs text-neutral-500">{p.key}</span>
                      {p.is_default && <span className="ml-2 text-[10px] uppercase text-neutral-500">{t("po.settingsPage.defaultBadge")}</span>}
                      {form.policy_profile_key === p.key && (
                        <span className="ml-2 text-[10px] uppercase text-green-700">{t("po.settingsPage.activeBadge")}</span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {t("po.settingsPage.profileSummary", {
                        direct: p.direct_purchase_limit.toLocaleString(),
                        quotation: p.quotation_limit.toLocaleString(),
                        donors: (p.donor_codes ?? []).join(", ") || "—",
                      })}
                    </p>
                  </div>
                  {form.policy_profile_key !== p.key && p.is_active && (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={activateMut.isPending}
                      onClick={() => activateMut.mutate(p.id)}
                    >
                      {t("audit.external.activate")}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-neutral-200 pt-4 space-y-3">
              <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">{t("po.settingsPage.createProfile")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className="form-input" placeholder={t("po.settingsPage.keyPlaceholder")} value={newProfile.key} onChange={(e) => setNewProfile({ ...newProfile, key: e.target.value })} />
                <input className="form-input" placeholder={t("stock.common.name")} value={newProfile.name} onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })} />
                <input className="form-input sm:col-span-2" placeholder={t("po.settingsPage.donorCodes")} value={newProfile.donor_codes} onChange={(e) => setNewProfile({ ...newProfile, donor_codes: e.target.value })} />
                <input className="form-input" type="number" placeholder={t("po.settingsPage.directLimitPlaceholder")} value={newProfile.direct_purchase_limit} onChange={(e) => setNewProfile({ ...newProfile, direct_purchase_limit: parseFloat(e.target.value) || 0 })} />
                <input className="form-input" type="number" placeholder={t("po.settingsPage.quotationLimitPlaceholder")} value={newProfile.quotation_limit} onChange={(e) => setNewProfile({ ...newProfile, quotation_limit: parseFloat(e.target.value) || 0, tender_threshold: parseFloat(e.target.value) || 0 })} />
              </div>
              <button
                type="button"
                className="btn-secondary text-sm disabled:opacity-50"
                disabled={createProfileMut.isPending || !newProfile.key || !newProfile.name}
                onClick={() => createProfileMut.mutate()}
              >
                {createProfileMut.isPending ? t("audit.campaigns.creating") : t("po.settingsPage.createPolicyProfile")}
              </button>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">{t("po.settingsPage.sequenceTitle")}</h2>
              <p className="text-xs text-neutral-500 mt-1">
                {richText(t("po.settingsPage.sequenceIntro"), {
                  legacy: <strong>{t("po.settingsPage.legacyStrong")}</strong>,
                  pattern: <code className="font-mono">S #####</code>,
                  draft: <code className="font-mono">{"PROC-DRAFT-*"}</code>,
                })}
              </p>
            </div>
            {sequenceQuery.data && (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-neutral-500">{t("stock.common.status")}</dt><dd className="font-medium">{String(sequenceQuery.data.status ?? "missing")}</dd></div>
                <div><dt className="text-xs text-neutral-500">{t("po.numbering.next")}</dt><dd className="font-mono">{String(sequenceQuery.data.next_example ?? "S 00001")}</dd></div>
                <div><dt className="text-xs text-neutral-500">{t("po.numbering.current")}</dt><dd className="font-mono">{String(sequenceQuery.data.current_value ?? 0)}</dd></div>
                <div><dt className="text-xs text-neutral-500">{t("po.settingsPage.lastLegacy")}</dt><dd className="font-mono">{String(sequenceQuery.data.last_legacy_number ?? "—")}</dd></div>
              </dl>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="form-input"
                type="number"
                min={0}
                placeholder={t("po.settingsPage.legacyPlaceholder")}
                value={legacyNumber}
                onChange={(e) => setLegacyNumber(e.target.value)}
              />
              <input
                className="form-input"
                placeholder={t("po.settingsPage.reasonPlaceholder")}
                value={sequenceReason}
                onChange={(e) => setSequenceReason(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-secondary text-sm disabled:opacity-50"
              disabled={activateSequenceMut.isPending || legacyNumber === "" || sequenceReason.trim().length < 3}
              onClick={() => activateSequenceMut.mutate()}
            >
              {activateSequenceMut.isPending ? t("admin.notifications.activating") : t("po.settingsPage.confirmSequence")}
            </button>
          </div>

          <SupplierDocumentRequirementTypesCard />
          <SupplierCategoriesHierarchyCard />
        </>
      )}
    </div>
  );
}
