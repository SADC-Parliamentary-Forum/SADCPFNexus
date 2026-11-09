"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { programmeApi } from "@/lib/api";
import { PIF_STRATEGIC_PILLARS, DEPARTMENTS } from "@/lib/constants";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { unwrapEntity } from "@/lib/unwrapEntity";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STRATEGIC_PILLARS = [...PIF_STRATEGIC_PILLARS] as string[];
const IMPLEMENTING_DEPARTMENTS = [...DEPARTMENTS] as string[];

// Minimal draft starter — full sections continue on /pif/[id]/edit.
export default function PifCreatePage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [strategicPillar, setStrategicPillar] = useState("");
  const [implementingDepartment, setImplementingDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && !submitting;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t("pif.create.titleRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await programmeApi.create({
        title: title.trim(),
        strategic_pillar: strategicPillar || undefined,
        implementing_department: implementingDepartment || undefined,
      });
      const created = unwrapEntity<{ id?: number }>(res.data);
      const newId = created?.id ?? (res.data as { id?: number }).id;
      if (!newId) {
        throw new Error(t("pif.create.noId"));
      }
      toast.success(t("pif.create.created"), t("pif.create.createdDetail"));
      router.push(`/pif/${newId}/edit`);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string };
      const msg =
        ax.response?.data?.message ??
        (ax.response?.data?.errors && Object.values(ax.response.data.errors).flat()[0]) ??
        (err instanceof Error ? err.message : null) ??
        t("pif.create.createFailed");
      setError(msg);
      toast.error(t("pif.create.notCreated"), msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="pif.create.title"
        subtitle="pif.create.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "pif.common.programmes", href: "/pif" },
              { label: "pif.create.crumb" },
            ]}
          />
        }
      />

      <form onSubmit={handleCreate}>
        <FormSection
          title="pif.create.basics"
          description="pif.create.basicsHint"
          icon="account_tree"
        >
          <div className="space-y-5">
            <FormField label="pif.create.programmeTitle" required>
              <input
                className="form-input"
                placeholder={t("pif.create.titlePlaceholder")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="pif.create.strategicPillar">
                <select
                  className="form-input"
                  value={strategicPillar}
                  onChange={(e) => setStrategicPillar(e.target.value)}
                >
                  <option value="">{t("pif.create.selectLater")}</option>
                  {STRATEGIC_PILLARS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="pif.create.implementingDepartment">
                <select
                  className="form-input"
                  value={implementingDepartment}
                  onChange={(e) => setImplementingDepartment(e.target.value)}
                >
                  <option value="">{t("pif.create.selectLater")}</option>
                  {IMPLEMENTING_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary disabled:opacity-50"
              >
                {submitting ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                )}
                {submitting ? t("pif.create.creating") : t("pif.create.submit")}
              </button>
              <Link href="/pif" className="btn-secondary">
                {t("common.cancel")}
              </Link>
            </div>
          </div>
        </FormSection>
      </form>
    </div>
  );
}
