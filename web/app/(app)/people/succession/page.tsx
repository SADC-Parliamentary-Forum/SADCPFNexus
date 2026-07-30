"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";

export default function PeopleSuccessionPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["people-authority", "succession"],
    queryFn: async () => (await peopleAuthorityApi.listSuccession()).data,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">People &amp; Authority · Phase 3</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Position succession planning</h1>
        </div>
        <Link href="/people" className="text-sm underline">Hub</Link>
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Unable to load succession plans.</p>}
      {data && (
        <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-4 overflow-auto max-h-[70vh]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
