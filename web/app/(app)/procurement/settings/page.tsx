"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  policyProfilesApi,
  procurementSettingsApi,
  procurementWorkbenchApi,
  type ProcurementPolicyProfile,
  type ProcurementSettings,
} from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

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
  const qc = useQueryClient();
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
      setSavedMsg("Settings saved.");
      setTimeout(() => setSavedMsg(null), 2500);
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
      setSavedMsg("Policy profile created.");
      setTimeout(() => setSavedMsg(null), 2500);
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
      setSavedMsg("LPO sequence activated. Subsequent edits require a privileged reason.");
      setTimeout(() => setSavedMsg(null), 2500);
    },
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => policyProfilesApi.activate(id),
    onSuccess: (res) => {
      qc.setQueryData(["procurement", "settings"], res.data.data);
      setForm(res.data.data);
      qc.invalidateQueries({ queryKey: ["procurement", "policy-profiles"] });
      setSavedMsg("Policy profile activated.");
      setTimeout(() => setSavedMsg(null), 2500);
    },
  });

  if (!canAdmin) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 max-w-xl">
        You need <code className="font-mono">procurement.admin</code> to change procurement thresholds.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <ModulePageHeader
        title="Procurement Settings"
        subtitle="Thresholds, multi-donor policy profiles, and optional AI comparison assist (never auto-awards)."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Procurement Settings" }]} />}
      />

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {(error as { response?: { data?: { message?: string }; status?: number } })?.response?.status === 404
            ? "This organisation's settings could not be read. Apply pending database migrations, then reload."
            : ((error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to load settings.")}
        </div>
      )}

      {isLoading || !form ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
      ) : (
        <>
          <div className="card p-5 space-y-5">
            {savedMsg && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">{savedMsg}</div>
            )}

            {form.has_tenant_override && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                This tenant has custom thresholds active.
              </p>
            )}

            {(
              [
                { key: "direct_purchase_limit", label: "Direct purchase limit (NAD)", help: "Up to this value: approved supplier / direct purchase.", step: 0.01 },
                { key: "quotation_limit", label: "Quotation / RFQ limit (NAD)", help: "Above direct limit up to this value: RFQ with minimum quotes.", step: 0.01 },
                { key: "tender_threshold", label: "Tender threshold (NAD)", help: "At or above this value: open tender required.", step: 0.01 },
                { key: "minimum_quotes_required", label: "Minimum quotes required", help: "For RFQ-method purchases above the direct limit.", step: 1 },
                { key: "split_lookback_days", label: "Split lookback (days)", help: "Window for anti-split purchase detection on submit.", step: 1 },
              ] as const
            ).map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">{field.label}</label>
                <input
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
                <p className="text-xs text-neutral-500 mt-1">{field.help}</p>
              </div>
            ))}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Split enforcement</label>
              <select
                className="form-input max-w-[240px]"
                value={form.split_enforcement ?? "hard"}
                onChange={(e) => setForm({ ...form, split_enforcement: e.target.value as "soft" | "hard" })}
              >
                <option value="hard">Hard — require Finance/SG authorisation</option>
                <option value="soft">Soft — justification text only</option>
              </select>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 space-y-2">
              <label className="flex items-start gap-2 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!form.ai_comparison_enabled}
                  onChange={(e) => setForm({ ...form, ai_comparison_enabled: e.target.checked })}
                />
                <span>
                  <span className="font-semibold">Enable AI comparison summaries</span>
                  <span className="block text-xs text-neutral-500 mt-0.5">
                    Assistive text only (stub provider when no LLM configured). Never auto-awards or auto-recommends.
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
              {saveMut.isPending ? "Saving…" : "Save settings"}
            </button>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">Multi-donor policy profiles</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Active: <code className="font-mono">{form.policy_profile_key ?? "sadc_pf_core"}</code>
                {(form.donor_codes?.length ?? 0) > 0 && (
                  <> · Donors: {(form.donor_codes ?? []).join(", ")}</>
                )}
              </p>
            </div>

            <div className="space-y-2">
              {(profilesQuery.data ?? []).map((p: ProcurementPolicyProfile) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 border border-neutral-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {p.name}{" "}
                      <span className="font-mono text-xs text-neutral-500">{p.key}</span>
                      {p.is_default && <span className="ml-2 text-[10px] uppercase text-neutral-500">default</span>}
                      {form.policy_profile_key === p.key && (
                        <span className="ml-2 text-[10px] uppercase text-green-700">active</span>
                      )}
                    </p>
                    <p className="text-xs text-neutral-500">
                      ≤{p.direct_purchase_limit.toLocaleString()} direct · ≤{p.quotation_limit.toLocaleString()} RFQ · donors:{" "}
                      {(p.donor_codes ?? []).join(", ") || "—"}
                    </p>
                  </div>
                  {form.policy_profile_key !== p.key && p.is_active && (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={activateMut.isPending}
                      onClick={() => activateMut.mutate(p.id)}
                    >
                      Activate
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-neutral-200 pt-4 space-y-3">
              <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Create profile</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className="form-input" placeholder="key (eu_donor)" value={newProfile.key} onChange={(e) => setNewProfile({ ...newProfile, key: e.target.value })} />
                <input className="form-input" placeholder="Name" value={newProfile.name} onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })} />
                <input className="form-input sm:col-span-2" placeholder="Donor codes (comma-separated)" value={newProfile.donor_codes} onChange={(e) => setNewProfile({ ...newProfile, donor_codes: e.target.value })} />
                <input className="form-input" type="number" placeholder="Direct limit" value={newProfile.direct_purchase_limit} onChange={(e) => setNewProfile({ ...newProfile, direct_purchase_limit: parseFloat(e.target.value) || 0 })} />
                <input className="form-input" type="number" placeholder="Quotation limit" value={newProfile.quotation_limit} onChange={(e) => setNewProfile({ ...newProfile, quotation_limit: parseFloat(e.target.value) || 0, tender_threshold: parseFloat(e.target.value) || 0 })} />
              </div>
              <button
                type="button"
                className="btn-secondary text-sm disabled:opacity-50"
                disabled={createProfileMut.isPending || !newProfile.key || !newProfile.name}
                onClick={() => createProfileMut.mutate()}
              >
                {createProfileMut.isPending ? "Creating…" : "Create policy profile"}
              </button>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900">LPO Sequence Setup</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Consecutive <code className="font-mono">S 00000</code> numbers. Confirm the last legacy LPO before Nexus issues the next official number. Do not infer the next number from sample documents.
              </p>
            </div>
            {sequenceQuery.data && (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-neutral-500">Status</dt><dd className="font-medium">{String(sequenceQuery.data.status ?? "missing")}</dd></div>
                <div><dt className="text-xs text-neutral-500">Next example</dt><dd className="font-mono">{String(sequenceQuery.data.next_example ?? "S 00001")}</dd></div>
                <div><dt className="text-xs text-neutral-500">Current value</dt><dd className="font-mono">{String(sequenceQuery.data.current_value ?? 0)}</dd></div>
                <div><dt className="text-xs text-neutral-500">Last legacy</dt><dd className="font-mono">{String(sequenceQuery.data.last_legacy_number ?? "—")}</dd></div>
              </dl>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="form-input"
                type="number"
                min={0}
                placeholder="Last legacy number (e.g. 4015)"
                value={legacyNumber}
                onChange={(e) => setLegacyNumber(e.target.value)}
              />
              <input
                className="form-input"
                placeholder="Reason / confirmation"
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
              {activateSequenceMut.isPending ? "Activating…" : "Confirm sequence"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
