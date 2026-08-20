"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

function asRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (obj.data && typeof obj.data === "object") {
      const nested = obj.data as Record<string, unknown>;
      for (const key of ["data", "items", "results", "people"]) {
        if (Array.isArray(nested[key])) return nested[key] as Record<string, unknown>[];
      }
    }
  }
  return [];
}

function personLabel(p: Record<string, unknown>): string {
  return String(p.preferred_name ?? [p.first_name, p.last_name].filter(Boolean).join(" ") ?? p.name ?? p.id);
}

export default function Page() {
  const [personId, setPersonId] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const peopleQuery = useQuery({
    queryKey: ["people-authority", "people-options"],
    queryFn: async () => asRows((await peopleAuthorityApi.listPeople({ directory: 1, per_page: 100 })).data),
  });
  const create = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.createOffboarding({
        person_id: Number(personId),
        last_working_day: lastWorkingDay || undefined,
        complete: false,
        access_actions_confirmed: false,
      }),
    onSuccess: () => {
      setMsg("Offboarding case opened. Access is not revoked from this form.");
      setErr(null);
    },
    onError: () => setErr("Could not create the offboarding case. A person is required."),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Offboarding"
        subtitle="Open an offboarding case. Closing it still requires confirmed access actions — this form never auto-revokes."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "People & Authority", href: "/people" },
              { label: "Offboarding" },
            ]}
          />
        }
        actions={<Link href="/people" className="btn-secondary text-sm">Hub</Link>}
      />
      <form
        className="card space-y-3 p-4 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (!personId) {
            setErr("Select a person.");
            return;
          }
          create.mutate();
        }}
      >
        <label className="block text-xs font-medium text-neutral-600">
          Person
          <select className="form-input mt-1" value={personId} onChange={(e) => setPersonId(e.target.value)} required>
            <option value="">Select…</option>
            {(peopleQuery.data ?? []).map((p) => (
              <option key={String(p.id)} value={String(p.id)}>{personLabel(p)}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Last working day
          <input type="date" className="form-input mt-1" value={lastWorkingDay} onChange={(e) => setLastWorkingDay(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Open offboarding case"}
        </button>
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        {err && <p className="text-sm text-red-700">{err}</p>}
      </form>
    </div>
  );
}
