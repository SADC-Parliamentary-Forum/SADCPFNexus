"use client";

import Link from "next/link";
import { useState } from "react";
import { authApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const { t } = useI18n();

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
        ?? t("auth.forgot.failed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-neutral-200 shadow-sm p-8">
        <h1 className="text-xl font-bold text-neutral-900">{t("auth.forgot.title")}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {t("auth.forgot.intro")}
        </p>

        {sent && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {t("auth.forgot.sent")}
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
              {t("auth.forgot.email")}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="you@sadcpf.org" // i18n-ignore
              autoComplete="email"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 disabled:opacity-40">
            {loading ? t("auth.forgot.sending") : t("auth.forgot.send")}
          </button>
        </form>

        <p className="mt-5 text-xs text-neutral-500 text-center space-x-3">
          <Link href="/request-password" className="text-primary hover:underline font-medium">{t("auth.forgot.requestPassword")}</Link>
          <span>·</span>
          <Link href="/login" className="text-primary hover:underline font-medium">{t("auth.requestPassword.backToLogin")}</Link>
        </p>
      </div>
    </div>
  );
}

