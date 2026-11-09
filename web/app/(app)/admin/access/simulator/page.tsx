"use client";

import { useEffect, useState } from "react";
import api, { adminApi, type User } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { ObjectSummary } from "@/components/ui/ObjectSummary";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function userLabel(user: User): string {
  const name = user.name?.trim();
  const email = user.email?.trim();
  if (name && email) return `${name} (${email})`;
  return name || email || String(user.id);
}

export default function AccessSimulatorPage() {
  const { t } = useI18n();
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi
      .listUsers({ per_page: 100 })
      .then((res) => setUsers(res.data.data ?? []))
      .catch(() => setUsers([]));
  }, []);

  const run = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await api.post<{ data: Record<string, unknown> }>(`/admin/access/users/${userId}/simulate`);
      setResult(res.data.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("workflows.simulate.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="admin.access.links.simulator"
        subtitle="admin.accessSimulator.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "admin.homeLabel", href: "/admin" },
              { label: "admin.crumb.access", href: "/admin/access" },
              { label: "admin.accessSimulator.crumb" },
            ]}
          />
        }
      />

      <FormSection title="admin.accessSimulator.section" description="admin.accessSimulator.sectionHint" icon="science" dense>
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={t("admin.simulator.user")} htmlFor="sim-user-select" required className="min-w-[16rem] flex-1">
            <select
              id="sim-user-select"
              className="form-input"
              value={userId}
              data-testid="sim-user-select"
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">{t("pickers.none")}</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {userLabel(user)}
                </option>
              ))}
            </select>
          </FormField>
          <button type="button" className="btn-primary text-sm" onClick={run} disabled={!userId || busy}>
            {busy ? t("people.m365.running") : t("admin.accessSimulator.run")}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </FormSection>

      {result ? (
        <FormSection title="admin.accessSimulator.result" icon="fact_check">
          <ObjectSummary value={result} />
        </FormSection>
      ) : null}
    </div>
  );
}
