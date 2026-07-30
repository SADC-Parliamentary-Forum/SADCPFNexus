"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";

export default function Page() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["people-authority", "access-reviews"],
    queryFn: async () => {
      return { note: "Use API POST /people-authority/access-reviews" };
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">People &amp; Authority</p>
        <h1 className="text-2xl font-semibold text-neutral-900">Access Reviews</h1>
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Unable to load.</p>}
      {data && (
        <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-4 overflow-auto max-h-[70vh]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/people">Hub</Link>
        <Link className="underline" href="/people/directory">Directory</Link>
        <Link className="underline" href="/people/org-chart">Org Chart</Link>
        <Link className="underline" href="/people/authority">Authority</Link>
        <Link className="underline" href="/people/delegations">Delegations</Link>
        <Link className="underline" href="/people/signatures">Signatures</Link>
      </div>
    </div>
  );
}
