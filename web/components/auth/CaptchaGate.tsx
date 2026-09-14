"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

export function CaptchaGate({ value, onChange }: Props) {
  const { t } = useI18n();
  const checkboxId = useId();
  const honeypotId = useId();
  const turnstileRef = useRef<HTMLDivElement>(null);
  const honeypotRef = useRef(value.honeypot);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [driver, setDriver] = useState<"challenge" | "turnstile">("challenge");
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  honeypotRef.current = value.honeypot;

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
        setDriver(response.data.driver === "turnstile" ? "turnstile" : "challenge");
        setSiteKey(response.data.site_key);
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

  useEffect(() => {
    if (loading || !enabled || driver !== "turnstile" || !siteKey) return;
    const host = turnstileRef.current;
    if (!host) return;

    let widgetId: string | undefined;
    const scriptId = "cf-turnstile-script";

    const renderWidget = () => {
      if (!host || !window.turnstile) return;
      widgetId = window.turnstile.render(host, {
        sitekey: siteKey,
        callback: (token: string) => {
          onChange({ token, honeypot: honeypotRef.current, verified: true });
        },
        "expired-callback": () => {
          onChange({ token: "", honeypot: honeypotRef.current, verified: false });
        },
        "error-callback": () => {
          onChange({ token: "", honeypot: honeypotRef.current, verified: false });
        },
      });
    };

    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (window.turnstile) {
      renderWidget();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget);
    }

    return () => {
      script?.removeEventListener("load", renderWidget);
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
  }, [driver, enabled, loading, onChange, siteKey]);

  const issueToken = useCallback(async () => {
    setIssuing(true);
    setError("");
    try {
      const response = await authApi.captchaChallenge();
      const token = response.data.token ?? "";
      if (!token) {
        throw new Error("missing token");
      }
      onChange({ token, honeypot: honeypotRef.current, verified: true });
    } catch {
      setError(t("login.captchaFailed"));
      onChange({ token: "", honeypot: honeypotRef.current, verified: false });
    } finally {
      setIssuing(false);
    }
  }, [onChange, t]);

  if (loading) {
    return (
      <div
        data-testid="captcha-gate"
        data-ready="false"
        data-enabled="true"
        data-verified={value.verified ? "true" : "false"}
        className="sr-only"
      >
        {t("common.loading")}
      </div>
    );
  }

  if (!enabled) {
    return (
      <div
        data-testid="captcha-gate"
        data-ready="true"
        data-enabled="false"
        data-verified="true"
        className="sr-only"
      />
    );
  }

  return (
    <div
      className="space-y-2"
      data-testid="captcha-gate"
      data-ready="true"
      data-enabled="true"
      data-verified={value.verified ? "true" : "false"}
    >
      {driver === "turnstile" && siteKey ? (
        <div ref={turnstileRef} className="min-h-[65px]" />
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <label htmlFor={checkboxId} className="flex items-center gap-3 text-sm text-neutral-800">
            <input
              id={checkboxId}
              data-testid="captcha-checkbox"
              type="checkbox"
              className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
              checked={value.verified || issuing}
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
      )}
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
