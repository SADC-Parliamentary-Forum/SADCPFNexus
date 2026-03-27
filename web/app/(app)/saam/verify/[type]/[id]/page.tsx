"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { saamApi, type SignatureEvent, type SignedDocument } from "@/lib/api";

const actionConfig: Record<string, { label: string; cls: string; icon: string }> = {
  approve:     { label: "Approved",     cls: "badge-success", icon: "check_circle" },
  reject:      { label: "Rejected",     cls: "badge-danger",  icon: "cancel" },
  review:      { label: "Reviewed",     cls: "badge-warning", icon: "rate_review" },
  return:      { label: "Returned",     cls: "badge-muted",   icon: "undo" },
  acknowledge: { label: "Acknowledged", cls: "badge-primary", icon: "visibility" },
};

export default function VerifyPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [events, setEvents] = useState<SignatureEvent[]>([]);
  const [signedDoc, setSignedDoc] = useState<SignedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      saamApi.getEvents(type, Number(id)),
      saamApi.getSignedDocument(type, Number(id)),
    ])
      .then(([evRes, docRes]) => {
        setEvents(evRes.data.data ?? []);
        setSignedDoc(docRes.data.data ?? null);
      })
      .catch(() => setError("Failed to load signing data."))
      .finally(() => setLoading(false));
  }, [type, id]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await saamApi.generateDocument(type, Number(id));
      setSignedDoc(res.data.data);
    } catch {
      setError("Failed to generate document.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    if (!signedDoc) return;
    try {
      const res = await saamApi.downloadDocument(signedDoc.id);
      const url = window.URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `signed_document_v${signedDoc.version}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Download failed.");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/correspondence" className="hover:text-primary transition-colors capitalize">{type}</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Signing Audit Trail</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Document Verification</h1>
          <p className="page-subtitle capitalize">{type} #{id} — signing chain &amp; authentication record</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {events.length > 0 && !signedDoc && (
            <button onClick={handleGenerate} disabled={generating} className="btn-secondary text-sm flex items-center gap-1.5">
              {generating ? (
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              )}
              {generating ? "Generating…" : "Generate PDF"}
            </button>
          )}
          {signedDoc && (
            <button onClick={handleDownload} className="btn-primary text-sm flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">download</span>
              Download Signed PDF
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Signed document info */}
      {signedDoc && (
        <div className="card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-green-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-900">Signed Document v{signedDoc.version}</p>
            <p className="text-xs text-neutral-400 font-mono truncate">SHA-256: {signedDoc.hash}</p>
            <p className="text-xs text-neutral-400">Finalised: {new Date(signedDoc.finalized_at).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Approval chain */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Approval &amp; Signing Chain</h2>
          <p className="text-xs text-neutral-400">{events.length} event{events.length !== 1 ? "s" : ""} recorded</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-neutral-400">Loading…</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-400">No signing events recorded yet.</div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {events.map((event, idx) => {
              const cfg = actionConfig[event.action] ?? { label: event.action, cls: "badge-muted", icon: "task_alt" };
              return (
                <div key={event.id} className="px-5 py-4 flex items-start gap-4">
                  {/* Step number */}
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-neutral-900">{event.signer?.name ?? "Unknown"}</span>
                      {event.signer?.job_title && (
                        <span className="text-xs text-neutral-400">{event.signer.job_title}</span>
                      )}
                      <span className={`badge ${cfg.cls} flex items-center gap-0.5`}>
                        <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                        {cfg.label}
                      </span>
                      {event.is_delegated && (
                        <span className="badge badge-warning text-[10px]">Acting under delegation</span>
                      )}
                    </div>

                    {event.step_key && (
                      <p className="text-xs text-neutral-500">Step: <span className="font-medium capitalize">{event.step_key}</span></p>
                    )}

                    {event.comment && (
                      <p className="text-sm text-neutral-700 bg-neutral-50 rounded-lg px-3 py-2">{event.comment}</p>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-neutral-400">
                        {new Date(event.signed_at).toLocaleString()}
                      </span>
                      <span className="text-xs text-neutral-400">
                        Auth: <span className="font-medium capitalize">{event.auth_level}</span>
                      </span>
                      {event.document_hash && (
                        <span className="text-xs text-neutral-300 font-mono truncate max-w-[160px]">
                          doc hash: {event.document_hash.slice(0, 16)}…
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Signature thumbnail */}
                  {event.signature_version?.image_url && (
                    <div className="flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={event.signature_version.image_url}
                        alt="signature"
                        className="max-h-10 max-w-[90px] object-contain border border-neutral-100 rounded-lg p-1 bg-white"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Integrity notice */}
      <div className="flex items-start gap-2 text-xs text-neutral-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <span className="material-symbols-outlined text-blue-500 text-[16px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
        <span>All signing events are recorded in an immutable audit log with SHA-256 hash chaining. Document hashes are computed at the time of signing.</span>
      </div>
    </div>
  );
}
