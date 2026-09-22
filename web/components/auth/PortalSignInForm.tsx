"use client";

import { useEffect, useState } from "react";
import {
  authApi,
  ensureCsrfCookie,
  setAuthCookie,
  setMustResetCookie,
  setSetupCompleteCookie,
  setPortalCookie,
  clearMustResetCookie,
  clearSetupCompleteCookie,
} from "@/lib/api";
import { writeStoredUser } from "@/lib/session";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { CaptchaGate, EMPTY_CAPTCHA, type CaptchaValue } from "@/components/auth/CaptchaGate";
import { isSupplierUser, postAuthDestination } from "@/lib/postAuthDestination";
import { isCsrfMismatch } from "@/lib/apiError";
import { loginFormErrorMessage, shouldResetLoginCaptcha } from "@/lib/loginFormError";

interface Props {
  portal: "staff" | "supplier";
  emailPlaceholder?: string;
  prefillEmail?: string;
}

export function PortalSignInForm({ portal, emailPlaceholder, prefillEmail }: Props) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [code, setCode] = useState("");
  const [captcha, setCaptcha] = useState<CaptchaValue>(EMPTY_CAPTCHA);

  useEffect(() => {
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, [prefillEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captcha.verified) {
      setError(t("login.captchaHint"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await authApi.login(
        email,
        password,
        mfaRequired ? code : undefined,
        {
          portal,
          captchaToken: captcha.token,
          honeypot: captcha.honeypot,
        },
      );
      if (response.data.mfa_required) {
        setMfaRequired(true);
        setCode("");
        return;
      }

      const user = response.data.user;
      if (!user) {
        throw new Error("Missing authenticated user payload.");
      }

      writeStoredUser(user);
      setAuthCookie();
      setPortalCookie(portal);

      if (user.must_reset_password) {
        setMustResetCookie();
        clearSetupCompleteCookie();
        window.location.href = "/reset-password";
        return;
      }
      clearMustResetCookie();

      const from = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("from") : null;
      const destination = postAuthDestination(user, from);

      if (destination === "/setup") {
        clearSetupCompleteCookie();
      } else if (user.setup_completed || isSupplierUser(user)) {
        setSetupCompleteCookie();
      }

      window.location.href = destination;
    } catch (err: unknown) {
      setError(loginFormErrorMessage(err, t));
      if (shouldResetLoginCaptcha(err)) {
        setCaptcha(EMPTY_CAPTCHA);
      }
      if (isCsrfMismatch(err)) {
        void ensureCsrfCookie(true).catch(() => undefined);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div role="alert" className="mb-5 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[16px] mt-0.5">error_outline</span>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
        <div suppressHydrationWarning>
          <label htmlFor={`${portal}-email`} className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
            {t("login.email")}
          </label>
          <input
            id={`${portal}-email`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="form-input"
            placeholder={emailPlaceholder ?? "you@example.org"}
            autoComplete="email"
            data-lpignore="true"
          />
        </div>

        <div>
          <label htmlFor={`${portal}-password`} className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
            {t("login.password")}
          </label>
          <div className="relative">
            <input
              id={`${portal}-password`}
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input pr-10"
              placeholder="••••••••"
              autoComplete="current-password"
              data-lpignore="true"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-800"
            >
              <span className="material-symbols-outlined text-[18px]">{showPw ? "visibility_off" : "visibility"}</span>
            </button>
          </div>
        </div>

        {mfaRequired && (
          <div>
            <label htmlFor={`${portal}-mfa`} className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
              {t("login.mfa")}
            </label>
            <input
              id={`${portal}-mfa`}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              className="form-input tracking-[0.35em] text-center"
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <p className="mt-2 text-xs text-neutral-600">
              {t("login.mfaHint")}
            </p>
          </div>
        )}

        <CaptchaGate value={captcha} onChange={setCaptcha} />

        <button
          type="submit"
          disabled={loading || (mfaRequired && code.length !== 6)}
          className="btn-primary w-full justify-center py-3"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
              Signing in…
            </>
          ) : mfaRequired ? t("login.verify") : t("login.submit")}
        </button>
      </form>
    </>
  );
}
