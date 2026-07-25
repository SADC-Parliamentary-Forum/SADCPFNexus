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
  const forcedPif = Number.isFinite(programmeId) && programmeId > 0;

  const [nonPif, setNonPif] = useState(!forcedPif && searchParams.get("non_pif") === "1");
  const [nonPifReason, setNonPifReason] = useState("");
  const [title, setTitle] = useState("");
  const [selectedProgrammeId, setSelectedProgrammeId] = useState<number | "">(
    forcedPif ? programmeId : ""
  );

  const { data: linkages, isLoading: loadingLinkages } = useQuery({
    queryKey: ["mande", "pif-linkages", "unlinked"],
    queryFn: () =>
      mandeApi.getPifLinkages({ unlinked: true }).then((r) => r.data.data as PifLinkage[]),
    staleTime: 20_000,
    enabled: !nonPif,
  });

  const { data: programme } = useQuery({
    queryKey: ["programme", selectedProgrammeId],
    queryFn: () =>
      programmeApi.get(Number(selectedProgrammeId)).then((r) => r.data),
    enabled: !nonPif && typeof selectedProgrammeId === "number" && selectedProgrammeId > 0,
  });

  useEffect(() => {
    if (programme?.title && !title) {
      setTitle(programme.title);
    }
  }, [programme, title]);

  useEffect(() => {
    if (forcedPif) {
      setNonPif(false);
      setSelectedProgrammeId(programmeId);
    }
  }, [forcedPif, programmeId]);

  const createMut = useMutation({
    mutationFn: () => {
      if (nonPif) {
        return mandeApi.createReport({
          activity_title: title.trim(),
          non_pif_reason: nonPifReason.trim(),
        });
      }
      return mandeApi.createReport({
        programme_id: Number(selectedProgrammeId),
        activity_title: title.trim(),
        start_date: programme?.start_date ?? undefined,
        end_date: programme?.end_date ?? undefined,
        responsible_officer_id: programme?.responsible_officer_id ?? undefined,
      });
    },
    onSuccess: (res) => {
      const report = res.data.data;
      router.push(`/mande/activity-reports/${report.id}`);
    },
  });

  const unlinked = linkages ?? [];
  const canSubmit = nonPif
    ? title.trim().length > 0 && nonPifReason.trim().length >= 5 && !createMut.isPending
    : typeof selectedProgrammeId === "number" &&
      selectedProgrammeId > 0 &&
      title.trim().length > 0 &&
      !createMut.isPending;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/mande/intake" className="text-xs text-primary hover:underline">← Intake Queue</Link>
        <h1 className="page-title mt-2">Create Activity Report</h1>
        <p className="page-subtitle">
          {nonPif
            ? "Create a non-PIF activity report with a documented reason."
            : "Link a new M&E report to an approved PIF. Planned PIF fields stay read-only after create."}
        </p>
      </div>

      <div className="card p-5 space-y-4">
        {!forcedPif && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={nonPif}
              onChange={(e) => {
                setNonPif(e.target.checked);
                if (e.target.checked) {
                  setSelectedProgrammeId("");
                } else {
                  setNonPifReason("");
                }
              }}
            />
            <span>
              <span className="block text-sm font-semibold text-neutral-800">Non-PIF activity report</span>
              <span className="block text-xs text-neutral-500 mt-0.5">
                Use when there is no approved programme (e.g. internal briefing with no expenditure).
              </span>
            </span>
          </label>
        )}

        {!nonPif && (
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
        )}

        {!nonPif && programme && (
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
            placeholder={nonPif ? "Describe the activity" : "Usually matches the PIF title"}
          />
        </div>

        {nonPif && (
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Reason for non-PIF report *
            </label>
            <textarea
              className="form-input min-h-[100px]"
              value={nonPifReason}
              onChange={(e) => setNonPifReason(e.target.value)}
              placeholder="Explain why this activity has no linked PIF (min. 5 characters)"
            />
            {nonPifReason.trim().length > 0 && nonPifReason.trim().length < 5 && (
              <p className="text-xs text-amber-700 mt-1">Reason must be at least 5 characters.</p>
            )}
          </div>
        )}

        {createMut.isError && (
          <p className="text-sm text-red-600">
            {nonPif
              ? "Could not create the non-PIF report. Check the title and reason."
              : "Could not create the report. It may already exist for this PIF."}
          </p>
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
