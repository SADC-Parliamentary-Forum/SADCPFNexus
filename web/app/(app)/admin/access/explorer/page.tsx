"use client";

import { useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { ObjectSummary } from "@/components/ui/ObjectSummary";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function PermissionExplorerPage() {
  const { t } = useI18n();
  const [permission, setPermission] = useState("leave.request.authorise.assigned");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await api.get<{ data: Record<string, unknown> }>("/admin/access/explore", {
        params: { permission },
      });
      setResult(res.data.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("admin.access.explorer.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("admin.access.explorer.title")}
        subtitle={t("admin.access.explorer.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("admin.homeLabel"), href: "/admin" },
              { label: t("admin.crumb.access"), href: "/admin/access" },
              { label: t("admin.access.explorer.crumb") },
            ]}
          />
        }
      />

      <FormSection title={t("admin.access.explorer.section")} icon="manage_search" dense>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={t("admin.access.explorer.permissionKey")} htmlFor="perm-key" required className="min-w-[280px] flex-1">
            <input
              id="perm-key"
              className="form-input"
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
            />
          </FormField>
          <button type="button" className="btn-primary text-sm" onClick={run} disabled={busy || !permission}>
            {busy ? t("admin.access.explorer.exploring") : t("admin.access.explorer.explore")}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </FormSection>

      {result ? (
        <FormSection title={t("admin.access.explorer.result")} icon="fact_check">
          <ObjectSummary value={result} />
        </FormSection>
      ) : null}
    </div>
  );
}
