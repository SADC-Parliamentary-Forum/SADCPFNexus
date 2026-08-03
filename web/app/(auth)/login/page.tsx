"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  authApi,
  clearAuthCookie,
  clearMustResetCookie,
  clearSetupCompleteCookie,
  ensureCsrfCookie,
  setAuthCookie,
  setMustResetCookie,
  setSetupCompleteCookie,
} from "@/lib/api";
import { clearStoredUser, writeStoredUser } from "@/lib/session";
import { LocaleSwitcher, useI18n } from "@/lib/i18n/LocaleProvider";
import { MFA_SETUP_PATH, requiresPrivilegedMfaSetup } from "@/lib/privilegedMfa";
import { safeInternalPath } from "@/lib/safeInternalPath";

const IS_DEV = process.env.NODE_ENV === "development";

const DEMO_CREDENTIALS = IS_DEV ? [
  { role: "System Admin",       email: "admin@sadcpf.org",   icon: "admin_panel_settings", color: "text-purple-600 bg-purple-50" },
  { role: "Secretary General",  email: "sg@sadcpf.org",      icon: "gavel",                color: "text-neutral-700 bg-neutral-100" },
  { role: "HR Manager",         email: "hr@sadcpf.org",      icon: "people",               color: "text-green-600 bg-green-50"  },
  { role: "Finance Controller", email: "finance@sadcpf.org", icon: "payments",             color: "text-amber-600 bg-amber-50"  },
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [code, setCode] = useState("");

  // `signout` query: middleware allows `/login` so we can wipe cookies — otherwise
  // authenticated users incomplete on setup were redirected `/login` → `/setup` forever.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("signout")) {
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
        window.history.replaceState({}, "", "/login");
      })();
      return;
    }
    clearAuthCookie();
    clearStoredUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await authApi.login(email, password, mfaRequired ? code : undefined);
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

      if (user.must_reset_password) {
        setMustResetCookie();
        clearSetupCompleteCookie();
        // Don't set setup cookie yet — setup runs after password reset
        window.location.href = "/reset-password";
        return;
      }
      clearMustResetCookie();

      // Privileged roles must enable MFA before using the app (matches API middleware).
      if (requiresPrivilegedMfaSetup(user)) {
        if (user.setup_completed) {
          setSetupCompleteCookie();
        } else {
          clearSetupCompleteCookie();
        }
        window.location.href = MFA_SETUP_PATH;
        return;
      }

      if (user.setup_completed) {
        setSetupCompleteCookie();
        const from = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("from") : null;
        const isSupplier = (user.roles ?? []).some((role) => ["Supplier", "Supplier Finance User"].includes(role));
        window.location.href = safeInternalPath(from) ?? (isSupplier ? "/supplier" : "/dashboard");
      } else {
        // setup_completed = false → go to wizard (sadcpf_setup_complete cookie NOT set)
        clearSetupCompleteCookie();
        window.location.href = "/setup";
      }
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } }; status?: number };
      const data = ax.response?.data;
      const msg = data?.message
        ?? (data?.errors?.code ? data.errors.code[0] : null)
        ?? (data?.errors?.email ? data.errors.email[0] : null)
        ?? (data?.errors?.password ? data.errors.password[0] : null)
        ?? (ax.response?.status === 422 ? "Invalid credentials. Please check your email and password." : null)
        ?? "Login failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (cred: { email: string }) => {
    setEmail(cred.email);
    setError("");
  };

  return (
    <div className="min-h-screen flex bg-white" suppressHydrationWarning>
      {/* Left panel – branding */}
      <div className="hidden lg:flex lg:w-[480px] flex-col justify-between bg-[#101922] px-12 py-14 text-white">
        {/* Logo */}
        <div>
          <div className="flex items-center gap-3 mb-12">
            <img
              src="/sadcpf-logo.jpg"
              alt="SADC Parliamentary Forum"
              className="h-10 w-auto object-contain flex-shrink-0"
            />
            <div>
              <h1 className="text-lg font-bold leading-tight">SADC-PF Nexus</h1>
              <p className="text-xs text-white/40">{t("auth.platform")}</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold leading-snug mb-4">
            {t("auth.brandTitle")}
          </h2>
          <p className="text-sm text-white/60 leading-relaxed mb-10">
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

        {/* Footer */}
        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs text-white/50">{t("auth.operational")}</span>
          </div>
          <p className="mt-3 text-xs text-white/30" suppressHydrationWarning>
            {/* Use UTC year so SSR (Node) and the browser agree — local getFullYear()
                can differ across timezones at year boundaries and trigger React #418. */}
            © {new Date().getUTCFullYear()} {t("auth.rights")}
          </p>
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-surface-muted">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img
              src="/sadcpf-logo.jpg"
              alt="SADC Parliamentary Forum"
              className="h-9 w-auto object-contain flex-shrink-0"
            />
            <div>
              <h1 className="text-base font-bold text-neutral-900">SADC-PF Nexus</h1>
              <p className="text-xs text-neutral-400">{t("auth.platform")}</p>
            </div>
          </div>

          <div className="mb-8 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900">{t("login.title")}</h2>
              <p className="text-sm text-neutral-500 mt-1">{t("login.subtitle")}</p>
            </div>
            <LocaleSwitcher />
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <span className="material-symbols-outlined text-[16px] mt-0.5">error_outline</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
            <div suppressHydrationWarning>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                {t("login.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
                placeholder="you@sadcpf.org"
                autoComplete="email"
                data-lpignore="true"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                {t("login.password")}
              </label>
              <div className="relative">
                <input
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <span className="material-symbols-outlined text-[18px]">{showPw ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            {mfaRequired && (
              <div>
                <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                  {t("login.mfa")}
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  className="form-input tracking-[0.35em] text-center"
                  placeholder="000000"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                <p className="mt-2 text-xs text-neutral-400">
                  {t("login.mfaHint")}
                </p>
              </div>
            )}

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

          {/* Demo credentials — development only, stripped from production build */}
          {IS_DEV && (
            <div className="mt-6 pt-5 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setShowDemo(!showDemo)}
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
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
                      onClick={() => fillDemo(cred)}
                      className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-2.5 text-left hover:border-primary/40 hover:shadow-sm transition-all"
                    >
                      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${cred.color}`}>
                        <span className="material-symbols-outlined text-[14px]">{cred.icon}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-neutral-800">{cred.role}</p>
                        <p className="text-[10px] text-neutral-400 truncate">{cred.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-6 text-center text-xs text-neutral-500 space-y-1.5">
            <p>
              <Link href="/forgot-password" className="font-medium text-primary hover:underline">
                {t("login.resetPassword")}
              </Link>
              {" "}{t("login.or")}{" "}
              <Link href="/request-password" className="font-medium text-primary hover:underline">
                {t("login.requestPassword")}
              </Link>
              {" "}{t("login.forAccounts")}
            </p>
            <p className="text-neutral-400">{t("login.mailboxHelp")}</p>
          </div>
          <div className="mt-3 text-center text-xs text-neutral-500">
            {t("login.supplierOnboarding")}{" "}
            <Link href="/supplier/register" className="font-medium text-primary hover:underline">
              {t("login.supplierRegister")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
