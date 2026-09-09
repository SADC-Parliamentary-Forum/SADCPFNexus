"use client";

import { useState } from "react";
import { riskApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function RiskControlsPage() {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createControl(e: React.FormEvent) {
    e.preventDefault();
    const controlTitle = title.trim();
    if (!controlTitle || creating) return;

    setError(null);
    setOk(null);
    setCreating(true);
    try {
      await riskApi.createControl({ title: controlTitle, control_type: "preventive", effectiveness: "partial" });
      setTitle("");
      setOk(t("risk.controls.created"));
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? t("risk.controls.createFailed"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="risk.controls.title"
        subtitle="risk.controls.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "risk.hub", href: "/risk" }, { label: "risk.controls.title" }]} />}
      />
      <form onSubmit={createControl} className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="risk-control-title" className="text-sm font-medium">{t("risk.controls.newTitle")}</label>
          <input
            id="risk-control-title"
            className="form-input w-full mt-1 disabled:opacity-60"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={creating}
            required
          />
        </div>
        <button type="submit" className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed" disabled={creating || !title.trim()}>
          {creating ? "Adding..." : t("risk.controls.add")}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-green-700">{ok}</p>}
    </div>
  );
}
