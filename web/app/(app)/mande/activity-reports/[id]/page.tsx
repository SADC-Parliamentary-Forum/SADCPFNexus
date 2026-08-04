"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ME_EVIDENCE_TYPES,
  mandeApi,
  type MeActivityReport,
  type MeEvidence,
  type MeFollowUpAction,
  type MeFollowUpPriority,
  type MeReviewHistoryEntry,
} from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const STATUS_BADGE: Record<string, string> = {
  not_submitted: "badge-muted",
  submitted: "badge-warning",
  returned: "badge-danger",
  reviewed: "badge-primary",
  accepted: "badge-success",
  closed: "badge-muted",
  not_reportable: "badge-muted",
};

type Draft = {
  activity_title: string;
  start_date: string;
  end_date: string;
  planned_output: string;
  actual_output: string;
  planned_participants: string;
  actual_participants: string;
  narrative: string;
  challenges: string;
  lessons_learned: string;
  recommendations: string;
  follow_up_actions: string;
};

function toDraft(r: MeActivityReport): Draft {
  return {
    activity_title: r.activity_title ?? "",
    start_date: r.start_date?.slice(0, 10) ?? "",
    end_date: r.end_date?.slice(0, 10) ?? "",
    planned_output: r.planned_output ?? "",
    actual_output: r.actual_output ?? "",
    planned_participants: r.planned_participants != null ? String(r.planned_participants) : "",
    actual_participants: r.actual_participants != null ? String(r.actual_participants) : "",
    narrative: r.narrative ?? "",
    challenges: r.challenges ?? "",
    lessons_learned: r.lessons_learned ?? "",
    recommendations: r.recommendations ?? "",
    follow_up_actions: r.follow_up_actions ?? "",
  };
}

export default function ActivityReportDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const user = getStoredUser();
  const canReview = isSystemAdmin(user) || hasPermission(user, ["mande.review", "mande.admin"]);
  const canCreate = isSystemAdmin(user) || hasPermission(user, ["mande.create", "mande.admin"]);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [section, setSection] = useState("identity");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnSection, setReturnSection] = useState("");
  const [returnAction, setReturnAction] = useState("");
  const [correctionDue, setCorrectionDue] = useState("");
  const [acceptNotes, setAcceptNotes] = useState("");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState("report");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [followUpAction, setFollowUpAction] = useState("");
  const [followUpDue, setFollowUpDue] = useState("");
  const [followUpPriority, setFollowUpPriority] = useState<MeFollowUpPriority>("normal");

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ["mande", "activity-report", id],
    queryFn: () => mandeApi.getReport(id).then((r) => r.data.data as MeActivityReport),
    enabled: Number.isFinite(id) && id > 0,
  });

  const { data: evidence = [] } = useQuery({
    queryKey: ["mande", "evidence", id],
    queryFn: () => mandeApi.listEvidence(id).then((r) => r.data.data as MeEvidence[]),
    enabled: Number.isFinite(id) && id > 0,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["mande", "history", id],
    queryFn: () => mandeApi.getReportHistory(id).then((r) => r.data.data as MeReviewHistoryEntry[]),
    enabled: Number.isFinite(id) && id > 0,
  });

  const { data: followUps = [] } = useQuery({
    queryKey: ["mande", "follow-ups", id],
    queryFn: () => mandeApi.listFollowUps(id).then((r) => r.data.data as MeFollowUpAction[]),
    enabled: Number.isFinite(id) && id > 0,
  });

  useEffect(() => {
    if (report) setDraft(toDraft(report));
  }, [report]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mande", "activity-report", id] });
    qc.invalidateQueries({ queryKey: ["mande", "evidence", id] });
    qc.invalidateQueries({ queryKey: ["mande", "history", id] });
    qc.invalidateQueries({ queryKey: ["mande", "follow-ups", id] });
    qc.invalidateQueries({ queryKey: ["mande", "activity-reports"] });
  };

  const saveMut = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error("No draft");
      return mandeApi.updateReport(id, {
        activity_title: draft.activity_title,
        start_date: draft.start_date || null,
        end_date: draft.end_date || null,
        planned_output: draft.planned_output || null,
        actual_output: draft.actual_output || null,
        planned_participants: draft.planned_participants === "" ? null : Number(draft.planned_participants),
        actual_participants: draft.actual_participants === "" ? null : Number(draft.actual_participants),
        narrative: draft.narrative || null,
        challenges: draft.challenges || null,
        lessons_learned: draft.lessons_learned || null,
        recommendations: draft.recommendations || null,
        follow_up_actions: draft.follow_up_actions || null,
      });
    },
    onSuccess: () => {
      setActionMsg("Draft saved.");
      invalidate();
    },
  });

  const submitMut = useMutation({
    mutationFn: () => mandeApi.submitReport(id),
    onSuccess: () => { setActionMsg("Submitted for review."); invalidate(); },
  });
  const returnMut = useMutation({
    mutationFn: () =>
      mandeApi.returnReport(id, {
        review_notes: returnNotes,
        section: returnSection || undefined,
        required_action: returnAction || undefined,
        correction_due_at: correctionDue || undefined,
      }),
    onSuccess: () => {
      setActionMsg("Returned for correction.");
      setReturnNotes("");
      invalidate();
    },
  });
  const acceptMut = useMutation({
    mutationFn: () => mandeApi.acceptReport(id, { review_notes: acceptNotes || undefined }),
    onSuccess: () => { setActionMsg("Report accepted."); invalidate(); },
  });
  const closeMut = useMutation({
    mutationFn: () => mandeApi.closeReport(id),
    onSuccess: () => { setActionMsg("Report closed."); invalidate(); },
  });
  const uploadMut = useMutation({
    mutationFn: () => {
      if (!evidenceFile) throw new Error("No file");
      return mandeApi.uploadEvidence(id, evidenceFile, {
        evidence_type: evidenceType,
        title: evidenceTitle || evidenceFile.name,
      });
    },
    onSuccess: () => {
      setEvidenceFile(null);
      setEvidenceTitle("");
      setActionMsg("Evidence uploaded.");
      invalidate();
    },
  });
  const reviewEvidenceMut = useMutation({
    mutationFn: ({ evidenceId, status }: { evidenceId: number; status: "validated" | "rejected" }) =>
      mandeApi.reviewEvidence(id, evidenceId, { review_status: status }),
    onSuccess: () => invalidate(),
  });
  const createFollowUpMut = useMutation({
    mutationFn: () =>
      mandeApi.createFollowUp(id, {
        action: followUpAction.trim(),
        due_date: followUpDue || null,
        priority: followUpPriority,
      }),
    onSuccess: () => {
      setFollowUpAction("");
      setFollowUpDue("");
      setFollowUpPriority("normal");
      setActionMsg("Follow-up added.");
      invalidate();
    },
  });
  const completeFollowUpMut = useMutation({
    mutationFn: (followUpId: number) =>
      mandeApi.updateFollowUp(id, followUpId, { status: "completed" }),
    onSuccess: () => {
      setActionMsg("Follow-up marked complete.");
      invalidate();
    },
  });
  const deleteFollowUpMut = useMutation({
    mutationFn: (followUpId: number) => mandeApi.deleteFollowUp(id, followUpId),
    onSuccess: () => {
      setActionMsg("Follow-up deleted.");
      invalidate();
    },
  });

  const editable = report && ["not_submitted", "returned"].includes(report.review_status);
  const isNonPif = !report?.programme_id && !report?.programme;
  const setField = (key: keyof Draft, value: string) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
  };

  if (isLoading || !draft) {
    return <div className="px-5 py-10 text-sm text-neutral-400">Loading report…</div>;
  }
  if (isError || !report) {
    return (
      <div className="space-y-3">
        <Link href="/mande/activity-reports" className="text-xs text-primary hover:underline">← All reports</Link>
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">Report not found.</div>
      </div>
    );
  }

  const SECTIONS = [
    { id: "identity", label: "Identity" },
    { id: "outputs", label: "Outputs" },
    { id: "participants", label: "Participants" },
    { id: "narrative", label: "Narrative" },
    { id: "learning", label: "Learning" },
    { id: "followups", label: "Follow-ups" },
    { id: "evidence", label: "Evidence" },
    { id: "review", label: "Review" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/mande/activity-reports" className="text-xs text-primary hover:underline">← All reports</Link>
          <h1 className="page-title mt-1">{report.activity_title}</h1>
          <p className="page-subtitle font-mono text-xs">
            {report.reference_number}
            {report.programme
              ? ` · PIF ${report.programme.reference_number}`
              : isNonPif
                ? " · Non-PIF"
                : ""}
          </p>
        </div>
        <span className={`badge ${STATUS_BADGE[report.review_status] ?? "badge-muted"}`}>
          {report.review_status.replace(/_/g, " ")}
        </span>
      </div>

      {actionMsg && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">{actionMsg}</div>
      )}

      {isNonPif && (
        <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-950">
          <p className="font-semibold mb-1">Non-PIF activity report</p>
          <p className="text-sky-900/90">
            {report.non_pif_reason?.trim() || "No linked programme. Reason not recorded."}
          </p>
        </div>
      )}

      {report.review_status === "returned" && report.review_notes && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold mb-1">Returned for correction</p>
          <p>{report.review_notes}</p>
          {(report.return_section || report.return_required_action || report.correction_due_at) && (
            <ul className="mt-2 text-xs space-y-0.5">
              {report.return_section && <li>Section: {report.return_section}</li>}
              {report.return_required_action && <li>Action: {report.return_required_action}</li>}
              {report.correction_due_at && <li>Due: {formatDateShort(report.correction_due_at)}</li>}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`filter-tab ${section === s.id ? "active" : ""}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="card p-5 space-y-4">
        {section === "identity" && (
          <>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Activity title</label>
              <input
                className="form-input"
                value={draft.activity_title}
                disabled={!editable}
                onChange={(e) => setField("activity_title", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Start date</label>
                <input type="date" className="form-input" value={draft.start_date} disabled={!editable}
                  onChange={(e) => setField("start_date", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">End date</label>
                <input type="date" className="form-input" value={draft.end_date} disabled={!editable}
                  onChange={(e) => setField("end_date", e.target.value)} />
              </div>
            </div>
            {report.programme && (
              <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2 text-xs text-neutral-600">
                <p className="font-semibold text-neutral-700 mb-1">PIF (read-only)</p>
                <p>{report.programme.reference_number} — {report.programme.title}</p>
                {report.programme.strategic_pillar && <p>Pillar: {report.programme.strategic_pillar}</p>}
              </div>
            )}
            {isNonPif && (
              <div className="rounded-lg bg-sky-50 border border-sky-100 px-3 py-2 text-xs text-sky-900">
                <p className="font-semibold mb-1">Non-PIF reason</p>
                <p>{report.non_pif_reason?.trim() || "—"}</p>
              </div>
            )}
          </>
        )}

        {section === "outputs" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Planned output</label>
              <textarea className="form-input min-h-[120px]" value={draft.planned_output} disabled={!editable}
                onChange={(e) => setField("planned_output", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Actual output</label>
              <textarea className="form-input min-h-[120px]" value={draft.actual_output} disabled={!editable}
                onChange={(e) => setField("actual_output", e.target.value)} />
            </div>
          </div>
        )}

        {section === "participants" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Planned participants</label>
              <input type="number" min={0} className="form-input" value={draft.planned_participants} disabled={!editable}
                onChange={(e) => setField("planned_participants", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Actual participants</label>
              <input type="number" min={0} className="form-input" value={draft.actual_participants} disabled={!editable}
                onChange={(e) => setField("actual_participants", e.target.value)} />
            </div>
          </div>
        )}

        {section === "narrative" && (
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Narrative</label>
            <textarea className="form-input min-h-[180px]" value={draft.narrative} disabled={!editable}
              onChange={(e) => setField("narrative", e.target.value)} />
          </div>
        )}

        {section === "learning" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Challenges</label>
              <textarea className="form-input min-h-[100px]" value={draft.challenges} disabled={!editable}
                onChange={(e) => setField("challenges", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Lessons learned</label>
              <textarea className="form-input min-h-[100px]" value={draft.lessons_learned} disabled={!editable}
                onChange={(e) => setField("lessons_learned", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Recommendations</label>
              <textarea className="form-input min-h-[100px]" value={draft.recommendations} disabled={!editable}
                onChange={(e) => setField("recommendations", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Follow-up actions</label>
              <textarea className="form-input min-h-[100px]" value={draft.follow_up_actions} disabled={!editable}
                onChange={(e) => setField("follow_up_actions", e.target.value)} />
            </div>
          </div>
        )}

        {section === "followups" && (
          <div className="space-y-4">
            {canCreate && (
              <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-neutral-800">Add follow-up</p>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Action *</label>
                  <textarea
                    className="form-input min-h-[72px]"
                    value={followUpAction}
                    onChange={(e) => setFollowUpAction(e.target.value)}
                    placeholder="Describe the follow-up action"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Due date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={followUpDue}
                      onChange={(e) => setFollowUpDue(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Priority</label>
                    <select
                      className="form-input"
                      value={followUpPriority}
                      onChange={(e) => setFollowUpPriority(e.target.value as MeFollowUpPriority)}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary disabled:opacity-40"
                  disabled={followUpAction.trim().length < 2 || createFollowUpMut.isPending}
                  onClick={() => createFollowUpMut.mutate()}
                >
                  {createFollowUpMut.isPending ? "Adding…" : "Add follow-up"}
                </button>
              </div>
            )}

            {followUps.length === 0 ? (
              <p className="text-sm text-neutral-400">No follow-up actions yet.</p>
            ) : (
              <ul className="space-y-3">
                {followUps.map((fu) => (
                  <li
                    key={fu.id}
                    className="rounded-lg border border-neutral-200 px-4 py-3 flex flex-wrap items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm text-neutral-900 ${fu.status === "completed" ? "line-through text-neutral-500" : "font-medium"}`}>
                        {fu.action}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        <span className="capitalize">{fu.status.replace(/_/g, " ")}</span>
                        {" · "}
                        <span className="capitalize">{fu.priority}</span>
                        {fu.due_date && <> · Due {formatDateShort(fu.due_date)}</>}
                        {fu.assignee?.name && <> · {fu.assignee.name}</>}
                        {fu.completed_at && <> · Done {formatDateShort(fu.completed_at)}</>}
                      </p>
                      {fu.comments && <p className="text-xs text-neutral-500 mt-1">{fu.comments}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {fu.status !== "completed" && canCreate && (
                        <button
                          type="button"
                          className="text-green-700 text-xs hover:underline disabled:opacity-40"
                          disabled={completeFollowUpMut.isPending}
                          onClick={() => completeFollowUpMut.mutate(fu.id)}
                        >
                          Mark complete
                        </button>
                      )}
                      {fu.status !== "completed" && canCreate && (
                        <button
                          type="button"
                          className="text-red-600 text-xs hover:underline disabled:opacity-40"
                          disabled={deleteFollowUpMut.isPending}
                          onClick={async () => {
                            if (await confirm({ title: "Delete follow-up", message: "Delete this follow-up? This cannot be undone.", variant: "danger" })) {
                              deleteFollowUpMut.mutate(fu.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {section === "evidence" && (
          <div className="space-y-4">
            {canCreate && editable && (
              <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-neutral-800">Upload evidence</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Title</label>
                    <input className="form-input" value={evidenceTitle} onChange={(e) => setEvidenceTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">Type</label>
                    <select className="form-input" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
                      {ME_EVIDENCE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <input
                  type="file"
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
                <button
                  type="button"
                  className="btn-primary disabled:opacity-40"
                  disabled={!evidenceFile || uploadMut.isPending}
                  onClick={() => uploadMut.mutate()}
                >
                  {uploadMut.isPending ? "Uploading…" : "Upload"}
                </button>
              </div>
            )}

            {evidence.length === 0 ? (
              <p className="text-sm text-neutral-400">No evidence uploaded yet.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Title</th><th>Type</th><th>Status</th><th>Uploaded</th><th></th></tr>
                </thead>
                <tbody>
                  {evidence.map((e) => (
                    <tr key={e.id}>
                      <td className="font-medium text-neutral-900">{e.title ?? "—"}</td>
                      <td className="text-xs capitalize">{e.evidence_type}</td>
                      <td><span className="badge badge-muted">{e.review_status}</span></td>
                      <td className="text-xs text-neutral-400">{formatDateShort(e.created_at)}</td>
                      <td className="whitespace-nowrap">
                        {canReview && e.review_status === "pending" && (
                          <>
                            <button
                              type="button"
                              className="text-green-700 text-xs hover:underline mr-2"
                              onClick={() => reviewEvidenceMut.mutate({ evidenceId: e.id, status: "validated" })}
                            >
                              Validate
                            </button>
                            <button
                              type="button"
                              className="text-red-600 text-xs hover:underline"
                              onClick={() => reviewEvidenceMut.mutate({ evidenceId: e.id, status: "rejected" })}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {section === "review" && (
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-neutral-800 mb-2">History</h3>
              {history.length === 0 ? (
                <p className="text-sm text-neutral-400">No review history yet.</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li key={h.id} className="text-xs text-neutral-600 border-b border-neutral-100 pb-2">
                      <span className="font-medium">{h.change_type}</span>
                      {" · "}
                      {h.from_status ?? "—"} → {h.to_status ?? "—"}
                      {" · "}
                      {h.actor?.name ?? "System"}
                      {" · "}
                      {formatDateShort(h.created_at)}
                      {h.notes && <p className="mt-0.5 text-neutral-500">{h.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {canReview && ["submitted", "reviewed"].includes(report.review_status) && (
              <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-neutral-800">Return for correction</p>
                <textarea
                  className="form-input min-h-[80px]"
                  placeholder="Review notes *"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <input className="form-input" placeholder="Section" value={returnSection}
                    onChange={(e) => setReturnSection(e.target.value)} />
                  <input className="form-input" placeholder="Required action" value={returnAction}
                    onChange={(e) => setReturnAction(e.target.value)} />
                  <input type="date" className="form-input" value={correctionDue}
                    onChange={(e) => setCorrectionDue(e.target.value)} />
                </div>
                <button
                  type="button"
                  className="btn-secondary disabled:opacity-40"
                  disabled={returnNotes.trim().length < 3 || returnMut.isPending}
                  onClick={() => returnMut.mutate()}
                >
                  Return
                </button>
              </div>
            )}

            {canReview && ["submitted", "reviewed"].includes(report.review_status) && (
              <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-neutral-800">Accept</p>
                <textarea
                  className="form-input min-h-[60px]"
                  placeholder="Optional notes"
                  value={acceptNotes}
                  onChange={(e) => setAcceptNotes(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary disabled:opacity-40"
                  disabled={acceptMut.isPending}
                  onClick={() => acceptMut.mutate()}
                >
                  Accept report
                </button>
              </div>
            )}

            {canReview && report.review_status === "accepted" && report.closure_status !== "closed" && (
              <button
                type="button"
                className="btn-secondary disabled:opacity-40"
                disabled={closeMut.isPending}
                onClick={() => closeMut.mutate()}
              >
                Close report
              </button>
            )}
          </div>
        )}
      </div>

      {editable && canCreate && section !== "evidence" && section !== "review" && section !== "followups" && (
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            className="btn-secondary disabled:opacity-40"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            className="btn-primary disabled:opacity-40"
            disabled={submitMut.isPending || saveMut.isPending || !draft.activity_title.trim()}
            onClick={async () => {
              try {
                await saveMut.mutateAsync();
                await submitMut.mutateAsync();
              } catch {
                /* errors surfaced via mutation state */
              }
            }}
          >
            {submitMut.isPending || saveMut.isPending ? "Submitting…" : "Submit for review"}
          </button>
        </div>
      )}
    </div>
  );
}
