"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

export default function Page() {
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      peopleAuthorityApi.createAccessReview({
        name: name.trim(),
        due_date: dueDate || undefined,
      }),
    onSuccess: () => {
      setMsg("Access review campaign created. Items still need human decisions.");
      setErr(null);
      setName("");
    },
    onError: () => setErr("Could not create the access review. A name is required."),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Access reviews"
        subtitle="Open a review campaign. Completing items never auto-grants or auto-revokes access."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "People & Authority", href: "/people" },
              { label: "Access reviews" },
            ]}
          />
        }
        actions={<Link href="/people" className="btn-secondary text-sm">Hub</Link>}
      />
      <form
        className="card space-y-3 p-4 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            setErr("Name is required.");
            return;
          }
          create.mutate();
        }}
      >
        <label className="block text-xs font-medium text-neutral-600">
          Campaign name
          <input className="form-input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block text-xs font-medium text-neutral-600">
          Due date
          <input type="date" className="form-input mt-1" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Create access review"}
        </button>
        {msg && <p className="text-sm text-green-700">{msg}</p>}
        {err && <p className="text-sm text-red-700">{err}</p>}
      </form>
    </div>
  );
}
