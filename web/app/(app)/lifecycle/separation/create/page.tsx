"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { lifecycleApi, tenantUsersApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { FormField } from "@/components/ui/FormSection";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function LifecycleSeparationCreatePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [reason, setReason] = useState("resignation");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["tenant-users"],
    queryFn: async () => (await tenantUsersApi.list()).data.data ?? [],
  });

  const create = useMutation({
    mutationFn: () =>
      lifecycleApi.initiateSeparation({
        employee_id: Number(employeeId),
        separation_reason: reason,
        template_code: reason === "end_of_contract" ? "separation-end-of-contract" : "separation-resignation",
        last_working_day: lastWorkingDay || undefined,
      }),
    onSuccess: (res) => {
      const id = res.data.data?.id;
      if (id) router.push(`/lifecycle/cases/${id}`);
    },
    onError: () => setErr(t("lifecycle.separationCreate.failed")),
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("lifecycle.separation.start")}
        subtitle={t("lifecycle.separationCreate.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("lifecycle.common.breadcrumb"), href: "/lifecycle" },
              { label: t("lifecycle.separation.crumb"), href: "/lifecycle/separation" },
              { label: t("lifecycle.common.startCrumb") },
            ]}
          />
        }
      />

      <FormSection title={t("lifecycle.separationCreate.details")}>
        <div className="space-y-4">
          <FormField label={t("lifecycle.common.employee")} htmlFor="lifecycle-separation-employee">
            <select
              id="lifecycle-separation-employee"
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

          <FormField label={t("lifecycle.separationCreate.type")} htmlFor="lifecycle-separation-reason">
            <select
              id="lifecycle-separation-reason"
              className="input w-full"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="resignation">{t("lifecycle.separationCreate.resignation")}</option>
              <option value="end_of_contract">{t("lifecycle.separationCreate.endOfContract")}</option>
            </select>
          </FormField>

          <FormField label={t("lifecycle.separationCreate.lastDay")} htmlFor="lifecycle-separation-lwd">
            <input
              id="lifecycle-separation-lwd"
              type="date"
              className="input w-full"
              value={lastWorkingDay}
              onChange={(e) => setLastWorkingDay(e.target.value)}
            />
          </FormField>

          {err ? <p className="text-sm text-red-600">{err}</p> : null}

          <button
            type="button"
            className="btn-primary"
            disabled={!employeeId || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? t("lifecycle.common.starting") : t("lifecycle.separationCreate.submit")}
          </button>
        </div>
      </FormSection>
    </div>
  );
}
