"use client";

import React from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";

export default function PeopleRecertificationPage() {
  const open = useMutation({
    mutationFn: () => peopleAuthorityApi.openRecertification({ auto_populate_roles: true }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">People &amp; Authority · Phase 2</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Role recertification</h1>
          <p className="text-sm text-neutral-600 mt-1">Opens an access-review campaign with role items. Decisions remain human-only.</p>
        </div>
        <Link href="/people/access-reviews" className="text-sm underline">Access reviews</Link>
      </div>
      <button type="button" className="btn-primary text-sm px-4 py-2" disabled={open.isPending} onClick={() => open.mutate()}>
        {open.isPending ? "Opening…" : "Open recertification campaign"}
      </button>
      {open.isError && <p className="text-sm text-red-600">Unable to open campaign.</p>}
      {open.data && (
        <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-4 overflow-auto max-h-[70vh]">
          {JSON.stringify(open.data.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
