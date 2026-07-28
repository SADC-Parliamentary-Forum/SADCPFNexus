"use client";

import Link from "next/link";
import { useState } from "react";
import { authApi } from "@/lib/api";

export default function RequestPasswordPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSent(false);
    setLoading(true);
    try {
      await authApi.requestAccess({
        full_name: fullName.trim(),
        official_email: email.trim(),
        position_title: positionTitle.trim() || undefined,
        department_name: departmentName.trim() || undefined,
        supervisor_name: supervisorName.trim() || undefined,
        reason: reason.trim() || undefined,
      });
      setSent(true);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg = ax.response?.data?.message
        ?? (ax.response?.data?.errors && Object.values(ax.response.data.errors).flat()[0])
        ?? "Unable to process your request right now.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-neutral-200 shadow-sm p-8">
        <h1 className="text-xl font-bold text-neutral-900">Request a Password</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Submit an access request with your official SADC PF email. IT will follow up if your request can be processed.
        </p>

        {sent && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            If your request can be processed, further instructions will be sent to the email address provided.
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {!sent && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                Full name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
                placeholder="Jane Doe"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                Official email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="you@sadcpf.org"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                Position (optional)
              </label>
              <input
                type="text"
                value={positionTitle}
                onChange={(e) => setPositionTitle(e.target.value)}
                className="form-input"
                placeholder="Programme Officer"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                Department (optional)
              </label>
              <input
                type="text"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                className="form-input"
                placeholder="Corporate Services"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                Supervisor (optional)
              </label>
              <input
                type="text"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                className="form-input"
                placeholder="Supervisor name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                Reason (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="form-input min-h-[80px]"
                placeholder="Why do you need Nexus access?"
                maxLength={2000}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 disabled:opacity-40">
              {loading ? "Submitting..." : "Submit Access Request"}
            </button>
          </form>
        )}

        <p className="mt-5 text-xs text-neutral-500 text-center space-x-3">
          <Link href="/forgot-password" className="text-primary hover:underline font-medium">Reset password</Link>
          <span>·</span>
          <Link href="/login" className="text-primary hover:underline font-medium">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
