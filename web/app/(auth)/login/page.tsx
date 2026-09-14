"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  authApi,
  clearAuthCookie,
  clearMustResetCookie,
  clearSetupCompleteCookie,
  clearPortalCookie,
  ensureCsrfCookie,
} from "@/lib/api";
import { clearStoredUser } from "@/lib/session";
import { LocaleSwitcher, useI18n } from "@/lib/i18n/LocaleProvider";
import { PortalSignInForm } from "@/components/auth/PortalSignInForm";

const IS_DEV = process.env.NODE_ENV === "development";

const DEMO_CREDENTIALS = IS_DEV ? [
  { role: "System Admin",       email: "admin@sadcpf.org",   icon: "admin_panel_settings", color: "text-primary bg-primary/10 dark:bg-primary/20" },
  { role: "Secretary General",  email: "sg@sadcpf.org",      icon: "gavel",                color: "text-neutral-700 bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-200" },
  { role: "HR Manager",         email: "hr@sadcpf.org",      icon: "people",               color: "text-green-600 bg-green-50 dark:bg-green-900/20"  },
  { role: "Finance Controller", email: "finance@sadcpf.org", icon: "payments",             color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20"  },
] : [];

const FEATURES = [
  { icon: "flight_takeoff",         key: "auth.feature.travel" },
  { icon: "event_available",        key: "auth.feature.leave" },
  { icon: "account_balance_wallet", key: "auth.feature.imprest" },
  { icon: "gavel",                  key: "auth.feature.governance" },
  { icon: "people",                 key: "auth.feature.people" },
  { icon: "bar_chart",              key: "auth.feature.reports" },
];

export default function LoginPage() {
  const { t } = useI18n();
  const [showDemo, setShowDemo] = useState(false);
  const [idleNotice, setIdleNotice] = useState(false);
  const [prefillEmail, setPrefillEmail] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("reason") === "idle") {
      setIdleNotice(true);
    }
    if (sp.has("signout") || sp.get("reason") === "idle") {
      void (async () => {
        try {
          await ensureCsrfCookie();
          await authApi.logout();
        } catch {
          /* session may already be invalid */
        }
        clearAuthCookie();
        clearStoredUser();
        clearMustResetCookie();
        clearSetupCompleteCookie();
        clearPortalCookie();
        window.history.replaceState({}, "", sp.get("reason") === "idle" ? "/login?reason=idle" : "/login");
      })();
      return;
    }
    clearAuthCookie();
    clearStoredUser();
    clearPortalCookie();
  }, []);

  return (
    <div className="min-h-screen flex bg-white" suppressHydrationWarning>
      <div className="hidden lg:flex lg:w-[480px] flex-col justify-between bg-[#101922] px-12 py-14 text-white">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <img
              src="/sadcpf-logo.jpg"
              alt="SADC Parliamentary Forum"
              className="h-10 w-auto object-contain flex-shrink-0"
            />
            <div>
              <h1 className="text-lg font-bold leading-tight">SADC-PF Nexus</h1>
              <p className="text-xs text-white/70">{t("auth.platform")}</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold leading-snug mb-4">
            {t("auth.brandTitle")}
          </h2>
          <p className="text-sm text-white/70 leading-relaxed mb-10">
            {t("auth.brandDescription")}
          </p>

          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f.icon} className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <span className="material-symbols-outlined text-white/80 text-[18px]">{f.icon}</span>
                </div>
                <span className="text-sm text-white/70">{t(f.key)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs text-white/70">{t("auth.operational")}</span>
          </div>
          <p className="mt-3 text-xs text-white/70" suppressHydrationWarning>
            © {new Date().getUTCFullYear()} {t("auth.rights")}
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-surface-muted">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img
              src="/sadcpf-logo.jpg"
              alt="SADC Parliamentary Forum"
              className="h-9 w-auto object-contain flex-shrink-0"
            />
            <div>
              <h1 className="text-base font-bold text-neutral-900">SADC-PF Nexus</h1>
              <p className="text-xs text-neutral-600">{t("auth.platform")}</p>
            </div>
          </div>

          <div className="mb-8 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-800 mb-1">{t("login.staffBadge")}</p>
              <h2 className="text-2xl font-bold text-neutral-900">{t("login.staffTitle")}</h2>
              <p className="text-sm text-neutral-700 mt-1">{t("login.staffSubtitle")}</p>
            </div>
            <LocaleSwitcher />
          </div>

          {idleNotice && (
            <div className="mb-5 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
              <span className="material-symbols-outlined text-[16px] mt-0.5">timer</span>
              You were signed out after a period of inactivity.
            </div>
          )}

          <PortalSignInForm portal="staff" emailPlaceholder="you@sadcpf.org" prefillEmail={prefillEmail} />

          {IS_DEV && (
            <div className="mt-6 pt-5 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setShowDemo(!showDemo)}
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">info</span>
                {showDemo ? "Hide" : "Show"} demo login credentials
              </button>
              {showDemo && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {DEMO_CREDENTIALS.map((cred) => (
                    <button
                      key={cred.role}
                      type="button"
                      onClick={() => setPrefillEmail(cred.email)}
                      className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2.5 text-left hover:border-primary/40"
                    >
                      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${cred.color}`}>
                        <span className="material-symbols-outlined text-[14px]">{cred.icon}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-neutral-800">{cred.role}</p>
                        <p className="text-[10px] text-neutral-600 truncate">{cred.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 text-center text-xs text-neutral-700 space-y-1.5">
            <p>
              <Link href="/forgot-password" className="font-medium text-primary-800 hover:underline">
                {t("login.resetPassword")}
              </Link>
              {" "}{t("login.or")}{" "}
              <Link href="/request-password" className="font-medium text-primary-800 hover:underline">
                {t("login.requestPassword")}
              </Link>
              {" "}{t("login.forStaffAccounts")}
            </p>
            <p className="text-neutral-700">{t("login.mailboxHelp")}</p>
          </div>
          <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-center text-sm text-neutral-700">
            <p className="font-semibold text-neutral-900">{t("login.supplierPortalHeading")}</p>
            <p className="mt-1 text-xs text-neutral-600">{t("login.supplierPortalHint")}</p>
            <Link href="/supplier/login" className="mt-2 inline-flex font-medium text-primary-800 hover:underline">
              {t("login.supplierPortalLink")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
