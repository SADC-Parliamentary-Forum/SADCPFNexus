"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { decisionsApi } from "@/lib/api";

export default function DecisionsDashboardPage() {
  const qc = useQueryClient();
  const [promoteMsg, setPromoteMsg] = useState<string | null>(null);
  const [promoteErr, setPromoteErr] = useState<string | null>(null);
  const [riskMsg, setRiskMsg] = useState<string | null>(null);
  const [riskErr, setRiskErr] = useState<string | null>(null);
  const [packMsg, setPackMsg] = useState<string | null>(null);
  const [packErr, setPackErr] = useState<string | null>(null);
  const [minutesId, setMinutesId] = useState("");
  const [minutesMsg, setMinutesMsg] = useState<string | null>(null);
  const [minutesErr, setMinutesErr] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["decisions", "dashboard"],
    queryFn: async () => (await decisionsApi.dashboard()).data.data,
  });

  const minutes = useQuery({
    queryKey: ["decisions", "minutes-options"],
    queryFn: async () => (await decisionsApi.listMinutesOptions()).data.data,
  });

  const promote = useMutation({
    mutationFn: () => decisionsApi.promoteWeeklyAssignments(),
    onSuccess: (res) => {
      const row = res.data.data;
      setPromoteErr(null);
      setPromoteMsg(
        `Promoted ${row.promoted} adopted/in-progress decisions into assignments; skipped ${row.skipped}. Completion stays human-owned.`,
      );
      qc.invalidateQueries({ queryKey: ["decisions"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: () => {
      setPromoteMsg(null);
      setPromoteErr("Could not promote weekly assignments. Governance write access is required.");
    },
  });

  const promoteRisks = useMutation({
    mutationFn: () => decisionsApi.promoteRisks(),
    onSuccess: (res) => {
      const row = res.data.data;
      setRiskErr(null);
      setRiskMsg(
        `Promoted ${row.promoted} risk-like decisions into draft risk proposals; skipped ${row.skipped}. Decisions stay open.`,
      );
      qc.invalidateQueries({ queryKey: ["decisions"] });
    },
    onError: () => {
      setRiskMsg(null);
      setRiskErr("Could not promote risks. Governance write access is required.");
    },
  });

  const promotePack = useMutation({
    mutationFn: () => decisionsApi.promoteMeetingPack(),
    onSuccess: (res) => {
      const row = res.data.data;
      setPackErr(null);
      setPackMsg(
        `Meeting pack: ${row.assignments.promoted} assignment drafts, ${row.risks.promoted} risk drafts. Decisions stay open.`,
      );
      qc.invalidateQueries({ queryKey: ["decisions"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: () => {
      setPackMsg(null);
      setPackErr("Could not promote the meeting pack. Governance write access is required.");
    },
  });

  const promoteMinutes = useMutation({
    mutationFn: () => decisionsApi.promoteFromMinutes(Number(minutesId)),
    onSuccess: (res) => {
      const row = res.data.data;
      setMinutesErr(null);
      setMinutesMsg(
        `Minutes ${row.meeting_minutes_id}: ${row.assignments.promoted} assignment drafts, ${row.risks.promoted} risk drafts. Decisions stay open.`,
      );
      qc.invalidateQueries({ queryKey: ["decisions"] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: () => {
      setMinutesMsg(null);
      setMinutesErr("Could not promote from minutes. Governance write access is required.");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/decisions" className="text-sm text-neutral-500 hover:text-primary">← Decision Register</Link>
          <h1 className="mt-2 text-2xl font-semibold">Decisions dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={promote.isPending}
            onClick={() => promote.mutate()}
          >
            {promote.isPending ? "Promoting…" : "Promote weekly assignments"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={promoteRisks.isPending}
            onClick={() => promoteRisks.mutate()}
          >
            {promoteRisks.isPending ? "Promoting…" : "Promote risk drafts"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            data-testid="promote-meeting-pack"
            disabled={promotePack.isPending}
            onClick={() => promotePack.mutate()}
          >
            {promotePack.isPending ? "Promoting…" : "Promote meeting pack"}
          </button>
          <Link href="/decisions/create" className="btn-primary">New decision</Link>
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        data-testid="promote-from-minutes"
        onSubmit={(e) => {
          e.preventDefault();
          if (minutesId) promoteMinutes.mutate();
        }}
      >
        <label className="text-sm">
          Minutes
          <select className="form-input mt-1 min-w-[16rem]" value={minutesId} onChange={(e) => setMinutesId(e.target.value)}>
            <option value="">Select minutes</option>
            {(minutes.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>{row.title}{row.meeting_date ? ` · ${row.meeting_date}` : ""}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-secondary" disabled={!minutesId || promoteMinutes.isPending}>
          {promoteMinutes.isPending ? "Promoting…" : "Promote this meeting"}
        </button>
      </form>

      <p className="text-sm text-neutral-600">
        Weekly promote creates assignment drafts from adopted decisions that already have an owner and due date.
        Risk promote creates draft/proposed risks from adopted decisions whose title or body mentions risk.
        Neither action auto-completes work.
      </p>
      {promoteMsg && <p className="text-sm text-green-700">{promoteMsg}</p>}
      {promoteErr && <p className="text-sm text-red-600">{promoteErr}</p>}
      {riskMsg && <p className="text-sm text-green-700">{riskMsg}</p>}
      {riskErr && <p className="text-sm text-red-600">{riskErr}</p>}
      {packMsg && <p className="text-sm text-green-700">{packMsg}</p>}
      {packErr && <p className="text-sm text-red-600">{packErr}</p>}
      {minutesMsg && <p className="text-sm text-green-700">{minutesMsg}</p>}
      {minutesErr && <p className="text-sm text-red-600">{minutesErr}</p>}

      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Failed to load dashboard.</p>}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total" value={data.total} />
          <Stat label="Overdue" value={data.overdue} />
          <Stat label="Open critical actions" value={data.open_critical_actions} />
          <Stat label="Adopted" value={data.by_status.adopted ?? 0} />
          <Stat label="In progress" value={data.by_status.in_progress ?? 0} />
          <Stat label="Implemented" value={data.by_status.implemented ?? 0} />
          <Stat label="Draft" value={data.by_status.draft ?? 0} />
          <Stat label="Closed" value={data.by_status.closed ?? 0} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
