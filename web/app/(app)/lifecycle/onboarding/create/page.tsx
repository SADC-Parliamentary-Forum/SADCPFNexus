"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { lifecycleApi, tenantUsersApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { FormField } from "@/components/ui/FormSection";

export default function LifecycleOnboardingCreatePage() {
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
    onError: () => setErr("Could not start onboarding. Check HR authorisation and published templates."),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ModulePageHeader
        title="Start onboarding"
        subtitle="Opens a versioned onboarding case — notice and probation policy come from HR settings, not this form."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Employee Lifecycle", href: "/lifecycle" },
              { label: "Onboarding", href: "/lifecycle/onboarding" },
              { label: "Start" },
            ]}
          />
        }
      />

      <FormSection title="Case details">
        <div className="space-y-4">
          <FormField label="Employee" htmlFor="lifecycle-onboarding-employee">
            <select
              id="lifecycle-onboarding-employee"
              className="input w-full"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">Select employee…</option>
              {(usersQuery.data ?? []).map((u: { id: number; name: string }) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Employee category" htmlFor="lifecycle-onboarding-category">
            <select
              id="lifecycle-onboarding-category"
              className="input w-full"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="local">Local staff</option>
              <option value="regional">Regional staff</option>
            </select>
          </FormField>

          {err ? <p className="text-sm text-red-600">{err}</p> : null}

          <button
            type="button"
            className="btn-primary"
            disabled={!employeeId || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Starting…" : "Start onboarding case"}
          </button>
        </div>
      </FormSection>
    </div>
  );
}
