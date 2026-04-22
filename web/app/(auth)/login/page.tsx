"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  authApi,
  clearAuthCookie,
  clearMustResetCookie,
  clearSetupCompleteCookie,
  setAuthCookie,
  setMustResetCookie,
  setSetupCompleteCookie,
} from "@/lib/api";
import { clearStoredUser, writeStoredUser } from "@/lib/session";

const IS_DEV = process.env.NODE_ENV === "development";

const DEMO_CREDENTIALS = IS_DEV ? [
  { role: "System Admin",       email: "admin@sadcpf.org",   icon: "admin_panel_settings", color: "text-purple-600 bg-purple-50" },
  { role: "Secretary General",  email: "sg@sadcpf.org",      icon: "gavel",                color: "text-neutral-700 bg-neutral-100" },
  { role: "HR Manager",         email: "hr@sadcpf.org",      icon: "people",               color: "text-green-600 bg-green-50"  },
  { role: "Finance Controller", email: "finance@sadcpf.org", icon: "payments",             color: "text-amber-600 bg-amber-50"  },
] : [];

const FEATURES = [
  { icon: "flight_takeoff",        label: "Travel & Mission Management"  },
  { icon: "event_available",       label: "Leave & Attendance Tracking"  },
  { icon: "account_balance_wallet",label: "Imprest & Finance Control"    },
  { icon: "gavel",                 label: "Governance & Compliance"      },
  { icon: "people",                label: "HR, Payroll & Assets"         },
  { icon: "bar_chart",             label: "Reports & Executive Analytics"},
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [code, setCode] = useState("");

  // Defensive: any time the user lands on /login, drop client-side auth
  // artifacts. Prevents the proxy middleware from bouncing the user away
  // from /login when a stale `sadcpf_authenticated` cookie or cached user
  // is left over from a previous session that has since expired server-side.
  useEffect(() => {
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
      if (user.setup_completed) {
        setSetupCompleteCookie();
        const from = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("from") : null;
        const isSupplier = (user.roles ?? []).some((role) => ["Supplier", "Supplier Finance User"].includes(role));
        window.location.href = from && from.startsWith("/") ? from : (isSupplier ? "/supplier" : "/dashboard");
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
    <div className="min-h-screen flex bg-white">
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
              <p className="text-xs text-white/40">Institutional Operations Platform</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold leading-snug mb-4">
            Secure governance<br />for Southern Africa
          </h2>
          <p className="text-sm text-white/60 leading-relaxed mb-10">
            A unified platform for parliamentary operations, finance, HR, and compliance across the SADC Parliamentary Forum.
          </p>

          <div className="space-y-3">
            {FEATURES.map((f) => (
              <div key={f.icon} className="flex items-center gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <span className="material-symbols-outlined text-white/80 text-[18px]">{f.icon}</span>
                </div>
                <span className="text-sm text-white/70">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs text-white/50">All systems operational</span>
          </div>
          <p className="mt-3 text-xs text-white/30">
            © {new Date().getFullYear()} SADC Parliamentary Forum. All rights reserved.
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
              <p className="text-xs text-neutral-400">Institutional Operations Platform</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-neutral-900">Welcome back</h2>
            <p className="text-sm text-neutral-500 mt-1">Sign in to your account to continue.</p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <span className="material-symbols-outlined text-[16px] mt-0.5">error_outline</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-2">
                Email address
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
                Password
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
                  Verification Code
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
                  Enter the 6-digit code from your authenticator app to finish signing in.
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
              ) : mfaRequired ? "Verify & Sign in" : "Sign in"}
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

          <p className="mt-6 text-center text-xs text-neutral-400">
            Forgot your password? Contact IT Support.
          </p>
          <p className="mt-3 text-center text-xs text-neutral-500">
            Supplier onboarding:
            {" "}
            <Link href="/supplier/register" className="font-medium text-primary hover:underline">
              Register your supplier account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
