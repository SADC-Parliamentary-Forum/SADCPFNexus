"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { correspondenceApi, saamApi, type CorrespondenceLetter, type CorrespondenceContact, type SignatureEvent } from "@/lib/api";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { SigningModal } from "@/components/saam/SigningModal";
import { CreateAssignmentFromSourceModal } from "@/components/assignments/CreateAssignmentFromSourceModal";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const statusSteps = ["draft", "pending_review", "pending_approval", "approved", "sent"];
const statusLabel: Record<string, string> = {
  draft: "status.draft", pending_review: "correspondence.status.underReview", pending_approval: "correspondence.status.pendingApproval",
  approved: "status.approved", signed: "correspondence.status.signed", ready_dispatch: "correspondence.hub.readyForDispatch",
  sent: "correspondence.status.sent", archived: "correspondence.status.archived",
  pending_sg_routing: "correspondence.status.pendingSgRouting", routed: "correspondence.status.routed", in_progress: "correspondence.status.inProgress",
  responded: "correspondence.status.responded", closed: "correspondence.status.closed", voided: "correspondence.status.voided", misrouted: "correspondence.status.misrouted",
};
const statusCls: Record<string, string> = {
  draft: "badge-muted", pending_review: "badge-warning", pending_approval: "badge-warning",
  approved: "badge-success", signed: "badge-success", ready_dispatch: "badge-success",
  sent: "badge-success", archived: "badge-muted",
  pending_sg_routing: "badge-warning", routed: "badge-warning", in_progress: "badge-warning",
  responded: "badge-success", closed: "badge-muted", voided: "badge-muted", misrouted: "badge-warning",
};
const typeLabel: Record<string, string> = {
  internal_memo: "correspondence.type.internalMemo", external: "correspondence.type.external",
  diplomatic_note: "correspondence.type.diplomaticNote", procurement: "nav.procurement",
};
const priorityConfig: Record<string, { label: string; cls: string }> = {
  low: { label: "correspondence.priority.low", cls: "text-neutral-500" }, normal: { label: "correspondence.priority.normal", cls: "text-neutral-700" },
  high: { label: "correspondence.priority.high", cls: "text-amber-600" }, urgent: { label: "correspondence.priority.urgent", cls: "text-red-600" },
};

interface RecipientRow { contact_id: number; type: "to" | "cc" | "bcc"; name: string; email: string; }

// Courier tracking refresh may use a local stub; stub status is not live carrier proof.
export default function CorrespondenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { success: toastSuccess } = useToast();
  const { t } = useI18n();
  const [letter, setLetter] = useState<CorrespondenceLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [showReviewModal, setShowReviewModal] = useState<"approve" | "reject" | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [contacts, setContacts] = useState<CorrespondenceContact[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [signingModal, setSigningModal] = useState<{ action: "approve" | "reject" | "review" | "return"; stepKey: string } | null>(null);
  const [signingEvents, setSigningEvents] = useState<SignatureEvent[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [trackingBusy, setTrackingBusy] = useState<number | null>(null);
  const [notes, setNotes] = useState<Array<{ id: number; body: string; author?: { name: string } }>>([]);
  const [noteBody, setNoteBody] = useState("");
  const [ackStatus, setAckStatus] = useState<"viewed" | "accepted" | "misrouted">("viewed");
  const [registryPack, setRegistryPack] = useState<Record<string, unknown> | null>(null);

  const loadLetter = () =>
    correspondenceApi
      .get(Number(id))
      .then((res) => setLetter(res.data.data));

  useEffect(() => {
    loadLetter()
      .catch(() => setError(t("correspondence.loadFailed")))
      .finally(() => setLoading(false));
    // Load signing events (best-effort)
    saamApi.getEvents("correspondence", Number(id))
      .then((res) => setSigningEvents(res.data.data ?? []))
      .catch(() => {});
    correspondenceApi
      .listNotes(Number(id))
      .then((res) => setNotes(res.data.data ?? []))
      .catch(() => setNotes([]));
    correspondenceApi
      .registryPack(Number(id))
      .then((res) => setRegistryPack(res.data.data))
      .catch(() => setRegistryPack(null));
  }, [id]);

  useEffect(() => {
    if (showSendModal) {
      correspondenceApi.listContacts({ per_page: 200 }).then((res) => setContacts(res.data.data ?? [])).catch(() => {});
    }
  }, [showSendModal]);

  const filteredContacts = contacts.filter((c) =>
    !contactSearch ||
    c.full_name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(contactSearch.toLowerCase())
  );

  function addRecipient(contact: CorrespondenceContact, type: "to" | "cc" | "bcc") {
    if (recipients.find((r) => r.contact_id === contact.id)) return;
    setRecipients((prev) => [...prev, { contact_id: contact.id, type, name: contact.full_name, email: contact.email }]);
  }

  async function runAction(action: () => Promise<unknown>, successMsg: string) {
    setActionLoading(true);
    setError(null);
    try {
      await action();
      const res = await correspondenceApi.get(Number(id));
      setLetter(res.data.data);
      correspondenceApi.listNotes(Number(id)).then((n) => setNotes(n.data.data ?? [])).catch(() => {});
      if (successMsg) toastSuccess(successMsg);
    } catch {
      setError(t("correspondence.detail.actionFailed"));
    } finally {
      setActionLoading(false);
      setShowReviewModal(null);
      setShowSendModal(false);
    }
  }

  async function handleDownload() {
    if (!letter) return;
    try {
      const res = await correspondenceApi.download(letter.id);
      const url = window.URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = letter.original_filename ?? "correspondence.pdf";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { setError(t("correspondence.detail.downloadFailed")); }
  }

  async function handleRefreshTracking(dispatchId: number) {
    setTrackingBusy(dispatchId);
    setError(null);
    try {
      await correspondenceApi.refreshTracking(dispatchId);
      await loadLetter();
    } catch {
      setError(t("correspondence.detail.trackingFailed"));
    } finally {
      setTrackingBusy(null);
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-neutral-400">{t("common.loading")}</div>;
  }
  if (error && !letter) {
    return <div className="py-12 text-center text-sm text-red-500">{error}</div>;
  }
  if (!letter) return null;

  const stepIndex = statusSteps.indexOf(letter.status);
  const pc = priorityConfig[letter.priority];
  const p = pc ? { label: t(pc.label), cls: pc.cls } : { label: letter.priority, cls: "text-neutral-700" };
  const statusText = (s: string) => (statusLabel[s] ? t(statusLabel[s]) : s);
  const currentUser = getStoredUser();
  const canCreate = isSystemAdmin(currentUser) || hasPermission(currentUser, "correspondence.create");
  const canReview = isSystemAdmin(currentUser) || hasPermission(currentUser, "correspondence.review");
  const canApprove = isSystemAdmin(currentUser) || hasPermission(currentUser, "correspondence.approve");
  const canSend = isSystemAdmin(currentUser) || hasPermission(currentUser, "correspondence.send");

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={letter.title}
        subtitle={letter.subject}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: t("workflows.simulate.module.correspondence"), href: "/correspondence" },
              { label: letter.reference_number ?? letter.title },
            ]}
          />
        }
        meta={
          <>
            {letter.reference_number && (
              <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                {letter.reference_number}
              </span>
            )}
            <span className={`badge ${statusCls[letter.status] ?? "badge-muted"}`}>
              {statusText(letter.status)}
            </span>
          </>
        }
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {letter.reference_number && (
                <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {letter.reference_number}
                </span>
              )}
              <span className={`badge ${statusCls[letter.status] ?? "badge-muted"}`}>
                {statusText(letter.status)}
              </span>
            </div>
            <p className="text-lg font-semibold text-neutral-900">{letter.title}</p>
            <p className="text-sm text-neutral-500 mt-0.5">{letter.subject}</p>
          </div>
          {/* Workflow Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!["voided", "archived"].includes(letter.status) && (
              <button
                type="button"
                onClick={() => setShowAssignModal(true)}
                className="btn-secondary text-sm"
                title={t("correspondence.detail.createAssignmentTitle")}
              >
                <span className="material-symbols-outlined text-[16px]">assignment_ind</span>
                {t("correspondence.detail.createAssignment")}
              </button>
            )}
            {letter.status === "draft" && canCreate && (
              <>
                <button
                  onClick={() =>
                    runAction(
                      () => correspondenceApi.aiAssist(letter.id, { intent: "Draft a courteous official reply." }),
                      t("correspondence.detail.aiReady"),
                    )
                  }
                  disabled={actionLoading}
                  className="btn-secondary text-sm"
                >
                  {t("correspondence.detail.aiAssist")}
                </button>
                <button
                  onClick={() =>
                    runAction(
                      () => correspondenceApi.confirmAiAssist(letter.id),
                      t("correspondence.detail.aiConfirmed"),
                    )
                  }
                  disabled={actionLoading}
                  className="btn-secondary text-sm"
                >
                  {t("correspondence.detail.confirmAi")}
                </button>
                <button
                  onClick={() => runAction(() => correspondenceApi.submit(letter.id), "")}
                  disabled={actionLoading}
                  className="btn-primary text-sm"
                >
                  {t("correspondence.create.submitReview")}
                </button>
              </>
            )}
            {letter.status === "pending_review" && canReview && (
              <>
                <button
                  onClick={() => setSigningModal({ action: "review", stepKey: "review" })}
                  disabled={actionLoading}
                  className="btn-primary text-sm"
                >
                  {t("correspondence.detail.approveReview")}
                </button>
                <button
                  onClick={() => setSigningModal({ action: "return", stepKey: "review" })}
                  disabled={actionLoading}
                  className="btn-secondary text-sm"
                >
                  {t("correspondence.detail.requestChanges")}
                </button>
              </>
            )}
            {letter.status === "pending_approval" && canApprove && (
              <button
                onClick={() => setSigningModal({ action: "approve", stepKey: "approve" })}
                disabled={actionLoading}
                className="btn-primary text-sm"
              >
                {t("correspondence.detail.finalApprove")}
              </button>
            )}
            {letter.status === "approved" && canApprove && (
              <button
                onClick={() => runAction(() => correspondenceApi.sign(letter.id), t("correspondence.detail.signedReady"))}
                disabled={actionLoading}
                className="btn-secondary text-sm"
              >
                {t("correspondence.detail.digitalSign")}
              </button>
            )}
            {["approved", "signed", "ready_dispatch"].includes(letter.status) && canSend && (
              <button onClick={() => setShowSendModal(true)} disabled={actionLoading} className="btn-primary text-sm">
                <span className="material-symbols-outlined text-[16px] mr-1">send</span>
                {t("correspondence.detail.dispatchSend")}
              </button>
            )}
            {["pending_sg_routing", "routed", "in_progress", "sent"].includes(letter.status) && (
              <>
                <label htmlFor="correspondence-ack-status" className="sr-only">{t("correspondence.detail.acknowledgement")}</label>
                <select
                  id="correspondence-ack-status"
                  className="form-input text-sm"
                  value={ackStatus}
                  onChange={(e) => setAckStatus(e.target.value as "viewed" | "accepted" | "misrouted")}
                >
                  <option value="viewed">{t("correspondence.detail.ack.viewed")}</option>
                  <option value="accepted">{t("correspondence.detail.ack.accepted")}</option>
                  <option value="misrouted">{t("correspondence.status.misrouted")}</option>
                </select>
                <button
                  type="button"
                  onClick={() => runAction(() => correspondenceApi.acknowledge(letter.id, ackStatus), t("correspondence.detail.ackRecorded"))}
                  disabled={actionLoading}
                  className="btn-secondary text-sm"
                >
                  {t("correspondence.detail.acknowledge")}
                </button>
              </>
            )}
            {["approved", "signed", "ready_dispatch"].includes(letter.status) && (isSystemAdmin(currentUser) || hasPermission(currentUser, "correspondence.dispatch")) && (
              <button
                onClick={() => runAction(
                  () => correspondenceApi.dispatch(letter.id, { channel: "post", delivery_status: "dispatched" }),
                  t("correspondence.detail.dispatchRecorded")
                )}
                disabled={actionLoading}
                className="btn-secondary text-sm"
              >
                {t("correspondence.detail.recordDispatch")}
              </button>
            )}
            {letter.registry_reference && (
              <p className="text-xs text-neutral-500 w-full mt-1 font-mono">
                {t("correspondence.detail.registry", { ref: letter.registry_reference })}
                {letter.primary_owner?.name ? ` · ${t("correspondence.detail.ownerName", { name: letter.primary_owner.name })}` : ""}
                {letter.original_immutable_at ? ` · ${t("correspondence.detail.originalLocked")}` : ""}
                {letter.signed_immutable_at ? ` · ${t("correspondence.detail.signedLocked")}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Status timeline */}
        <div className="mt-5 flex items-center gap-0">
          {statusSteps.map((step, i) => (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className={`flex flex-col items-center gap-1 ${i <= stepIndex ? "opacity-100" : "opacity-30"}`}>
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  i < stepIndex ? "bg-green-500 text-white" :
                  i === stepIndex ? "bg-primary text-white" :
                  "bg-neutral-200 text-neutral-500"
                }`}>
                  {i < stepIndex ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
                </div>
                <span className="text-[10px] text-neutral-500 whitespace-nowrap">
                  {statusText(step)}
                </span>
              </div>
              {i < statusSteps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < stepIndex ? "bg-green-400" : "bg-neutral-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Metadata + Document */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-5 space-y-3">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t("correspondence.detail.details")}</h3>
          {[
            { label: t("correspondence.col.type"), value: typeLabel[letter.type] ? t(typeLabel[letter.type]) : letter.type },
            { label: t("correspondence.field.priority"), value: <span className={p.cls}>{p.label}</span> },
            { label: t("correspondence.field.language"), value: letter.language.toUpperCase() },
            { label: t("correspondence.col.direction"), value: letter.direction === "outgoing" ? t("correspondence.direction.outgoing") : t("correspondence.direction.incoming") },
            { label: t("correspondence.field.department"), value: letter.department?.name ?? "—" },
            { label: t("correspondence.field.fileCode"), value: letter.file_code ?? "—" },
            { label: t("correspondence.field.signatory"), value: letter.signatory_code ?? "—" },
            { label: t("correspondence.detail.createdBy"), value: letter.creator?.name ?? "—" },
            { label: t("correspondence.detail.created"), value: new Date(letter.created_at).toLocaleDateString("en-GB") },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-neutral-500">{label}</span>
              <span className="font-medium text-neutral-900">{value}</span>
            </div>
          ))}
        </div>

        <div className="card p-5 space-y-4">
          {/* Document */}
          <div>
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">{t("correspondence.detail.document")}</h3>
            {letter.original_filename ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">{letter.original_filename}</p>
                  {letter.size_bytes && (
                    <p className="text-xs text-neutral-400">{(letter.size_bytes / 1024 / 1024).toFixed(2)} MB</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="btn-secondary text-xs py-1 px-2 inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  {t("common.download")}
                </button>
              </div>
            ) : (
              <p className="text-sm text-neutral-400">{t("correspondence.detail.noDocument")}</p>
            )}
          </div>

          {/* Review comment */}
          {letter.review_comment && (
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">{t("correspondence.detail.reviewComment")}</h3>
              <p className="text-sm text-neutral-700 bg-amber-50 rounded-lg px-3 py-2">{letter.review_comment}</p>
            </div>
          )}

          {/* Recipients */}
          {(letter.recipients?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">{t("correspondence.detail.recipients")}</h3>
              <div className="space-y-1.5">
                {letter.recipients!.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <span className="uppercase font-mono text-neutral-400 w-6">{r.recipient_type}</span>
                    <span className="text-neutral-700">{r.contact?.full_name ?? t("correspondence.detail.contactNumber", { id: r.contact_id })}</span>
                    {r.email_status && (
                      <span className={`ml-auto badge ${r.email_status === "sent" ? "badge-success" : r.email_status === "failed" ? "badge-danger" : "badge-muted"}`}>
                        {r.email_status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {registryPack && (
        <div className="card p-5 space-y-3" data-testid="correspondence-registry-pack">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t("correspondence.detail.registryPack")}</h3>
          <p className="text-xs text-neutral-500">{String(registryPack.note ?? t("correspondence.detail.registryPackNote"))}</p>
          <ul className="space-y-1 text-sm">
            {((registryPack.checklist as Array<{ key: string; label: string; detected: boolean }>) ?? []).map((row) => (
              <li key={row.key} className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">{row.detected ? "check_circle" : "radio_button_unchecked"}</span>
                <span>{row.label}</span>
              </li>
            ))}
          </ul>
          <LabelledRecord value={{ live_courier: registryPack.live_courier, courier_is_stub: registryPack.courier_is_stub }} />
          {Array.isArray(registryPack.subject_files) && (registryPack.subject_files as Array<Record<string, unknown>>).length > 0 ? (
            <LabelledRecord value={{ subject_files: registryPack.subject_files }} />
          ) : null}
        </div>
      )}

      <div className="card p-5 space-y-3">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t("correspondence.detail.courierTracking")}</h3>
        <p className="text-xs text-neutral-500">
          {t("correspondence.detail.courierHint")}
        </p>
        {(letter.dispatches ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">{t("correspondence.detail.noDispatches")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-neutral-500">
                  <th className="py-2 pr-3 font-medium">{t("correspondence.field.channel")}</th>
                  <th className="py-2 pr-3 font-medium">{t("correspondence.detail.carrier")}</th>
                  <th className="py-2 pr-3 font-medium">{t("correspondence.detail.tracking")}</th>
                  <th className="py-2 pr-3 font-medium">{t("correspondence.col.status")}</th>
                  <th className="py-2 pr-3 font-medium">{t("correspondence.detail.checked")}</th>
                  <th className="py-2 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {(letter.dispatches ?? []).map((dispatch) => (
                  <tr key={dispatch.id} className="border-b border-neutral-50">
                    <td className="py-2 pr-3 capitalize">{dispatch.channel ?? "—"}</td>
                    <td className="py-2 pr-3">{dispatch.courier_carrier ?? "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {dispatch.tracking_number ?? dispatch.tracking_reference ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{dispatch.tracking_status ?? dispatch.delivery_status ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {dispatch.tracking_checked_at
                        ? new Date(dispatch.tracking_checked_at).toLocaleString("en-GB")
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={actionLoading || trackingBusy === dispatch.id}
                        onClick={() => void handleRefreshTracking(dispatch.id)}
                      >
                        {trackingBusy === dispatch.id ? t("correspondence.detail.refreshing") : t("correspondence.detail.refreshTracking")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Body */}
      {letter.body && (
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">{t("correspondence.detail.coverNote")}</h3>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{letter.body}</p>
        </div>
      )}

      <div className="card p-5 space-y-3">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t("correspondence.detail.internalNotes")}</h3>
        {notes.length === 0 ? (
          <p className="text-sm text-neutral-400">{t("correspondence.detail.noNotes")}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg border border-neutral-100 px-3 py-2">
                <p className="text-neutral-800 whitespace-pre-wrap">{note.body}</p>
                {note.author?.name ? <p className="mt-1 text-xs text-neutral-400">{note.author.name}</p> : null}
              </li>
            ))}
          </ul>
        )}
        <label htmlFor="correspondence-note" className="block text-xs font-medium text-neutral-600">
          {t("correspondence.detail.addNote")}
          <textarea
            id="correspondence-note"
            className="form-input mt-1 w-full"
            rows={3}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn-secondary text-sm disabled:opacity-60"
          disabled={actionLoading || !noteBody.trim()}
          onClick={() => {
            const body = noteBody.trim();
            if (!body) return;
            void runAction(async () => {
              await correspondenceApi.addNote(letter.id, body);
              setNoteBody("");
            }, t("correspondence.detail.noteAdded"));
          }}
        >
          {t("correspondence.detail.saveNote")}
        </button>
      </div>

      {/* Approval Chain */}
      {signingEvents.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{t("correspondence.detail.signingChain")}</h3>
            <a
              href={`/saam/verify/correspondence/${id}`}
              className="btn-secondary text-xs py-1 px-2 inline-flex items-center gap-0.5"
              target="_blank"
            >
              {t("correspondence.detail.fullAudit")}
              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
            </a>
          </div>
          <div className="divide-y divide-neutral-100">
            {signingEvents.map((e) => (
              <div key={e.id} className="px-5 py-3 flex items-center gap-3">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  e.action === "approve" ? "bg-green-100" : e.action === "reject" ? "bg-red-100" : "bg-amber-100"
                }`}>
                  <span className={`material-symbols-outlined text-[14px] ${
                    e.action === "approve" ? "text-green-600" : e.action === "reject" ? "text-red-600" : "text-amber-600"
                  }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {e.action === "approve" ? "check_circle" : e.action === "reject" ? "cancel" : "rate_review"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-900">{e.signer?.name ?? t("correspondence.detail.unknown")}</span>
                    <span className={`badge badge-${e.action === "approve" ? "success" : e.action === "reject" ? "danger" : "warning"} text-[10px]`}>
                      {e.action}
                    </span>
                    {e.is_delegated && <span className="badge badge-muted text-[10px]">{t("correspondence.detail.delegated")}</span>}
                  </div>
                  <p className="text-xs text-neutral-400">{new Date(e.signed_at).toLocaleString()}</p>
                </div>
                {e.signature_version?.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.signature_version.image_url} alt={t("correspondence.detail.signatureAlt")} className="max-h-8 max-w-[70px] object-contain" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SAAM Signing Modal */}
      {signingModal && letter && (
        <SigningModal
          isOpen={true}
          onClose={() => setSigningModal(null)}
          signableType="correspondence"
          signableId={letter.id}
          action={signingModal.action}
          stepKey={signingModal.stepKey}
          onSigned={async (event) => {
            // After signing, run the actual correspondence workflow action
            setSigningModal(null);
            const apiAction = signingModal.action === "review" ? "approve"
              : signingModal.action === "return" ? "reject"
              : signingModal.action;

            if (apiAction === "approve" && letter.status === "pending_review") {
              await runAction(
                () => correspondenceApi.review(letter.id, { action: "approve", comment: event.comment ?? undefined }),
                ""
              );
            } else if (apiAction === "reject" && letter.status === "pending_review") {
              await runAction(
                () => correspondenceApi.review(letter.id, { action: "reject", comment: event.comment ?? undefined }),
                ""
              );
            } else if (apiAction === "approve" && letter.status === "pending_approval") {
              await runAction(() => correspondenceApi.approve(letter.id), "");
            }
            // Refresh signing events
            saamApi.getEvents("correspondence", letter.id)
              .then((res) => setSigningEvents(res.data.data ?? []))
              .catch(() => {});
          }}
        />
      )}

      <CreateAssignmentFromSourceModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        sourceType="correspondence"
        sourceId={letter.id}
        sourcePurpose="action"
        defaultTitle={t("correspondence.detail.assignmentTitle", { subject: letter.subject || letter.title })}
        defaultDescription={letter.sg_instruction || letter.summary || letter.subject || letter.title}
        defaultDueDate={letter.internal_deadline ?? letter.final_deadline ?? null}
        defaultAssigneeId={letter.primary_owner_id ?? null}
        sourceConfidential={["restricted", "confidential", "highly_confidential", "privileged_legal", "hr_confidential", "finance_confidential"].includes(letter.confidentiality ?? "")}
        sourceReference={letter.reference_number ?? letter.registry_reference}
        sourceTitle={letter.subject || letter.title}
      />

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-neutral-900">
              {showReviewModal === "approve" ? t("correspondence.detail.approveReview") : t("correspondence.detail.requestChanges")}
            </h2>
            <div>
              <label htmlFor="correspondence-review-comment" className="block text-xs font-medium text-neutral-600 mb-1">
                {showReviewModal === "reject" ? t("correspondence.detail.reasonRequired") : t("correspondence.detail.commentOptional")}
              </label>
              <textarea
                id="correspondence-review-comment"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                className="form-input w-full resize-none"
                placeholder={showReviewModal === "approve" ? t("correspondence.detail.optionalComments") : t("correspondence.detail.explainChanges")}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowReviewModal(null)} className="btn-secondary">{t("common.cancel")}</button>
              <button
                disabled={actionLoading}
                onClick={() => runAction(
                  () => correspondenceApi.review(letter.id, { action: showReviewModal, comment: reviewComment }),
                  ""
                )}
                className={showReviewModal === "approve" ? "btn-primary" : "bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700"}
              >
                {actionLoading ? t("correspondence.detail.processing") : showReviewModal === "approve" ? t("correspondence.detail.forwardApproval") : t("correspondence.detail.sendBack")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-base font-semibold text-neutral-900">{t("correspondence.detail.sendTitle")}</h2>

            <div>
              <label htmlFor="correspondence-contact-search" className="block text-xs font-medium text-neutral-600 mb-1">{t("correspondence.detail.searchContacts")}</label>
              <input
                id="correspondence-contact-search"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="form-input w-full"
                placeholder={t("correspondence.detail.searchPlaceholder")}
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 border border-neutral-100 rounded-xl p-2">
              {filteredContacts.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-4">{t("correspondence.detail.noContacts")}</p>
              ) : filteredContacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-neutral-50">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{c.full_name}</p>
                    <p className="text-xs text-neutral-400">{c.email}</p>
                  </div>
                  <div className="flex gap-1">
                    {(["to", "cc", "bcc"] as const).map((rt) => (
                      <button
                        key={rt}
                        onClick={() => addRecipient(c, rt)}
                        className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded border border-neutral-200 hover:border-primary hover:text-primary"
                      >
                        {rt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {recipients.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-neutral-500 mb-1">{t("correspondence.detail.selected", { count: recipients.length })}</p>
                <div className="space-y-1">
                  {recipients.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono uppercase text-neutral-400 w-6">{r.type}</span>
                      <span className="flex-1">{r.name}</span>
                      <button onClick={() => setRecipients((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSendModal(false)} className="btn-secondary">{t("common.cancel")}</button>
              <button
                disabled={actionLoading || recipients.length === 0}
                onClick={() => runAction(
                  () => correspondenceApi.send(letter.id, recipients.map((r) => ({ contact_id: r.contact_id, type: r.type }))),
                  ""
                )}
                className="btn-primary"
              >
                {actionLoading ? t("correspondence.detail.sending") : t("correspondence.detail.sendTo", { count: recipients.length })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
