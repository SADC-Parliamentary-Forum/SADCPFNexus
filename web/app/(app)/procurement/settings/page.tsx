"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { procurementSettingsApi, type ProcurementSettings } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

export default function ProcurementSettingsPage() {
  const qc = useQueryClient();
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "procurement.admin");
  const [form, setForm] = useState<ProcurementSettings | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["procurement", "settings"],
    queryFn: () => procurementSettingsApi.get().then((r) => r.data.data),
    staleTime: 30_000,
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

  if (!canAdmin) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 max-w-xl">
        You need <code className="font-mono">procurement.admin</code> to change procurement thresholds.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="page-title">Procurement Settings</h1>
        <p className="page-subtitle">
          Tenant threshold overrides. Effective values fall back to system defaults when not set.
        </p>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load settings.
        </div>
      )}

      {isLoading || !form ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
      ) : (
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
              { key: "direct_purchase_limit", label: "Direct purchase limit (NAD)", help: "Up to this value: approved supplier / direct purchase." },
              { key: "quotation_limit", label: "Quotation / RFQ limit (NAD)", help: "Above direct limit up to this value: RFQ with minimum quotes." },
              { key: "tender_threshold", label: "Tender threshold (NAD)", help: "At or above this value: open tender required." },
              { key: "minimum_quotes_required", label: "Minimum quotes required", help: "For RFQ-method purchases above the direct limit.", step: 1 },
              { key: "split_lookback_days", label: "Split lookback (days)", help: "Window for anti-split purchase detection on submit.", step: 1 },
            ] as const
          ).map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">{field.label}</label>
              <input
                type="number"
                min={0}
                step={field.step ?? 0.01}
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
              })
            }
          >
            {saveMut.isPending ? "Saving…" : "Save settings"}
          </button>
        </div>
      )}
    </div>
  );
}
