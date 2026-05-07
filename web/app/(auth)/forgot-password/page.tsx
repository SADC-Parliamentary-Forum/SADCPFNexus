"use client";

import Link from "next/link";
import { useState } from "react";
import { authApi } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSent(false);
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
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
        <h1 className="text-xl font-bold text-neutral-900">Reset or Request Password</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Enter your account email (staff or supplier). We will send reset instructions.
        </p>

        {sent && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            If an account exists for this email, reset instructions have been sent.
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
              Email address
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
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 disabled:opacity-40">
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <p className="mt-5 text-xs text-neutral-500 text-center">
          <Link href="/login" className="text-primary hover:underline font-medium">Back to login</Link>
        </p>
      </div>
    </div>
  );
}

