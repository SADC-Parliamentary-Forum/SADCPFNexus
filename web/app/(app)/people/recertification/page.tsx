"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

export default function Page() {
  const [name, setName] = useState("Privileged role recertification");
  const [dueDate, setDueDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const open = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.openRecertification({
        name: name.trim() || undefined,
        due_date: dueDate || undefined,
        auto_populate_roles: true,
      }),
    onSuccess: () => {
      setMsg("Recertification campaign opened. Reviewers still decide each item.");
      setErr(null);
    },
    onError: () => setErr("Could not open a recertification campaign."),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Recertification"
        subtitle="Open a campaign on demand. This page does not create campaigns just by loading."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "People & Authority", href: "/people" },
              { label: "Recertification" },
            ]}
          />
        }
        actions={<Link href="/people" className="btn-secondary text-sm">Hub</Link>}
      />
      <form
        className="card space-y-3 p-4 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          open.mutate();
        }}
      >
        <label className="block text-xs font-medium text-neutral-600">
          Campaign name
          <input className="form-input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Due date
          <input type="date" className="form-input mt-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary text-sm" disabled={open.isPending}>
          {open.isPending ? "Opening…" : "Open recertification campaign"}
        </button>
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        {err && <p className="text-sm text-red-700">{err}</p>}
      </form>
    </div>
  );
}
