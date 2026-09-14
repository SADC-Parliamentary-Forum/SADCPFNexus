"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { authApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export interface CaptchaValue {
  token: string;
  honeypot: string;
  verified: boolean;
}

interface Props {
  value: CaptchaValue;
  onChange: (value: CaptchaValue) => void;
}

export const EMPTY_CAPTCHA: CaptchaValue = {
  token: "",
  honeypot: "",
  verified: false,
};

export function CaptchaGate({ value, onChange }: Props) {
  const { t } = useI18n();
  const checkboxId = useId();
  const honeypotId = useId();
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await authApi.captchaConfig();
        if (cancelled) return;
        if (!response.data.enabled) {
          setEnabled(false);
          onChange({ token: "", honeypot: "", verified: true });
          return;
        }
        setEnabled(true);
      } catch {
        if (!cancelled) {
          setError(t("login.captchaFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // onChange is stable enough for mount; avoid re-fetch loops from parent identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issueToken = useCallback(async () => {
    setIssuing(true);
    setError("");
    try {
      const response = await authApi.captchaChallenge();
      const token = response.data.token ?? "";
      if (!token) {
        throw new Error("missing token");
      }
      onChange({ ...value, token, verified: true });
    } catch {
      setError(t("login.captchaFailed"));
      onChange({ ...value, token: "", verified: false });
    } finally {
      setIssuing(false);
    }
  }, [onChange, t, value]);

  if (loading) {
    return <div data-testid="captcha-gate" data-ready="false" className="sr-only">{t("common.loading")}</div>;
  }

  if (!enabled) {
    return <div data-testid="captcha-gate" data-ready="true" className="sr-only" />;
  }

  return (
    <div className="space-y-2" data-testid="captcha-gate" data-ready="true">
      <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <label htmlFor={checkboxId} className="flex items-center gap-3 text-sm text-neutral-800">
          <input
            id={checkboxId}
            type="checkbox"
            className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
            checked={value.verified}
            disabled={issuing}
            onChange={(event) => {
              if (event.target.checked) {
                void issueToken();
              } else {
                onChange({ ...value, token: "", verified: false });
              }
            }}
          />
          <span>{issuing ? t("common.loading") : t("login.captchaLabel")}</span>
        </label>
        <p className="mt-1 pl-7 text-xs text-neutral-500">{t("login.captchaHint")}</p>
      </div>
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor={honeypotId}>Website</label>
        <input
          id={honeypotId}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={value.honeypot}
          onChange={(event) => onChange({ ...value, honeypot: event.target.value })}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
