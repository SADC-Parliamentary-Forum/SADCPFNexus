"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditEngagementsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "engagements"],
    queryFn: async () => (await auditApi.listEngagements({ per_page: 50 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];

  const create = useMutation({
    mutationFn: (engagementTitle: string) => auditApi.createEngagement({ title: engagementTitle }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["audit", "engagements"] });
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit Engagements</h1>
      <p className="text-sm text-neutral-600">Lifecycle includes independence clearance before fieldwork.</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const engagementTitle = title.trim();
          if (!engagementTitle || create.isPending) return;
          create.mutate(engagementTitle);
        }}
      >
        <label className="sr-only" htmlFor="audit-engagement-title">Engagement title</label>
        <input
          id="audit-engagement-title"
          className="border rounded px-2 py-1 text-sm disabled:opacity-60"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Engagement title"
          disabled={create.isPending}
        />
        <button
          type="submit"
          className="text-sm px-3 py-1.5 bg-neutral-900 text-white rounded disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={create.isPending || !title.trim()}
        >
          {create.isPending ? "Creating..." : "Create"}
        </button>
      </form>
      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-2">Reference</th>
              <th className="p-2">Title</th>
              <th className="p-2">Status</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-b">
                <td className="p-2">{String(r.reference_number ?? "—")}</td>
                <td className="p-2"><Link className="underline" href={`/audit/engagements?id=${r.id}`}>{String(r.title)}</Link></td>
                <td className="p-2">{String(r.status)}</td>
                <td className="p-2 space-x-2">
                  <button type="button" className="underline" onClick={() => auditApi.declareIndependence(Number(r.id), { status: "cleared" }).then(() => qc.invalidateQueries({ queryKey: ["audit", "engagements"] }))}>Clear independence</button>
                  <button type="button" className="underline" onClick={() => auditApi.notifyEngagement(Number(r.id)).then(() => qc.invalidateQueries({ queryKey: ["audit", "engagements"] }))}>Notify</button>
                  <button type="button" className="underline" onClick={() => auditApi.startFieldwork(Number(r.id)).then(() => qc.invalidateQueries({ queryKey: ["audit", "engagements"] }))}>Fieldwork</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-sm text-neutral-500" colSpan={4}>
                  No audit engagements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
