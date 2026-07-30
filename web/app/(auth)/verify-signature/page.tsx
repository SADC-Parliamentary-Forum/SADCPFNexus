"use client";

import React, { useState } from "react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

export default function PublicVerifySignaturePage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/people-authority/public/verify-signature/${encodeURIComponent(token.trim())}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message || json?.errors?.token?.[0] || "Verification failed");
      } else {
        setResult(json.data);
      }
    } catch {
      setError("Unable to reach verification service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-start justify-center p-6">
      <div className="w-full max-w-xl space-y-6 bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">SADC PF Nexus</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Document signature verification</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Enter a published verification token. Only approved metadata is shown.
          </p>
        </div>
        <form className="space-y-3" onSubmit={verify}>
          <input
            className="form-input w-full"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Verification token"
            required
          />
          <button type="submit" className="btn-primary text-sm px-4 py-2" disabled={loading || !token.trim()}>
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result ? (
          <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded p-4 overflow-auto max-h-[50vh]">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
        <Link href="/login" className="text-sm underline">Sign in</Link>
      </div>
    </div>
  );
}
