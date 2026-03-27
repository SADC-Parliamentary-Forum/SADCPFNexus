"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { correspondenceApi, saamApi, type CorrespondenceLetter, type CorrespondenceContact, type SignatureEvent } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { SigningModal } from "@/components/saam/SigningModal";

const statusSteps = ["draft", "pending_review", "pending_approval", "approved", "sent"];
const statusLabel: Record<string, string> = {
  draft: "Draft", pending_review: "Under Review", pending_approval: "Pending Approval",
  approved: "Approved", sent: "Sent", archived: "Archived",
};
const statusCls: Record<string, string> = {
  draft: "badge-muted", pending_review: "badge-warning", pending_approval: "badge-warning",
  approved: "badge-success", sent: "badge-success", archived: "badge-muted",
};
const typeLabel: Record<string, string> = {
  internal_memo: "Internal Memo", external: "External",
  diplomatic_note: "Diplomatic Note", procurement: "Procurement",
};
const priorityConfig: Record<string, { label: string; cls: string }> = {
  low: { label: "Low", cls: "text-neutral-500" }, normal: { label: "Normal", cls: "text-neutral-700" },
  high: { label: "High", cls: "text-amber-600" }, urgent: { label: "Urgent", cls: "text-red-600" },
};

interface RecipientRow { contact_id: number; type: "to" | "cc" | "bcc"; name: string; email: string; }

export default function CorrespondenceDetailPage() {
  const { id } = useParams<{ id: string }>();
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

  useEffect(() => {
    correspondenceApi
      .get(Number(id))
      .then((res) => setLetter(res.data.data))
      .catch(() => setError("Failed to load correspondence."))
      .finally(() => setLoading(false));
    // Load signing events (best-effort)
    saamApi.getEvents("correspondence", Number(id))
      .then((res) => setSigningEvents(res.data.data ?? []))
      .catch(() => {});
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
      if (successMsg) alert(successMsg);
    } catch {
      setError("Action failed. Please try again.");
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
    } catch { setError("Download failed."); }
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-neutral-400">Loading…</div>;
  }
  if (error && !letter) {
    return <div className="py-12 text-center text-sm text-red-500">{error}</div>;
  }
  if (!letter) return null;

  const stepIndex = statusSteps.indexOf(letter.status);
  const p = priorityConfig[letter.priority] ?? { label: letter.priority, cls: "text-neutral-700" };
  const currentUser = getStoredUser();
  const canCreate = isSystemAdmin(currentUser) || hasPermission(currentUser, "correspondence.create");
  const canReview = isSystemAdmin(currentUser) || hasPermission(currentUser, "correspondence.review");
  const canApprove = isSystemAdmin(currentUser) || hasPermission(currentUser, "correspondence.approve");
  const canSend = isSystemAdmin(currentUser) || hasPermission(currentUser, "correspondence.send");

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/correspondence" className="hover:text-neutral-700">Correspondence</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-900 font-medium truncate">{letter.reference_number ?? letter.title}</span>
      </div>

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
                {statusLabel[letter.status] ?? letter.status}
              </span>
            </div>
            <h1 className="text-lg font-bold text-neutral-900">{letter.title}</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{letter.subject}</p>
          </div>
          {/* Workflow Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {letter.status === "draft" && canCreate && (
              <button
                onClick={() => runAction(() => correspondenceApi.submit(letter.id), "")}
                disabled={actionLoading}
                className="btn-primary text-sm"
              >
                Submit for Review
              </button>
            )}
            {letter.status === "pending_review" && canReview && (
              <>
                <button
                  onClick={() => setSigningModal({ action: "review", stepKey: "review" })}
                  disabled={actionLoading}
                  className="btn-primary text-sm"
                >
                  Approve Review
                </button>
                <button
                  onClick={() => setSigningModal({ action: "return", stepKey: "review" })}
                  disabled={actionLoading}
                  className="btn-secondary text-sm"
                >
                  Request Changes
                </button>
              </>
            )}
            {letter.status === "pending_approval" && canApprove && (
              <button
                onClick={() => setSigningModal({ action: "approve", stepKey: "approve" })}
                disabled={actionLoading}
                className="btn-primary text-sm"
              >
                Final Approve
              </button>
            )}
            {letter.status === "approved" && canSend && (
              <button onClick={() => setShowSendModal(true)} disabled={actionLoading} className="btn-primary text-sm">
                <span className="material-symbols-outlined text-[16px] mr-1">send</span>
                Send
              </button>
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
                  {statusLabel[step] ?? step}
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
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Details</h3>
          {[
            { label: "Type", value: typeLabel[letter.type] ?? letter.type },
            { label: "Priority", value: <span className={p.cls}>{p.label}</span> },
            { label: "Language", value: letter.language.toUpperCase() },
            { label: "Direction", value: letter.direction === "outgoing" ? "Outgoing" : "Incoming" },
            { label: "Department", value: letter.department?.name ?? "—" },
            { label: "File Code", value: letter.file_code ?? "—" },
            { label: "Signatory", value: letter.signatory_code ?? "—" },
            { label: "Created by", value: letter.creator?.name ?? "—" },
            { label: "Created", value: new Date(letter.created_at).toLocaleDateString() },
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
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Document</h3>
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
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Download
                </button>
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No document attached.</p>
            )}
          </div>

          {/* Review comment */}
          {letter.review_comment && (
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Review Comment</h3>
              <p className="text-sm text-neutral-700 bg-amber-50 rounded-lg px-3 py-2">{letter.review_comment}</p>
            </div>
          )}

          {/* Recipients */}
          {(letter.recipients?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Recipients</h3>
              <div className="space-y-1.5">
                {letter.recipients!.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <span className="uppercase font-mono text-neutral-400 w-6">{r.recipient_type}</span>
                    <span className="text-neutral-700">{r.contact?.full_name ?? `Contact #${r.contact_id}`}</span>
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

      {/* Body */}
      {letter.body && (
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Cover Note</h3>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{letter.body}</p>
        </div>
      )}

      {/* Approval Chain */}
      {signingEvents.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Signing Chain</h3>
            <a
              href={`/saam/verify/correspondence/${id}`}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
              target="_blank"
            >
              Full audit trail
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
                    <span className="text-sm font-medium text-neutral-900">{e.signer?.name ?? "Unknown"}</span>
                    <span className={`badge badge-${e.action === "approve" ? "success" : e.action === "reject" ? "danger" : "warning"} text-[10px]`}>
                      {e.action}
                    </span>
                    {e.is_delegated && <span className="badge badge-muted text-[10px]">Delegated</span>}
                  </div>
                  <p className="text-xs text-neutral-400">{new Date(e.signed_at).toLocaleString()}</p>
                </div>
                {e.signature_version?.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.signature_version.image_url} alt="sig" className="max-h-8 max-w-[70px] object-contain" />
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

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-neutral-900">
              {showReviewModal === "approve" ? "Approve Review" : "Request Changes"}
            </h2>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                {showReviewModal === "reject" ? "Reason *" : "Comment (optional)"}
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={3}
                className="form-input w-full resize-none"
                placeholder={showReviewModal === "approve" ? "Optional comments…" : "Explain what needs to change…"}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowReviewModal(null)} className="btn-secondary">Cancel</button>
              <button
                disabled={actionLoading}
                onClick={() => runAction(
                  () => correspondenceApi.review(letter.id, { action: showReviewModal, comment: reviewComment }),
                  ""
                )}
                className={showReviewModal === "approve" ? "btn-primary" : "bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700"}
              >
                {actionLoading ? "Processing…" : showReviewModal === "approve" ? "Forward for Approval" : "Send Back"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-base font-semibold text-neutral-900">Send Correspondence</h2>

            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Search contacts</label>
              <input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="form-input w-full"
                placeholder="Search by name or email…"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 border border-neutral-100 rounded-xl p-2">
              {filteredContacts.length === 0 ? (
                <p className="text-xs text-neutral-400 text-center py-4">No contacts found.</p>
              ) : filteredContacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-neutral-50">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{c.full_name}</p>
                    <p className="text-xs text-neutral-400">{c.email}</p>
                  </div>
                  <div className="flex gap-1">
                    {(["to", "cc", "bcc"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => addRecipient(c, t)}
                        className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded border border-neutral-200 hover:border-primary hover:text-primary"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {recipients.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-neutral-500 mb-1">Selected ({recipients.length})</p>
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
              <button onClick={() => setShowSendModal(false)} className="btn-secondary">Cancel</button>
              <button
                disabled={actionLoading || recipients.length === 0}
                onClick={() => runAction(
                  () => correspondenceApi.send(letter.id, recipients.map((r) => ({ contact_id: r.contact_id, type: r.type }))),
                  ""
                )}
                className="btn-primary"
              >
                {actionLoading ? "Sending…" : `Send to ${recipients.length} recipient(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
