"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";

export default function PeopleSearchPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["people-authority", "search", submitted],
    queryFn: async () => (await peopleAuthorityApi.search(submitted)).data.data,
    enabled: submitted.length > 0,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">People &amp; Authority · Phase 3</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Organisation search</h1>
          <p className="text-sm text-neutral-600 mt-1">Basic keyword search over people, units, and positions.</p>
        </div>
        <Link href="/people" className="text-sm underline">Hub</Link>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q.trim());
        }}
      >
        <input className="form-input max-w-lg" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, units, positions…" />
        <button type="submit" className="btn-primary text-sm px-4 py-2">Search</button>
      </form>
      {(isLoading || isFetching) && <p className="text-sm text-neutral-500">Searching…</p>}
      {isError && <p className="text-sm text-red-600">Unable to search.</p>}
      {data && (
        <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-4 overflow-auto max-h-[70vh]">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
