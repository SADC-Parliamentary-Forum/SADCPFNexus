"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authApi, clearMustResetCookie, clearSetupCompleteCookie, setSetupCompleteCookie } from "@/lib/api";
import { readStoredUser, writeStoredUser } from "@/lib/session";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const isTokenResetFlow = Boolean(token && email);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { t } = useI18n();

  const passwordStrength = (pw: string): { label: string; color: string; width: string } => {
    const score = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/, /.{8,}/].filter((r) => r.test(pw)).length;
    if (score <= 1) return { label: "auth.reset.strength.veryWeak",   color: "bg-red-500",    width: "w-1/5"  };
    if (score === 2) return { label: "auth.reset.strength.weak",        color: "bg-orange-400", width: "w-2/5"  };
    if (score === 3) return { label: "auth.reset.strength.fair",        color: "bg-amber-400",  width: "w-3/5"  };
    if (score === 4) return { label: "auth.reset.strength.strong",      color: "bg-green-400",  width: "w-4/5"  };
    return              { label: "auth.reset.strength.veryStrong", color: "bg-green-600",  width: "w-full" };
  };

  const strength = password ? passwordStrength(password) : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") ?? "");
    setEmail(params.get("email") ?? "");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError(t("auth.reset.mismatch")); return; }
    if (password.length < 8)  { setError(t("auth.reset.tooShort")); return; }
    setSaving(true);
    try {
      if (isTokenResetFlow) {
        await authApi.resetPassword(token, email, password, confirm);
        clearMustResetCookie();
        clearSetupCompleteCookie();
        window.location.href = "/login";
      } else {
        await authApi.forceResetPassword(password, confirm);
        clearMustResetCookie();
        const storedUser = readStoredUser();
        if (storedUser) {
          writeStoredUser({ ...storedUser, must_reset_password: false });
        }
        if (storedUser?.setup_completed || (storedUser?.roles ?? []).some((role) => ["Supplier", "Supplier Finance User"].includes(role))) {
          setSetupCompleteCookie();
          window.location.href = (storedUser?.roles ?? []).some((role) => ["Supplier", "Supplier Finance User"].includes(role))
            ? "/supplier"
            : "/dashboard";
        } else {
          clearSetupCompleteCookie();
          window.location.href = "/setup";
        }
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg =
        ax.response?.data?.errors?.password?.[0] ??
        ax.response?.data?.message ??
        t("auth.reset.failed");
      setError(msg);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sadcpf-logo.jpg"
            alt={t("auth.reset.logoAlt")}
            className="h-10 w-auto object-contain"
          />
          <div>
            <p className="text-base font-bold text-neutral-900 leading-tight">SADC-PF Nexus</p>{/* i18n-ignore */}
            <p className="text-xs text-neutral-400">{t("auth.platform")}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50">
              <span className="material-symbols-outlined text-amber-600 text-[22px]">lock_reset</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-900">{t("auth.reset.title")}</h1>
              <p className="text-sm text-neutral-500 mt-0.5">
                {isTokenResetFlow
                  ? t("auth.reset.tokenIntro")
                  : t("auth.reset.forceIntro")}
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <span className="material-symbols-outlined text-[16px] mt-0.5">error_outline</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New password */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                {t("auth.reset.newPassword")}
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="form-input pr-10"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? t("auth.reset.hide") : t("auth.reset.show")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <span className="material-symbols-outlined text-[18px]">{showPw ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
              {strength && (
                <div className="mt-2">
                  <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                  </div>
                  <p className={`text-xs mt-1 font-medium ${strength.color.replace("bg-", "text-")}`}>{t(strength.label)}</p>
                </div>
              )}
              <ul className="mt-2 space-y-0.5 text-xs text-neutral-400">
                {([
                  [/[A-Z]/,          "auth.reset.rule.upper"],
                  [/[0-9]/,          "auth.reset.rule.number"],
                  [/[^a-zA-Z0-9]/,   "auth.reset.rule.special"],
                  [/.{8,}/,          "auth.reset.rule.length"],
                ] as [RegExp, string][]).map(([regex, label]) => (
                  <li key={label} className={`flex items-center gap-1.5 ${regex.test(password) ? "text-green-600" : ""}`}>
                    <span className="material-symbols-outlined text-[13px]">
                      {regex.test(password) ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    {t(label)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                {t("auth.reset.confirm")}
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="form-input pr-10"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? t("auth.reset.hide") : t("auth.reset.show")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <span className="material-symbols-outlined text-[18px]">{showConfirm ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
              {confirm && password !== confirm && (
                <p className="text-xs text-red-500 mt-1">{t("auth.reset.mismatchInline")}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || !password || !confirm || password !== confirm}
              className="btn-primary w-full justify-center py-3 mt-2 disabled:opacity-40"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  {t("auth.reset.saving")}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                  {t("auth.reset.submit")}
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-neutral-400">
          {isTokenResetFlow ? (
            <Link href="/login" className="text-primary hover:underline">{t("auth.requestPassword.backToLogin")}</Link>
          ) : (
            t("auth.reset.help")
          )}
        </p>
      </div>
    </div>
  );
}
