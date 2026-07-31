"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mandeApi, type MeSettings } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

export default function MandeSettingsPage() {
  const qc = useQueryClient();
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "mande.admin");
  const [form, setForm] = useState<MeSettings | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "settings"],
    queryFn: () => mandeApi.getSettings().then((r) => r.data.data as MeSettings),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (payload: MeSettings) => mandeApi.updateSettings(payload),
    onSuccess: (res) => {
      qc.setQueryData(["mande", "settings"], res.data.data);
      setForm(res.data.data);
      setSavedMsg("Settings saved.");
      setTimeout(() => setSavedMsg(null), 2500);
    },
  });

  if (!canAdmin) {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 max-w-xl">
        You need <code className="font-mono">mande.admin</code> to change M&amp;E settings.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <ModulePageHeader
        title="M&E Settings"
        subtitle="Tenant defaults for intake, due dates and programme-manager review."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "M&E Settings" }]} />}
      />

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

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.auto_intake}
              onChange={(e) => setForm({ ...form, auto_intake: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-semibold text-neutral-800">Auto-intake on PIF approve</span>
              <span className="block text-xs text-neutral-500">
                When enabled, approving a PIF creates one M&amp;E activity report shell (idempotent).
              </span>
            </span>
          </label>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Report due days</label>
            <input
              type="number"
              min={1}
              max={365}
              className="form-input max-w-[140px]"
              value={form.report_due_days}
              onChange={(e) => setForm({ ...form, report_due_days: Number(e.target.value) || 14 })}
            />
            <p className="text-xs text-neutral-500 mt-1">Days after activity end date before a report is overdue.</p>
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.programme_manager_review}
              onChange={(e) => setForm({ ...form, programme_manager_review: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-semibold text-neutral-800">Programme manager review</span>
              <span className="block text-xs text-neutral-500">
                When enabled, reports may require programme-manager review before M&amp;E (full PM queue UX in Phase 2).
              </span>
            </span>
          </label>

          {saveMut.isError && (
            <p className="text-sm text-red-600">Could not save settings.</p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary disabled:opacity-40"
              disabled={saveMut.isPending || form.report_due_days < 1}
              onClick={() => saveMut.mutate(form)}
            >
              {saveMut.isPending ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
