"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { lifecycleApi, tenantUsersApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";

const TYPES = [
  { value: "transfer", label: "Internal transfer", code: "transfer-internal" },
  { value: "promotion", label: "Promotion", code: "promotion" },
  { value: "probation", label: "Probation review", code: "probation-review" },
] as const;

function JourneyCreateForm() {
  const router = useRouter();
  const search = useSearchParams();
  const initial = TYPES.some((t) => t.value === search.get("type")) ? (search.get("type") as string) : "transfer";
  const [lifecycleType, setLifecycleType] = useState(initial);
  const [employeeId, setEmployeeId] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["tenant-users"],
    queryFn: async () => (await tenantUsersApi.list()).data.data ?? [],
  });

  const selected = TYPES.find((t) => t.value === lifecycleType) ?? TYPES[0];

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
    onError: () => setErr("Could not start this journey. Check HR authorisation and published templates."),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <ModulePageHeader
        title="Start internal journey"
        subtitle="Opens a transfer, promotion, or probation case from a published template."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Employee Lifecycle", href: "/lifecycle" },
              { label: "Start journey" },
            ]}
          />
        }
      />

      <FormSection title="Case details">
        <div className="space-y-4">
          <FormField label="Journey type" htmlFor="lifecycle-journey-type">
            <select
              id="lifecycle-journey-type"
              className="input w-full"
              value={lifecycleType}
              onChange={(e) => setLifecycleType(e.target.value)}
            >
              {TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Employee" htmlFor="lifecycle-journey-employee">
            <select
              id="lifecycle-journey-employee"
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

          {err ? <p className="text-sm text-red-600">{err}</p> : null}

          <button
            type="button"
            className="btn-primary"
            disabled={!employeeId || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "Starting…" : `Start ${selected.label.toLowerCase()}`}
          </button>
        </div>
      </FormSection>
    </div>
  );
}

export default function LifecycleJourneyCreatePage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-neutral-500">Loading…</p>}>
      <JourneyCreateForm />
    </Suspense>
  );
}
