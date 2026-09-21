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

type CaptchaDriver = "challenge" | "turnstile" | "hcaptcha";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
    hcaptcha?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

export function CaptchaGate({ value, onChange }: Props) {
  const { t, locale } = useI18n();
  const checkboxId = useId();
  const honeypotId = useId();
  const widgetHostRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const honeypotRef = useRef(value.honeypot);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [driver, setDriver] = useState<CaptchaDriver>("challenge");
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [configFailed, setConfigFailed] = useState(false);

  honeypotRef.current = value.honeypot;

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError("");
    setConfigFailed(false);
    try {
      const response = await authApi.captchaConfig();
      if (!response.data.enabled) {
        setEnabled(false);
        onChange({ token: "", honeypot: honeypotRef.current, verified: true });
        return;
      }
      setEnabled(true);
      const nextDriver = response.data.driver;
      setDriver(
        nextDriver === "hcaptcha" || nextDriver === "turnstile" ? nextDriver : "challenge",
      );
      setSiteKey(response.data.site_key);
    } catch {
      setEnabled(false);
      setConfigFailed(true);
      setError(t("login.captchaFailed"));
      onChange({ token: "", honeypot: honeypotRef.current, verified: false });
    } finally {
      setLoading(false);
    }
  }, [onChange, t]);

  useEffect(() => {
    void loadConfig();
    // Load once on mount; retry is explicit via loadConfig.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || !enabled || !siteKey) return;
    if (driver !== "hcaptcha" && driver !== "turnstile") return;
    const host = widgetHostRef.current;
    if (!host) return;

    const isHcaptcha = driver === "hcaptcha";
    const scriptId = isHcaptcha ? "hcaptcha-script" : "cf-turnstile-script";
    const scriptSrc = isHcaptcha
      ? "https://js.hcaptcha.com/1/api.js?render=explicit"
      : "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

    const renderWidget = () => {
      if (!host) return;
      if (isHcaptcha) {
        if (!window.hcaptcha) return;
        widgetIdRef.current = window.hcaptcha.render(host, {
          sitekey: siteKey,
          hl: locale,
          callback: (token: string) => {
            onChange({ token, honeypot: honeypotRef.current, verified: true });
          },
          "expired-callback": () => {
            onChange({ token: "", honeypot: honeypotRef.current, verified: false });
          },
          "error-callback": () => {
            onChange({ token: "", honeypot: honeypotRef.current, verified: false });
          },
          "chalexpired-callback": () => {
            onChange({ token: "", honeypot: honeypotRef.current, verified: false });
          },
        });
        return;
      }
      if (!window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(host, {
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
    const apiReady = isHcaptcha ? Boolean(window.hcaptcha) : Boolean(window.turnstile);
    if (apiReady) {
      renderWidget();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = scriptSrc;
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget);
    }

    return () => {
      script?.removeEventListener("load", renderWidget);
      const widgetId = widgetIdRef.current;
      if (widgetId && isHcaptcha && window.hcaptcha) {
        window.hcaptcha.remove(widgetId);
      }
      if (widgetId && !isHcaptcha && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
      widgetIdRef.current = undefined;
    };
  }, [driver, enabled, loading, locale, onChange, siteKey]);

  const wasVerifiedRef = useRef(false);
  useEffect(() => {
    if (driver !== "hcaptcha") {
      wasVerifiedRef.current = value.verified;
      return;
    }
    if (wasVerifiedRef.current && !value.verified && widgetIdRef.current && window.hcaptcha) {
      window.hcaptcha.reset(widgetIdRef.current);
    }
    wasVerifiedRef.current = value.verified;
  }, [driver, value.verified]);

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
        data-driver={driver}
        data-verified={value.verified ? "true" : "false"}
        className="sr-only"
      >
        {t("common.loading")}
      </div>
    );
  }

  if (configFailed) {
    return (
      <div
        className="space-y-2"
        data-testid="captcha-gate"
        data-ready="true"
        data-enabled="true"
        data-driver={driver}
        data-verified="false"
      >
        <p role="alert" className="text-xs text-red-600">{error || t("login.captchaFailed")}</p>
        <button
          type="button"
          className="text-xs font-medium text-primary-800 hover:underline"
          onClick={() => void loadConfig()}
        >
          {t("login.captchaRetry")}
        </button>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div
        data-testid="captcha-gate"
        data-ready="true"
        data-enabled="false"
        data-driver={driver}
        data-verified="true"
        className="sr-only"
      />
    );
  }

  const showWidget = (driver === "hcaptcha" || driver === "turnstile") && Boolean(siteKey);

  return (
    <div
      className="space-y-2"
      data-testid="captcha-gate"
      data-ready="true"
      data-enabled="true"
      data-driver={driver}
      data-verified={value.verified ? "true" : "false"}
    >
      {showWidget ? (
        <div ref={widgetHostRef} className="min-h-[78px]" />
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
