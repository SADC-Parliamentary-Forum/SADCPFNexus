"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { lifecycleApi, tenantUsersApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { FormField } from "@/components/ui/FormSection";

export default function LifecycleSeparationCreatePage() {
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
    onError: () => setErr("Could not start separation. Ensure published HR notice policy exists for the employee."),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ModulePageHeader
        title="Start separation"
        subtitle="Notice period is resolved from published grade band or contract type — not editable here."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Employee Lifecycle", href: "/lifecycle" },
              { label: "Separation", href: "/lifecycle/separation" },
              { label: "Start" },
            ]}
          />
        }
      />

      <FormSection title="Separation details">
        <div className="space-y-4">
          <FormField label="Employee" htmlFor="lifecycle-separation-employee">
            <select
              id="lifecycle-separation-employee"
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

          <FormField label="Separation type" htmlFor="lifecycle-separation-reason">
            <select
              id="lifecycle-separation-reason"
              className="input w-full"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="resignation">Resignation</option>
              <option value="end_of_contract">End of contract</option>
            </select>
          </FormField>

          <FormField label="Last working day" htmlFor="lifecycle-separation-lwd">
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
            {create.isPending ? "Starting…" : "Start separation case"}
          </button>
        </div>
      </FormSection>
    </div>
  );
}
