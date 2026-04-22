"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { readStoredUser, writeStoredUser } from "@/lib/session";

const API_BASE = "/api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface PreviewData {
  token_action: "approve" | "reject";
  expires_at: string;
  module: string;
  reference: string;
  requester: string;
  summary: string;
  approver_id: number;
}

interface SigProfile {
  type: "full" | "initials";
  status: string;
  active_version?: {
    id: number;
    image_url: string;
  } | null;
}

type PageState =
  | "loading"
  | "ready-logged-in"
  | "ready-logged-out"
  | "wrong-user"
  | "confirming"
  | "success"
  | "error"
  | "invalid";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ApprovalPageWrapper() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f5", fontFamily: "Arial" }}>
        <div style={{ textAlign: "center", color: "#9ca3af" }}>Loading…</div>
      </div>
    }>
      <ApprovalPage />
    </Suspense>
  );
}

function ApprovalPage() {
  const params = useSearchParams();
  const action = (params.get("action") ?? "approve") as "approve" | "reject";
  const token = params.get("token") ?? "";

  const [state, setState] = useState<PageState>("loading");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [authUser, setAuthUser] = useState<ReturnType<typeof readStoredUser>>(null);
  const [signature, setSignature] = useState<SigProfile | null>(null);
  const [useSignature, setUseSignature] = useState(true);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successData, setSuccessData] = useState<{ action: string; module: string; reference: string; signed: boolean } | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (!token) { setState("invalid"); return; }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    // 1. Fetch request preview (unauthenticated)
    try {
      const res = await apiFetch(`${API_BASE}/email-action/preview/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error ?? "This approval link is invalid or has expired.");
        setState("invalid");
        return;
      }
      const data: PreviewData = await res.json();
      setPreview(data);

      // 2. Check if user is logged in
      const meRes = await apiFetch(`${API_BASE}/auth/me`);
      if (!meRes.ok) {
        setState("ready-logged-out");
        return;
      }

      const user = await meRes.json();
      writeStoredUser(user);
      setAuthUser(user);

      // 3. Check if this token was issued to this user
      if (data.approver_id && data.approver_id !== user.id) {
        setState("wrong-user");
        return;
      }

      // 4. Fetch signature profile
      const sigRes = await apiFetch(`${API_BASE}/saam/profile`);
      if (sigRes.ok) {
        const profiles: SigProfile[] = await sigRes.json();
        const full = profiles.find((p) => p.type === "full" && p.status !== "revoked" && p.active_version?.image_url);
        setSignature(full ?? null);
        setUseSignature(!!full);
      }

      setState("ready-logged-in");
    } catch {
      setErrorMsg("Unable to load the approval page. Please try again.");
      setState("error");
    }
  }

  async function handleProcess() {
    if (action === "reject" && reason.trim().length < 5) {
      setReasonError("Please provide a reason (at least 5 characters).");
      return;
    }
    setReasonError("");
    setState("confirming");

    try {
      const res = await apiFetch(`${API_BASE}/email-action/process`, {
        method: "POST",
        body: JSON.stringify({
          token,
          action,
          reason: action === "reject" ? reason : undefined,
          use_signature: useSignature && !!signature,
          signature_type: "full",
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMsg(body.error ?? "Something went wrong. Please try again.");
        setState("error");
        return;
      }

      setSuccessData({
        action: body.action,
        module: body.module,
        reference: body.reference,
        signed: body.signature_recorded,
      });
      setState("success");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setState("error");
    }
  }

  function handleLoginRedirect() {
    const returnUrl = encodeURIComponent(`/approval?action=${action}&token=${token}`);
    window.location.href = `/login?from=/approval?action=${action}%26token=${token}`;
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="approval-page">
      <style>{pageStyles}</style>

      {/* Header */}
      <div className="ap-header">
        <div className="ap-logo">
          <div className="ap-logo-mark">SP</div>
          <div>
            <div className="ap-org-name">SADC Parliamentary Forum</div>
            <div className="ap-org-sub">SADC-PF Nexus</div>
          </div>
        </div>
      </div>

      <div className="ap-body">
        {/* ── Loading ── */}
        {state === "loading" && (
          <div className="ap-card ap-center">
            <div className="ap-spinner" />
            <p className="ap-muted">Loading request details…</p>
          </div>
        )}

        {/* ── Confirming ── */}
        {state === "confirming" && (
          <div className="ap-card ap-center">
            <div className="ap-spinner" />
            <p className="ap-muted">Processing your {action === "approve" ? "approval" : "rejection"}…</p>
          </div>
        )}

        {/* ── Invalid / Error ── */}
        {(state === "invalid" || state === "error") && (
          <div className="ap-card ap-center">
            <div className="ap-icon ap-icon-warn">⚠</div>
            <h1 className="ap-title">{state === "invalid" ? "Invalid Link" : "Something went wrong"}</h1>
            <p className="ap-sub">{errorMsg}</p>
            <p className="ap-hint-box">
              Log in to the SADC-PF Nexus portal and find the request in your pending approvals.
            </p>
            <a href="/approvals" className="ap-btn-outline">Go to My Approvals →</a>
          </div>
        )}

        {/* ── Wrong user ── */}
        {state === "wrong-user" && preview && (
          <div className="ap-card ap-center">
            <div className="ap-icon ap-icon-warn">⚠</div>
            <h1 className="ap-title">Not your approval</h1>
            <p className="ap-sub">
              This link was sent to a different approver. You are logged in as <strong>{authUser?.name}</strong>.
            </p>
            <p className="ap-hint-box">
              If you need to action this request, please log in with the correct account or find it via your approvals queue.
            </p>
            <a href="/approvals" className="ap-btn-outline">My Approvals →</a>
          </div>
        )}

        {/* ── Success ── */}
        {state === "success" && successData && (
          <div className="ap-card ap-center">
            <div className={`ap-icon ${successData.action === "approved" ? "ap-icon-success" : "ap-icon-reject"}`}>
              {successData.action === "approved" ? "✓" : "✗"}
            </div>
            <h1 className="ap-title">
              {successData.action === "approved" ? "Request Approved" : "Request Returned"}
            </h1>
            <p className="ap-sub">
              {successData.action === "approved"
                ? `You have approved this ${successData.module} request. The requester has been notified.`
                : `You have returned this ${successData.module} request with your comments. The requester has been notified.`}
            </p>
            {successData.signed && (
              <div className="ap-badge-signed">
                <span>✍</span> Signed with your saved signature
              </div>
            )}
            <div className="ap-detail-box">
              <div className="ap-detail-row"><span>Module</span><strong>{successData.module}</strong></div>
              <div className="ap-detail-row"><span>Reference</span><strong>{successData.reference}</strong></div>
              <div className="ap-detail-row"><span>Actioned</span><strong>{new Date().toLocaleString()}</strong></div>
            </div>
            <p className="ap-muted" style={{ marginTop: "20px", fontSize: "12px" }}>
              This action has been recorded in the audit trail. You may close this window.
            </p>
          </div>
        )}

        {/* ── Not logged in ── */}
        {state === "ready-logged-out" && preview && (
          <div className="ap-card">
            <div className="ap-module-badge">{preview.module}</div>
            <h1 className="ap-title">{preview.reference}</h1>
            <p className="ap-sub">Submitted by <strong>{preview.requester}</strong></p>

            <div className="ap-summary-box">
              {preview.summary.split("\n").map((line, i) => (
                <p key={i} className="ap-summary-line">{line}</p>
              ))}
            </div>

            <div className="ap-divider" />

            <div className="ap-login-prompt">
              <div className="ap-login-icon">✍</div>
              <div>
                <p className="ap-login-title">Sign with your saved signature</p>
                <p className="ap-login-desc">
                  Log in to use your registered signature and process this {action === "approve" ? "approval" : "rejection"} securely.
                </p>
              </div>
            </div>

            <button className="ap-btn-primary ap-full" onClick={handleLoginRedirect}>
              Log In to Sign &amp; {action === "approve" ? "Approve" : "Reject"}
            </button>
          </div>
        )}

        {/* ── Logged in ── */}
        {state === "ready-logged-in" && preview && (
          <div className="ap-card">
            {/* Greeting */}
            <div className="ap-greeting">
              <span className="ap-avatar">{authUser?.name?.charAt(0).toUpperCase()}</span>
              <span className="ap-greeting-text">
                Reviewing as <strong>{authUser?.name}</strong>
              </span>
            </div>

            <div className="ap-divider" />

            {/* Request details */}
            <div className="ap-module-badge">{preview.module}</div>
            <h1 className="ap-title">{preview.reference}</h1>
            <p className="ap-sub">Submitted by <strong>{preview.requester}</strong></p>

            <div className="ap-summary-box">
              {preview.summary.split("\n").map((line, i) => (
                <p key={i} className="ap-summary-line">{line}</p>
              ))}
            </div>

            <div className="ap-divider" />

            {/* Signature section */}
            {signature?.active_version?.image_url ? (
              <div className="ap-sig-section">
                <div className="ap-sig-header">
                  <span className="ap-sig-label">Your signature</span>
                  <label className="ap-toggle">
                    <input
                      type="checkbox"
                      checked={useSignature}
                      onChange={(e) => setUseSignature(e.target.checked)}
                    />
                    <span className="ap-toggle-track" />
                    <span className="ap-toggle-text">
                      {useSignature ? "Will be applied" : "Not applied"}
                    </span>
                  </label>
                </div>
                <div className={`ap-sig-box ${!useSignature ? "ap-sig-disabled" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signature.active_version.image_url}
                    alt="Your signature"
                    className="ap-sig-img"
                  />
                </div>
                {useSignature && (
                  <p className="ap-sig-note">
                    Your signature will be attached to the approval record.
                  </p>
                )}
              </div>
            ) : (
              <div className="ap-no-sig">
                <span>✍</span>
                <div>
                  <p>No signature on file</p>
                  <a href="/saam" target="_blank" rel="noreferrer" className="ap-link">
                    Set up your signature →
                  </a>
                </div>
              </div>
            )}

            <div className="ap-divider" />

            {/* Reject reason */}
            {action === "reject" && (
              <div className="ap-reason-section">
                <label className="ap-label" htmlFor="reason">
                  Reason for returning <span className="ap-required">*</span>
                </label>
                <textarea
                  id="reason"
                  className={`ap-textarea ${reasonError ? "ap-textarea-error" : ""}`}
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setReasonError(""); }}
                  placeholder="Describe why this request is being returned and what corrections are needed…"
                  rows={4}
                />
                {reasonError && <p className="ap-field-error">{reasonError}</p>}
              </div>
            )}

            {/* Action buttons */}
            <div className="ap-actions">
              {action === "approve" ? (
                <button className="ap-btn-approve ap-full" onClick={handleProcess}>
                  <span>✓</span>
                  {useSignature && signature ? "Sign & Approve" : "Approve"}
                </button>
              ) : (
                <button className="ap-btn-reject ap-full" onClick={handleProcess}>
                  <span>✗</span>
                  {useSignature && signature ? "Sign & Return" : "Return / Reject"}
                </button>
              )}
            </div>

            <p className="ap-footer-note">
              This action is final and will be recorded in the audit trail.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="ap-footer">
        SADC Parliamentary Forum · SADC-PF Nexus Paperless System
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .approval-page {
    font-family: 'Public Sans', Arial, sans-serif;
    min-height: 100vh;
    background: #f0f2f5;
    display: flex;
    flex-direction: column;
  }

  /* Header */
  .ap-header {
    background: #fff;
    border-bottom: 3px solid #1d85ed;
    padding: 16px 24px;
  }
  .ap-logo { display: flex; align-items: center; gap: 12px; }
  .ap-logo-mark {
    width: 40px; height: 40px;
    background: #1d85ed; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 900; font-size: 14px; font-style: italic;
    flex-shrink: 0;
  }
  .ap-org-name { font-size: 14px; font-weight: 700; color: #0f1f3d; }
  .ap-org-sub { font-size: 10px; font-weight: 600; color: #1d85ed; text-transform: uppercase; letter-spacing: 0.06em; }

  /* Body */
  .ap-body {
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 32px 16px 48px;
  }

  /* Card */
  .ap-card {
    background: #fff;
    border-radius: 16px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 2px 16px rgba(0,0,0,.07);
    padding: 32px 28px;
    width: 100%;
    max-width: 480px;
  }
  .ap-center { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }

  /* Icons */
  .ap-icon {
    width: 72px; height: 72px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; font-weight: 700;
    margin-bottom: 4px;
  }
  .ap-icon-success { background: #dcfce7; color: #16a34a; }
  .ap-icon-reject  { background: #fee2e2; color: #dc2626; }
  .ap-icon-warn    { background: #fef3c7; color: #d97706; }

  /* Typography */
  .ap-title { font-size: 20px; font-weight: 700; color: #0f1f3d; line-height: 1.3; margin-bottom: 4px; }
  .ap-sub   { font-size: 14px; color: #6b7280; line-height: 1.5; }
  .ap-muted { font-size: 13px; color: #9ca3af; }

  /* Module badge */
  .ap-module-badge {
    display: inline-block;
    background: #eff6ff; color: #1d85ed;
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
    padding: 3px 10px; border-radius: 999px;
    margin-bottom: 8px;
  }

  /* Summary box */
  .ap-summary-box {
    background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 10px; padding: 14px 16px;
    margin-top: 14px;
  }
  .ap-summary-line { font-size: 13px; color: #374151; line-height: 1.6; }

  /* Greeting */
  .ap-greeting { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .ap-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: #1d85ed; color: #fff;
    font-size: 15px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .ap-greeting-text { font-size: 13px; color: #6b7280; }
  .ap-greeting-text strong { color: #0f1f3d; }

  /* Divider */
  .ap-divider { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }

  /* Signature section */
  .ap-sig-section { margin-bottom: 4px; }
  .ap-sig-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .ap-sig-label { font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.06em; }
  .ap-sig-box {
    border: 2px solid #1d85ed; border-radius: 10px;
    background: #f8faff; padding: 16px;
    display: flex; align-items: center; justify-content: center;
    min-height: 80px; transition: opacity 0.2s;
  }
  .ap-sig-disabled { opacity: 0.3; border-color: #d1d5db; background: #f9fafb; }
  .ap-sig-img { max-height: 70px; max-width: 100%; object-fit: contain; }
  .ap-sig-note { font-size: 11px; color: #6b7280; margin-top: 6px; }

  /* Toggle */
  .ap-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .ap-toggle input { display: none; }
  .ap-toggle-track {
    width: 36px; height: 20px; border-radius: 10px; background: #d1d5db;
    position: relative; transition: background 0.2s; flex-shrink: 0;
  }
  .ap-toggle-track::after {
    content: ''; position: absolute; width: 14px; height: 14px;
    border-radius: 50%; background: #fff; top: 3px; left: 3px;
    transition: transform 0.2s;
  }
  .ap-toggle input:checked + .ap-toggle-track { background: #1d85ed; }
  .ap-toggle input:checked + .ap-toggle-track::after { transform: translateX(16px); }
  .ap-toggle-text { font-size: 11px; color: #6b7280; }

  /* No signature */
  .ap-no-sig {
    display: flex; align-items: center; gap: 12px;
    background: #fafafa; border: 1px dashed #d1d5db;
    border-radius: 10px; padding: 14px 16px;
    font-size: 13px; color: #9ca3af;
  }
  .ap-no-sig span { font-size: 22px; }
  .ap-link { font-size: 13px; color: #1d85ed; text-decoration: none; }
  .ap-link:hover { text-decoration: underline; }

  /* Reason section */
  .ap-reason-section { margin-bottom: 4px; }
  .ap-label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; }
  .ap-required { color: #dc2626; }
  .ap-textarea {
    width: 100%; border: 1px solid #d1d5db; border-radius: 8px;
    padding: 10px 12px; font-size: 14px; font-family: inherit;
    color: #0f1f3d; resize: vertical; min-height: 100px;
    outline: none; transition: border-color 0.15s;
  }
  .ap-textarea:focus { border-color: #1d85ed; box-shadow: 0 0 0 3px rgba(29,133,237,.1); }
  .ap-textarea-error { border-color: #dc2626; }
  .ap-field-error { font-size: 12px; color: #dc2626; margin-top: 4px; }

  /* Buttons */
  .ap-btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 13px 24px; border-radius: 8px; border: none;
    font-size: 15px; font-weight: 700; font-family: inherit;
    cursor: pointer; transition: background 0.15s; text-decoration: none;
  }
  .ap-btn-approve {
    background: #16a34a; color: #fff;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 13px 24px; border-radius: 8px; border: none;
    font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer;
    transition: background 0.15s;
  }
  .ap-btn-approve:hover { background: #15803d; }
  .ap-btn-reject {
    background: #dc2626; color: #fff;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 13px 24px; border-radius: 8px; border: none;
    font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer;
    transition: background 0.15s;
  }
  .ap-btn-reject:hover { background: #b91c1c; }
  .ap-btn-outline {
    display: inline-block;
    padding: 10px 20px; border-radius: 8px;
    border: 2px solid #1d85ed; color: #1d85ed;
    font-size: 14px; font-weight: 600; font-family: inherit;
    text-decoration: none; background: transparent;
    transition: background 0.15s;
  }
  .ap-btn-outline:hover { background: #eff6ff; }
  .ap-full { width: 100%; }

  /* Actions */
  .ap-actions { margin-top: 20px; }
  .ap-footer-note { font-size: 11px; color: #9ca3af; text-align: center; margin-top: 12px; }

  /* Login prompt */
  .ap-login-prompt {
    display: flex; align-items: flex-start; gap: 14px;
    background: #eff6ff; border: 1px solid #bfdbfe;
    border-radius: 10px; padding: 16px;
    margin-bottom: 20px;
  }
  .ap-login-icon { font-size: 28px; line-height: 1; }
  .ap-login-title { font-size: 14px; font-weight: 700; color: #0f1f3d; margin-bottom: 4px; }
  .ap-login-desc { font-size: 13px; color: #6b7280; line-height: 1.5; }

  /* Detail box */
  .ap-detail-box {
    background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 10px; padding: 14px 16px;
    width: 100%; margin-top: 8px;
  }
  .ap-detail-row {
    display: flex; justify-content: space-between;
    font-size: 13px; padding: 4px 0;
    border-bottom: 1px solid #f3f4f6;
  }
  .ap-detail-row:last-child { border-bottom: none; }
  .ap-detail-row span { color: #6b7280; }
  .ap-detail-row strong { color: #0f1f3d; }

  /* Signed badge */
  .ap-badge-signed {
    display: inline-flex; align-items: center; gap: 6px;
    background: #dcfce7; color: #15803d;
    font-size: 12px; font-weight: 600;
    padding: 5px 12px; border-radius: 999px;
    margin-top: 4px;
  }

  /* Hint box */
  .ap-hint-box {
    background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 8px; padding: 12px 16px;
    font-size: 13px; color: #6b7280; line-height: 1.5;
  }

  /* Spinner */
  .ap-spinner {
    width: 36px; height: 36px;
    border: 3px solid #e5e7eb;
    border-top-color: #1d85ed;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 4px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Footer */
  .ap-footer {
    text-align: center;
    padding: 16px;
    font-size: 11px; color: #9ca3af;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }
`;
