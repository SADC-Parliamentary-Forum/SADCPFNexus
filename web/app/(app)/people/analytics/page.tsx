"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";

export default function PeopleAnalyticsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["people-authority", "analytics"],
    queryFn: async () => (await peopleAuthorityApi.analytics()).data.data,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">People &amp; Authority · Phase 3</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Organisational analytics</h1>
        </div>
        <Link href="/people" className="text-sm underline">Hub</Link>
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Unable to load analytics.</p>}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="border border-neutral-200 rounded-lg p-4 bg-white">
              <div className="text-xs uppercase tracking-wide text-neutral-500">{key.replaceAll("_", " ")}</div>
              <div className="text-2xl font-semibold mt-2">{String(value ?? 0)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
