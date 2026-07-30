"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";

export default function PeopleEsignPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["people-authority", "esign"],
    queryFn: async () => (await peopleAuthorityApi.listEsign()).data,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">People &amp; Authority · Phase 2</p>
          <h1 className="text-2xl font-semibold text-neutral-900">External e-sign</h1>
          <p className="text-sm text-neutral-600 mt-1">Human-triggered provider requests only. Never auto-starts from schedules.</p>
        </div>
        <Link href="/people" className="text-sm underline">Hub</Link>
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Unable to load e-sign requests.</p>}
      {data && (
        <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-4 overflow-auto max-h-[70vh]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
