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
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { reviewStatusLabel } from "@/lib/mandeStatusLabels";

const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  attendance: "mande.report.evidenceType.attendance",
  photo: "mande.report.evidenceType.photo",
  report: "mande.report.evidenceType.report",
  publication: "mande.report.evidenceType.publication",
  media: "mande.report.evidenceType.media",
  financial: "mande.report.evidenceType.financial",
  other: "mande.report.evidenceType.other",
};

const FOLLOW_UP_STATUS_LABEL: Record<string, string> = {
  open: "mande.report.fuStatus.open",
  in_progress: "correspondence.status.inProgress",
  completed: "mande.report.fuStatus.completed",
  cancelled: "mande.reviewStatus.cancelled",
};

const EVIDENCE_STATUS_LABEL: Record<string, string> = {
  pending: "status.pending",
  validated: "mande.report.evStatus.validated",
  rejected: "status.rejected",
};

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
  const toast = useToast();
  const { t } = useI18n();
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
      setActionMsg(t("mande.report.draftSavedMsg"));
      toast.success(t("mande.report.draftSaved"));
      invalidate();
    },
    onError: (err) => toast.error(t("mande.report.draftNotSaved"), apiErrorMessage(err, t("mande.report.draftFailed"))),
  });

  const submitMut = useMutation({
    mutationFn: () => mandeApi.submitReport(id),
    onSuccess: () => { setActionMsg(t("mande.report.submittedMsg")); toast.success(t("mande.report.submitted")); invalidate(); },
    onError: (err) => toast.error(t("mande.report.notSubmitted"), apiErrorMessage(err, t("mande.report.submitFailed"))),
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
      setActionMsg(t("mande.report.returnedMsg"));
      toast.success(t("mande.report.returned"));
      setReturnNotes("");
      invalidate();
    },
    onError: (err) => toast.error(t("mande.pmReview.notReturned"), apiErrorMessage(err, t("mande.pmReview.returnFailed"))),
  });
  const acceptMut = useMutation({
    mutationFn: () => mandeApi.acceptReport(id, { review_notes: acceptNotes || undefined }),
    onSuccess: () => { setActionMsg(t("mande.report.acceptedMsg")); toast.success(t("mande.report.accepted")); invalidate(); },
    onError: (err) => toast.error(t("mande.report.notAccepted"), apiErrorMessage(err, t("mande.report.acceptFailed"))),
  });
  const closeMut = useMutation({
    mutationFn: () => mandeApi.closeReport(id),
    onSuccess: () => { setActionMsg(t("mande.report.closedMsg")); toast.success(t("mande.report.closed")); invalidate(); },
    onError: (err) => toast.error(t("mande.report.notClosed"), apiErrorMessage(err, t("mande.report.closeFailed"))),
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
      setActionMsg(t("mande.report.evidenceUploadedMsg"));
      toast.success(t("mande.report.evidenceUploaded"));
      invalidate();
    },
    onError: (err) => toast.error(t("mande.report.evidenceNotUploaded"), apiErrorMessage(err, t("mande.report.evidenceUploadFailed"))),
  });
  const reviewEvidenceMut = useMutation({
    mutationFn: ({ evidenceId, status }: { evidenceId: number; status: "validated" | "rejected" }) =>
      mandeApi.reviewEvidence(id, evidenceId, { review_status: status }),
    onSuccess: (_data, vars) => {
      toast.success(vars.status === "validated" ? t("mande.report.evidenceValidated") : t("mande.report.evidenceRejected"));
      invalidate();
    },
    onError: (err) => toast.error(t("mande.report.evidenceReviewNotSaved"), apiErrorMessage(err, t("mande.report.evidenceReviewFailed"))),
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
      setActionMsg(t("mande.report.followUpAddedMsg"));
      toast.success(t("mande.report.followUpAdded"));
      invalidate();
    },
    onError: (err) => toast.error(t("mande.report.followUpNotAdded"), apiErrorMessage(err, t("mande.report.followUpAddFailed"))),
  });
  const completeFollowUpMut = useMutation({
    mutationFn: (followUpId: number) =>
      mandeApi.updateFollowUp(id, followUpId, { status: "completed" }),
    onSuccess: () => {
      setActionMsg(t("mande.report.followUpCompleteMsg"));
      toast.success(t("mande.report.followUpComplete"));
      invalidate();
    },
    onError: (err) => toast.error(t("mande.report.followUpCompleteTitle"), apiErrorMessage(err, t("mande.report.followUpCompleteFailed"))),
  });
  const deleteFollowUpMut = useMutation({
    mutationFn: (followUpId: number) => mandeApi.deleteFollowUp(id, followUpId),
    onSuccess: () => {
      setActionMsg(t("mande.report.followUpDeletedMsg"));
      toast.success(t("mande.report.followUpDeleted"));
      invalidate();
    },
    onError: (err) => toast.error(t("mande.report.followUpNotDeleted"), apiErrorMessage(err, t("mande.report.followUpDeleteFailed"))),
  });

  const editable = report && ["not_submitted", "returned"].includes(report.review_status);
  const isNonPif = !report?.programme_id && !report?.programme;
  const setField = (key: keyof Draft, value: string) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
  };

  if (isLoading || !draft) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title={t("mande.report.title")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.mande", href: "/mande" }, { label: t("mande.activityReports.title"), href: "/mande/activity-reports" }, { label: t("mande.intake.report") }]} />}
        />
        <p className="text-sm text-neutral-400">{t("mande.report.loading")}</p>
      </div>
    );
  }
  if (isError || !report) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <ModulePageHeader
          title={t("mande.report.title")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.mande", href: "/mande" }, { label: t("mande.activityReports.title"), href: "/mande/activity-reports" }, { label: t("mande.intake.report") }]} />}
        />
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{t("mande.report.notFound")}</div>
        <Link href="/mande/activity-reports" className="btn-secondary text-sm">{t("mande.report.back")}</Link>
      </div>
    );
  }

  const SECTIONS = [
    { id: "identity", label: t("mande.report.tab.identity") },
    { id: "outputs", label: t("mande.report.tab.outputs") },
    { id: "participants", label: t("mande.reports.participants") },
    { id: "narrative", label: t("mande.report.tab.narrative") },
    { id: "learning", label: t("mande.report.tab.learning") },
    { id: "followups", label: t("mande.report.tab.followups") },
    { id: "evidence", label: t("mande.report.tab.evidence") },
    { id: "review", label: t("mande.report.tab.review") },
  ];

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={report.activity_title}
        subtitle={`${report.reference_number}${report.programme ? ` · ${t("mande.report.pifRef", { ref: report.programme.reference_number })}` : isNonPif ? ` · ${t("mande.report.nonPifShort")}` : ""}`}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.mande", href: "/mande" },
              { label: t("mande.activityReports.title"), href: "/mande/activity-reports" },
              { label: report.activity_title },
            ]}
          />
        }
        meta={
          <span className={`badge ${STATUS_BADGE[report.review_status] ?? "badge-muted"}`}>
            {reviewStatusLabel(t, report.review_status)}
          </span>
        }
      />

      {actionMsg && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">{actionMsg}</div>
      )}

      {isNonPif && (
        <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-950">
          <p className="font-semibold mb-1">{t("mande.create.nonPif")}</p>
          <p className="text-sky-900/90">
            {report.non_pif_reason?.trim() || t("mande.report.noReason")}
          </p>
        </div>
      )}

      {report.review_status === "returned" && report.review_notes && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold mb-1">{t("mande.report.returnedTitle")}</p>
          <p>{report.review_notes}</p>
          {(report.return_section || report.return_required_action || report.correction_due_at) && (
            <ul className="mt-2 text-xs space-y-0.5">
              {report.return_section && <li>{t("mande.report.sectionValue", { value: report.return_section })}</li>}
              {report.return_required_action && <li>{t("mande.report.actionValue", { value: report.return_required_action })}</li>}
              {report.correction_due_at && <li>{t("imprest.detail.due", { date: formatDateShort(report.correction_due_at) })}</li>}
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
              <label htmlFor="me-activity-title" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.report.activityTitle")}</label>
              <input
                id="me-activity-title"
                className="form-input"
                value={draft.activity_title}
                disabled={!editable}
                onChange={(e) => setField("activity_title", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="me-start-date" className="block text-xs font-semibold text-neutral-700 mb-1">{t("common.startDate")}</label>
                <input id="me-start-date" type="date" className="form-input" value={draft.start_date} disabled={!editable}
                  onChange={(e) => setField("start_date", e.target.value)} />
              </div>
              <div>
                <label htmlFor="me-end-date" className="block text-xs font-semibold text-neutral-700 mb-1">{t("common.endDate")}</label>
                <input id="me-end-date" type="date" className="form-input" value={draft.end_date} disabled={!editable}
                  onChange={(e) => setField("end_date", e.target.value)} />
              </div>
            </div>
            {report.programme && (
              <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2 text-xs text-neutral-600">
                <p className="font-semibold text-neutral-700 mb-1">{t("mande.report.pifReadOnly")}</p>
                <p>{report.programme.reference_number} — {report.programme.title}</p>
                {report.programme.strategic_pillar && <p>{t("mande.report.pillarValue", { value: report.programme.strategic_pillar })}</p>}
              </div>
            )}
            {isNonPif && (
              <div className="rounded-lg bg-sky-50 border border-sky-100 px-3 py-2 text-xs text-sky-900">
                <p className="font-semibold mb-1">{t("mande.report.nonPifReason")}</p>
                <p>{report.non_pif_reason?.trim() || "—"}</p>
              </div>
            )}
          </>
        )}

        {section === "outputs" && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="me-planned-output" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.report.plannedOutput")}</label>
              <textarea id="me-planned-output" className="form-input min-h-[120px]" value={draft.planned_output} disabled={!editable}
                onChange={(e) => setField("planned_output", e.target.value)} />
            </div>
            <div>
              <label htmlFor="me-actual-output" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.report.actualOutput")}</label>
              <textarea id="me-actual-output" className="form-input min-h-[120px]" value={draft.actual_output} disabled={!editable}
                onChange={(e) => setField("actual_output", e.target.value)} />
            </div>
          </div>
        )}

        {section === "participants" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="me-planned-participants" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.report.plannedParticipants")}</label>
              <input id="me-planned-participants" type="number" min={0} className="form-input" value={draft.planned_participants} disabled={!editable}
                onChange={(e) => setField("planned_participants", e.target.value)} />
            </div>
            <div>
              <label htmlFor="me-actual-participants" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.report.actualParticipants")}</label>
              <input id="me-actual-participants" type="number" min={0} className="form-input" value={draft.actual_participants} disabled={!editable}
                onChange={(e) => setField("actual_participants", e.target.value)} />
            </div>
          </div>
        )}

        {section === "narrative" && (
          <div>
            <label htmlFor="me-narrative" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.report.narrative")}</label>
            <textarea id="me-narrative" className="form-input min-h-[180px]" value={draft.narrative} disabled={!editable}
              onChange={(e) => setField("narrative", e.target.value)} />
          </div>
        )}

        {section === "learning" && (
          <div className="space-y-4">
            <div>
              <label htmlFor="me-challenges" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.report.challenges")}</label>
              <textarea id="me-challenges" className="form-input min-h-[100px]" value={draft.challenges} disabled={!editable}
                onChange={(e) => setField("challenges", e.target.value)} />
            </div>
            <div>
              <label htmlFor="me-lessons" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.report.lessons")}</label>
              <textarea id="me-lessons" className="form-input min-h-[100px]" value={draft.lessons_learned} disabled={!editable}
                onChange={(e) => setField("lessons_learned", e.target.value)} />
            </div>
            <div>
              <label htmlFor="me-recommendations" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.report.recommendations")}</label>
              <textarea id="me-recommendations" className="form-input min-h-[100px]" value={draft.recommendations} disabled={!editable}
                onChange={(e) => setField("recommendations", e.target.value)} />
            </div>
            <div>
              <label htmlFor="me-follow-up-actions" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.report.followUpActions")}</label>
              <textarea id="me-follow-up-actions" className="form-input min-h-[100px]" value={draft.follow_up_actions} disabled={!editable}
                onChange={(e) => setField("follow_up_actions", e.target.value)} />
            </div>
          </div>
        )}

        {section === "followups" && (
          <div className="space-y-4">
            {canCreate && (
              <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-neutral-800">{t("mande.report.addFollowUp")}</p>
                <div>
                  <label htmlFor="me-fu-action" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.report.actionRequired")}</label>
                  <textarea
                    id="me-fu-action"
                    className="form-input min-h-[72px]"
                    value={followUpAction}
                    onChange={(e) => setFollowUpAction(e.target.value)}
                    placeholder={t("mande.report.followUpPlaceholder")}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label htmlFor="me-fu-due" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.report.dueDate")}</label>
                    <input
                      id="me-fu-due"
                      type="date"
                      className="form-input"
                      value={followUpDue}
                      onChange={(e) => setFollowUpDue(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="me-fu-priority" className="block text-xs font-semibold text-neutral-700 mb-1">{t("correspondence.field.priority")}</label>
                    <select
                      id="me-fu-priority"
                      className="form-input"
                      value={followUpPriority}
                      onChange={(e) => setFollowUpPriority(e.target.value as MeFollowUpPriority)}
                    >
                      <option value="low">{t("correspondence.priority.low")}</option>
                      <option value="normal">{t("correspondence.priority.normal")}</option>
                      <option value="high">{t("correspondence.priority.high")}</option>
                      <option value="urgent">{t("correspondence.priority.urgent")}</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary disabled:opacity-40"
                  disabled={followUpAction.trim().length < 2 || createFollowUpMut.isPending}
                  onClick={() => createFollowUpMut.mutate()}
                >
                  {createFollowUpMut.isPending ? t("mande.report.adding") : t("mande.report.addFollowUp")}
                </button>
              </div>
            )}

            {followUps.length === 0 ? (
              <p className="text-sm text-neutral-400">{t("mande.report.noFollowUps")}</p>
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
                        <span className="capitalize">{FOLLOW_UP_STATUS_LABEL[fu.status] ? t(FOLLOW_UP_STATUS_LABEL[fu.status]) : fu.status.replace(/_/g, " ")}</span>
                        {" · "}
                        <span className="capitalize">{["low", "normal", "high", "urgent"].includes(fu.priority) ? t(`correspondence.priority.${fu.priority}`) : fu.priority}</span>
                        {fu.due_date && <> · {t("mande.report.dueOn", { date: formatDateShort(fu.due_date) })}</>}
                        {fu.assignee?.name && <> · {fu.assignee.name}</>}
                        {fu.completed_at && <> · {t("mande.report.doneOn", { date: formatDateShort(fu.completed_at) })}</>}
                      </p>
                      {fu.comments && <p className="text-xs text-neutral-500 mt-1">{fu.comments}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {fu.status !== "completed" && canCreate && (
                        <button
                          type="button"
                          className="btn-secondary text-xs disabled:opacity-40"
                          disabled={completeFollowUpMut.isPending}
                          onClick={() => completeFollowUpMut.mutate(fu.id)}
                        >
                          {t("mande.report.markComplete")}
                        </button>
                      )}
                      {fu.status !== "completed" && canCreate && (
                        <button
                          type="button"
                          className="btn-secondary text-xs text-red-600 disabled:opacity-40"
                          disabled={deleteFollowUpMut.isPending}
                          onClick={async () => {
                            if (await confirm({ title: t("mande.report.deleteFollowUpTitle"), message: t("mande.report.deleteFollowUpMessage"), variant: "danger" })) {
                              deleteFollowUpMut.mutate(fu.id);
                            }
                          }}
                        >
                          {t("common.delete")}
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
                <p className="text-sm font-semibold text-neutral-800">{t("mande.report.uploadEvidence")}</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label htmlFor="me-evidence-title" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.col.title")}</label>
                    <input id="me-evidence-title" className="form-input" value={evidenceTitle} onChange={(e) => setEvidenceTitle(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="me-evidence-type" className="block text-xs font-semibold text-neutral-700 mb-1">{t("correspondence.col.type")}</label>
                    <select id="me-evidence-type" className="form-input" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)}>
                      {ME_EVIDENCE_TYPES.map((et) => (
                        <option key={et.value} value={et.value}>{EVIDENCE_TYPE_LABEL[et.value] ? t(EVIDENCE_TYPE_LABEL[et.value]) : et.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <input
                  type="file"
                  onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                  className="text-sm"
                  aria-label={t("mande.report.evidenceFile")}
                />
                <button
                  type="button"
                  className="btn-primary disabled:opacity-40"
                  disabled={!evidenceFile || uploadMut.isPending}
                  onClick={() => uploadMut.mutate()}
                >
                  {uploadMut.isPending ? t("mande.report.uploading") : t("common.upload")}
                </button>
              </div>
            )}

            {evidence.length === 0 ? (
              <p className="text-sm text-neutral-400">{t("mande.report.noEvidence")}</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>{t("mande.col.title")}</th><th>{t("correspondence.col.type")}</th><th>{t("correspondence.col.status")}</th><th>{t("mande.report.uploaded")}</th><th></th></tr>
                </thead>
                <tbody>
                  {evidence.map((e) => (
                    <tr key={e.id}>
                      <td className="font-medium text-neutral-900">{e.title ?? "—"}</td>
                      <td className="text-xs capitalize">{EVIDENCE_TYPE_LABEL[e.evidence_type] ? t(EVIDENCE_TYPE_LABEL[e.evidence_type]) : e.evidence_type}</td>
                      <td><span className="badge badge-muted">{EVIDENCE_STATUS_LABEL[e.review_status] ? t(EVIDENCE_STATUS_LABEL[e.review_status]) : e.review_status}</span></td>
                      <td className="text-xs text-neutral-400">{formatDateShort(e.created_at)}</td>
                      <td className="whitespace-nowrap">
                        {canReview && e.review_status === "pending" && (
                          <>
                            <button
                              type="button"
                              className="btn-secondary text-xs mr-2"
                              onClick={() => reviewEvidenceMut.mutate({ evidenceId: e.id, status: "validated" })}
                            >
                              {t("mande.report.validate")}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary text-xs text-red-600"
                              onClick={() => reviewEvidenceMut.mutate({ evidenceId: e.id, status: "rejected" })}
                            >
                              {t("common.reject")}
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
              <h3 className="text-sm font-semibold text-neutral-800 mb-2">{t("mande.report.history")}</h3>
              {history.length === 0 ? (
                <p className="text-sm text-neutral-400">{t("mande.report.noHistory")}</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li key={h.id} className="text-xs text-neutral-600 border-b border-neutral-100 pb-2">
                      <span className="font-medium">{h.change_type}</span>
                      {" · "}
                      {h.from_status ? reviewStatusLabel(t, h.from_status) : "—"} → {h.to_status ? reviewStatusLabel(t, h.to_status) : "—"}
                      {" · "}
                      {h.actor?.name ?? t("mande.report.system")}
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
                <p className="text-sm font-semibold text-neutral-800">{t("mande.report.returnForCorrection")}</p>
                <textarea
                  className="form-input min-h-[80px]"
                  placeholder={t("mande.report.reviewNotes")}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <input className="form-input" placeholder={t("mande.reports.section")} value={returnSection}
                    onChange={(e) => setReturnSection(e.target.value)} />
                  <input className="form-input" placeholder={t("mande.report.requiredAction")} value={returnAction}
                    onChange={(e) => setReturnAction(e.target.value)} />
                  <input type="date" className="form-input" aria-label={t("mande.report.correctionDue")} value={correctionDue}
                    onChange={(e) => setCorrectionDue(e.target.value)} />
                </div>
                <button
                  type="button"
                  className="btn-secondary disabled:opacity-40"
                  disabled={returnNotes.trim().length < 3 || returnMut.isPending}
                  onClick={() => returnMut.mutate()}
                >
                  {t("common.return")}
                </button>
              </div>
            )}

            {canReview && ["submitted", "reviewed"].includes(report.review_status) && (
              <div className="rounded-lg border border-neutral-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-neutral-800">{t("mande.report.acceptTitle")}</p>
                <textarea
                  className="form-input min-h-[60px]"
                  placeholder={t("mande.report.optionalNotes")}
                  value={acceptNotes}
                  onChange={(e) => setAcceptNotes(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary disabled:opacity-40"
                  disabled={acceptMut.isPending}
                  onClick={() => acceptMut.mutate()}
                >
                  {t("mande.report.acceptReport")}
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
                {t("mande.report.closeReport")}
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
            {saveMut.isPending ? t("correspondence.saving") : t("mande.report.saveDraft")}
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
            {submitMut.isPending || saveMut.isPending ? t("imprest.create.submitting") : t("mande.report.submitReview")}
          </button>
        </div>
      )}
    </div>
  );
}
