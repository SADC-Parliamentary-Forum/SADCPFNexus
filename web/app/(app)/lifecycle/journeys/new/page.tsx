"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { lifecycleApi, tenantUsersApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/** Journey types; `label` and `start` are catalog keys translated where they render. */
const TYPES = [
  { value: "transfer", label: "lifecycle.journeyNew.type.transfer", start: "lifecycle.journeyNew.start.transfer", code: "transfer-internal" },
  { value: "promotion", label: "lifecycle.journeyNew.type.promotion", start: "lifecycle.journeyNew.start.promotion", code: "promotion" },
  { value: "probation", label: "lifecycle.journeyNew.type.probation", start: "lifecycle.journeyNew.start.probation", code: "probation-review" },
] as const;

function JourneyCreateForm() {
  const { t } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const initial = TYPES.some((opt) => opt.value === search.get("type")) ? (search.get("type") as string) : "transfer";
  const [lifecycleType, setLifecycleType] = useState(initial);
  const [employeeId, setEmployeeId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["tenant-users"],
    queryFn: async () => (await tenantUsersApi.list()).data.data ?? [],
  });

  const selected = TYPES.find((opt) => opt.value === lifecycleType) ?? TYPES[0];

  const create = useMutation({
    mutationFn: () =>
      lifecycleApi.initiateJourney({
        lifecycle_type: selected.value,
        employee_id: Number(employeeId),
        template_code: selected.code,
      }),
    onSuccess: (res) => {
      const id = (res.data as { data?: { id?: number } }).data?.id;
      if (id) router.push(`/lifecycle/cases/${id}`);
    },
    onError: () => setErr(t("lifecycle.journeyNew.failed")),
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("lifecycle.journeyNew.title")}
        subtitle={t("lifecycle.journeyNew.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("lifecycle.common.breadcrumb"), href: "/lifecycle" },
              { label: t("lifecycle.journeys.start") },
            ]}
          />
        }
      />

      <FormSection title={t("lifecycle.journeyNew.caseDetails")}>
        <div className="space-y-4">
          <FormField label={t("lifecycle.journeys.typeLabel")} htmlFor="lifecycle-journey-type">
            <select
              id="lifecycle-journey-type"
              className="input w-full"
              value={lifecycleType}
              onChange={(e) => setLifecycleType(e.target.value)}
            >
              {TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {t(type.label)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t("lifecycle.common.employee")} htmlFor="lifecycle-journey-employee">
            <select
              id="lifecycle-journey-employee"
              className="input w-full"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">{t("lifecycle.common.selectEmployee")}</option>
              {(usersQuery.data ?? []).map((u: { id: number; name: string }) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </FormField>

          {err ? <p className="text-sm text-red-600">{err}</p> : null}

          <button
            type="button"
            className="btn-primary"
            disabled={!employeeId || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? t("lifecycle.common.starting") : t(selected.start)}
          </button>
        </div>
      </FormSection>
    </div>
  );
}

export default function LifecycleJourneyCreatePage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<p className="p-6 text-sm text-neutral-500">{t("common.loading")}</p>}>
      <JourneyCreateForm />
    </Suspense>
  );
}
