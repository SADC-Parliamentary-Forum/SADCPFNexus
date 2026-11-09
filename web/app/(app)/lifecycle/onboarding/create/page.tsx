"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { lifecycleApi, tenantUsersApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { FormField } from "@/components/ui/FormSection";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function LifecycleOnboardingCreatePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [category, setCategory] = useState("local");
  const [err, setErr] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["tenant-users"],
    queryFn: async () => (await tenantUsersApi.list()).data.data ?? [],
  });

  const create = useMutation({
    mutationFn: () =>
      lifecycleApi.initiateOnboarding({
        employee_id: Number(employeeId),
        template_code: category === "regional" ? "onboarding-regional" : "onboarding-local",
        employee_category: category,
      }),
    onSuccess: (res) => {
      const id = res.data.data?.id;
      if (id) router.push(`/lifecycle/cases/${id}`);
    },
    onError: () => setErr(t("lifecycle.onboardingCreate.failed")),
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("lifecycle.onboarding.start")}
        subtitle={t("lifecycle.onboardingCreate.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("lifecycle.common.breadcrumb"), href: "/lifecycle" },
              { label: t("lifecycle.onboarding.crumb"), href: "/lifecycle/onboarding" },
              { label: t("lifecycle.common.startCrumb") },
            ]}
          />
        }
      />

      <FormSection title={t("lifecycle.journeyNew.caseDetails")}>
        <div className="space-y-4">
          <FormField label={t("lifecycle.common.employee")} htmlFor="lifecycle-onboarding-employee">
            <select
              id="lifecycle-onboarding-employee"
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

          <FormField label={t("lifecycle.onboardingCreate.category")} htmlFor="lifecycle-onboarding-category">
            <select
              id="lifecycle-onboarding-category"
              className="input w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="local">{t("lifecycle.onboardingCreate.local")}</option>
              <option value="regional">{t("lifecycle.onboardingCreate.regional")}</option>
            </select>
          </FormField>

          {err ? <p className="text-sm text-red-600">{err}</p> : null}

          <button
            type="button"
            className="btn-primary"
            disabled={!employeeId || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? t("lifecycle.common.starting") : t("lifecycle.onboardingCreate.submit")}
          </button>
        </div>
      </FormSection>
    </div>
  );
}
