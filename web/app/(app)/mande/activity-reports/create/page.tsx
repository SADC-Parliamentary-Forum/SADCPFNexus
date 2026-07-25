"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { mandeApi, programmeApi, type PifLinkage } from "@/lib/api";

function CreateActivityReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const programmeIdParam = searchParams.get("programme_id");
  const programmeId = programmeIdParam ? Number(programmeIdParam) : NaN;

  const [title, setTitle] = useState("");
  const [selectedProgrammeId, setSelectedProgrammeId] = useState<number | "">(
    Number.isFinite(programmeId) ? programmeId : ""
  );

  const { data: linkages, isLoading: loadingLinkages } = useQuery({
    queryKey: ["mande", "pif-linkages", "unlinked"],
    queryFn: () =>
      mandeApi.getPifLinkages({ unlinked: true }).then((r) => r.data.data as PifLinkage[]),
    staleTime: 20_000,
  });

  const { data: programme } = useQuery({
    queryKey: ["programme", selectedProgrammeId],
    queryFn: () =>
      programmeApi.get(Number(selectedProgrammeId)).then((r) => r.data),
    enabled: typeof selectedProgrammeId === "number" && selectedProgrammeId > 0,
  });

  useEffect(() => {
    if (programme?.title && !title) {
      setTitle(programme.title);
    }
  }, [programme, title]);

  useEffect(() => {
    if (Number.isFinite(programmeId) && programmeId > 0) {
      setSelectedProgrammeId(programmeId);
    }
  }, [programmeId]);

  const createMut = useMutation({
    mutationFn: () =>
      mandeApi.createReport({
        programme_id: Number(selectedProgrammeId),
        activity_title: title.trim(),
        start_date: programme?.start_date ?? undefined,
        end_date: programme?.end_date ?? undefined,
        responsible_officer_id: programme?.responsible_officer_id ?? undefined,
      }),
    onSuccess: (res) => {
      const report = res.data.data;
      router.push(`/mande/activity-reports/${report.id}`);
    },
  });

  const unlinked = linkages ?? [];
  const canSubmit =
    typeof selectedProgrammeId === "number" &&
    selectedProgrammeId > 0 &&
    title.trim().length > 0 &&
    !createMut.isPending;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/mande/intake" className="text-xs text-primary hover:underline">← Intake Queue</Link>
        <h1 className="page-title mt-2">Create Activity Report</h1>
        <p className="page-subtitle">Link a new M&amp;E report to an approved PIF. Planned PIF fields stay read-only after create.</p>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Approved PIF *</label>
          {loadingLinkages ? (
            <p className="text-sm text-neutral-400">Loading PIFs…</p>
          ) : (
            <select
              className="form-input"
              value={selectedProgrammeId === "" ? "" : String(selectedProgrammeId)}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedProgrammeId(v ? Number(v) : "");
                setTitle("");
              }}
            >
              <option value="">Select PIF…</option>
              {programme && !unlinked.some((p) => p.id === programme.id) && (
                <option value={programme.id}>
                  {programme.reference_number} — {programme.title}
                </option>
              )}
              {unlinked.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.reference_number} — {p.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {programme && (
          <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2 text-xs text-neutral-600 space-y-1">
            <p><span className="font-semibold">PIF:</span> {programme.reference_number}</p>
            <p>
              <span className="font-semibold">Dates:</span>{" "}
              {programme.start_date ?? "—"} → {programme.end_date ?? "—"}
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Activity title *</label>
          <input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Usually matches the PIF title"
          />
        </div>

        {createMut.isError && (
          <p className="text-sm text-red-600">Could not create the report. It may already exist for this PIF.</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Link href="/mande/intake" className="btn-secondary">Cancel</Link>
          <button
            type="button"
            className="btn-primary disabled:opacity-40"
            disabled={!canSubmit}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? "Creating…" : "Create report"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreateActivityReportPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">Loading…</div>}>
      <CreateActivityReportForm />
    </Suspense>
  );
}
