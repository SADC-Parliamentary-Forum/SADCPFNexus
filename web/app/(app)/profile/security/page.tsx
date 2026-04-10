"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { profileApi, profileSessionsApi, twoFactorApi, weeklySummaryApi, type UserSession, type WeeklySummaryPreference } from "@/lib/api";
import { formatDateRelative } from "@/lib/utils";

const NAV = [
  { label: "Profile",     href: "/profile",           icon: "person" },
  { label: "Preferences", href: "/profile/settings",  icon: "tune"   },
  { label: "Security",    href: "/profile/security",  icon: "lock"   },
];

export default function ProfileSecurityPage() {
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("60");

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qr_code_url: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [mfaActionLoading, setMfaActionLoading] = useState(false);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });

  // Sessions state
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  // Weekly summary preference state
  const [weeklyPref, setWeeklyPref] = useState<WeeklySummaryPreference | null>(null);
  const [savingWeekly, setSavingWeekly] = useState(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadSessions = async () => {
    try {
      const res = await profileSessionsApi.list();
      setSessions(res.data.data);
    } catch {
      // silently ignore — sessions section shows empty
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => { loadSessions(); }, []);

  // Load weekly summary preference
  useEffect(() => {
    weeklySummaryApi.getPreferences()
      .then((res) => setWeeklyPref(res.data.data))
      .catch(() => {});
  }, []);

  const handleSaveWeeklyPref = async () => {
    if (!weeklyPref) return;
    setSavingWeekly(true);
    try {
      const res = await weeklySummaryApi.updatePreferences({
        enabled: weeklyPref.enabled,
        detail_mode: weeklyPref.detail_mode,
      });
      setWeeklyPref(res.data.data);
      showToast("Weekly summary preferences saved.");
    } catch {
      showToast("Failed to save preferences.", "error");
    } finally {
      setSavingWeekly(false);
    }
  };

  // Load 2FA status
  useEffect(() => {
    twoFactorApi.status()
      .then((res) => setMfaEnabled(res.data.enabled))
      .catch(() => {})
      .finally(() => setMfaLoading(false));
  }, []);

  const handleStartEnable2FA = async () => {
    setMfaActionLoading(true);
    try {
      const res = await twoFactorApi.enable();
      setMfaSetup(res.data);
      setTotpCode("");
      setShowSetupModal(true);
    } catch {
      showToast("Failed to start 2FA setup.", "error");
    } finally {
      setMfaActionLoading(false);
    }
  };

  const handleConfirm2FA = async () => {
    if (totpCode.length !== 6) return;
    setMfaActionLoading(true);
    try {
      await twoFactorApi.confirm(totpCode);
      setMfaEnabled(true);
      setShowSetupModal(false);
      setMfaSetup(null);
      setTotpCode("");
      showToast("2FA enabled successfully. Your account is now more secure.");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { errors?: { code?: string[] }; message?: string } } };
      showToast(ax.response?.data?.errors?.code?.[0] ?? ax.response?.data?.message ?? "Invalid code. Try again.", "error");
    } finally {
      setMfaActionLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) return;
    setMfaActionLoading(true);
    try {
      await twoFactorApi.disable(disablePassword);
      setMfaEnabled(false);
      setShowDisableModal(false);
      setDisablePassword("");
      showToast("2FA has been disabled.");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { errors?: { password?: string[] }; message?: string } } };
      showToast(ax.response?.data?.errors?.password?.[0] ?? ax.response?.data?.message ?? "Incorrect password.", "error");
    } finally {
      setMfaActionLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { showToast("Passwords do not match.", "error"); return; }
    if (pwForm.next.length < 8) { showToast("Password must be at least 8 characters.", "error"); return; }
    setSaving(true);
    try {
      await profileApi.updatePassword(pwForm.current, pwForm.next, pwForm.confirm);
      setPwForm({ current: "", next: "", confirm: "" });
      showToast("Password changed successfully.");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string };
      const msg =
        ax.response?.data?.errors?.current_password?.[0] ??
        ax.response?.data?.message ??
        ax.message ??
        "Failed to change password.";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id: number) => {
    setRevokingId(id);
    try {
      await profileSessionsApi.revoke(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      showToast("Session revoked.");
    } catch {
      showToast("Failed to revoke session.", "error");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      await profileSessionsApi.revokeOthers();
      setSessions((prev) => prev.filter((s) => s.is_current));
      showToast("All other sessions signed out.");
    } catch {
      showToast("Failed to sign out other sessions.", "error");
    } finally {
      setRevokingOthers(false);
    }
  };

  const passwordStrength = (pw: string): { label: string; color: string; width: string } => {
    const score = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/, /.{8,}/].filter((r) => r.test(pw)).length;
    if (score <= 1) return { label: "Very Weak", color: "bg-red-500", width: "w-1/5" };
    if (score === 2) return { label: "Weak", color: "bg-orange-400", width: "w-2/5" };
    if (score === 3) return { label: "Fair", color: "bg-amber-400", width: "w-3/5" };
    if (score === 4) return { label: "Strong", color: "bg-green-400", width: "w-4/5" };
    return { label: "Very Strong", color: "bg-green-600", width: "w-full" };
  };

  const strength = pwForm.next ? passwordStrength(pwForm.next) : null;

  const deviceIcon = (device: string) =>
    device.toLowerCase().includes("iphone") || device.toLowerCase().includes("android") || device.toLowerCase().includes("mobile")
      ? "smartphone"
      : "computer";

  return (
    <div className="space-y-6 max-w-3xl">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="page-title">Security & Password</h1>
        <p className="page-subtitle">Manage your password, multi-factor authentication, and active sessions.</p>
      </div>

      {/* Sub nav */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-700">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${n.href === "/profile/security" ? "border-primary text-primary" : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"}`}>
            <span className="material-symbols-outlined text-[16px]">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </div>

      {/* Change Password */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <span className="material-symbols-outlined text-primary text-[18px]">lock_reset</span>
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Change Password</h3>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Current Password</label>
            <input type="password" required className="form-input" placeholder="••••••••" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">New Password</label>
            <input type="password" required className="form-input" placeholder="••••••••" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} />
            {strength && (
              <div className="mt-2">
                <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                </div>
                <p className={`text-xs mt-1 font-medium ${strength.color.replace("bg-", "text-")}`}>{strength.label}</p>
              </div>
            )}
            <ul className="mt-2 space-y-0.5 text-xs text-neutral-400">
              {[
                [/[A-Z]/, "One uppercase letter"],
                [/[0-9]/, "One number"],
                [/[^a-zA-Z0-9]/, "One special character"],
                [/.{8,}/, "At least 8 characters"],
              ].map(([regex, label]) => (
                <li key={label as string} className={`flex items-center gap-1.5 ${(regex as RegExp).test(pwForm.next) ? "text-green-600" : ""}`}>
                  <span className="material-symbols-outlined text-[13px]">{(regex as RegExp).test(pwForm.next) ? "check_circle" : "radio_button_unchecked"}</span>
                  {label as string}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Confirm New Password</label>
            <input type="password" required className="form-input" placeholder="••••••••" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
            {pwForm.confirm && pwForm.next !== pwForm.confirm && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || !pwForm.current || !pwForm.next || !pwForm.confirm}
              className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40">
              <span className="material-symbols-outlined text-[18px]">lock_reset</span>
              {saving ? "Changing…" : "Change Password"}
            </button>
          </div>
        </form>
      </div>

      {/* MFA / 2FA */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
            <span className="material-symbols-outlined text-green-600 text-[18px]">verified_user</span>
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Two-Factor Authentication (2FA)</h3>
        </div>

        {mfaLoading ? (
          <div className="h-16 animate-pulse rounded-xl bg-neutral-100" />
        ) : (
          <div className={`rounded-xl border p-4 flex items-start justify-between gap-4 ${mfaEnabled ? "bg-green-50 border-green-200" : "bg-neutral-50 border-neutral-200"}`}>
            <div className="flex items-start gap-3">
              <span className={`material-symbols-outlined text-[22px] mt-0.5 ${mfaEnabled ? "text-green-600" : "text-neutral-400"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                {mfaEnabled ? "verified_user" : "lock_open"}
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Authenticator App (TOTP)</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {mfaEnabled
                    ? "2FA is active — your account requires a code on every login."
                    : "Enable 2FA with Google Authenticator, Authy, or any TOTP app."}
                </p>
              </div>
            </div>
            {mfaEnabled ? (
              <button
                type="button"
                onClick={() => { setDisablePassword(""); setShowDisableModal(true); }}
                className="flex-shrink-0 text-xs font-semibold text-red-500 hover:underline"
              >
                Disable
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartEnable2FA}
                disabled={mfaActionLoading}
                className="flex-shrink-0 btn-primary py-2 px-4 text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {mfaActionLoading ? (
                  <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[14px]">add</span>
                )}
                Set Up 2FA
              </button>
            )}
          </div>
        )}

        {mfaEnabled && (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
            <span className="material-symbols-outlined text-[15px]">check_circle</span>
            Your account is protected with two-factor authentication.
          </div>
        )}
      </div>

      {/* 2FA Setup Modal */}
      {showSetupModal && mfaSetup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-white p-6 max-w-md w-full shadow-2xl border border-neutral-100 space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50">
                <span className="material-symbols-outlined text-green-600 text-[22px]">qr_code</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Set Up Two-Factor Authentication</h3>
                <p className="text-xs text-neutral-400">Scan the QR code with your authenticator app</p>
              </div>
            </div>

            <ol className="space-y-3 text-sm text-neutral-600">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold flex-shrink-0 mt-0.5">1</span>
                Install <strong className="text-neutral-900">Google Authenticator</strong>, <strong className="text-neutral-900">Authy</strong>, or any TOTP app.
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold flex-shrink-0 mt-0.5">2</span>
                Scan the QR code below, or enter the key manually.
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold flex-shrink-0 mt-0.5">3</span>
                Enter the 6-digit code from your app to confirm.
              </li>
            </ol>

            {/* QR Code using Google Charts API */}
            <div className="flex flex-col items-center gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mfaSetup.qr_code_url)}`}
                alt="2FA QR Code"
                width={180}
                height={180}
                className="rounded-lg"
              />
              <div className="text-center">
                <p className="text-[10px] text-neutral-400 uppercase tracking-wide mb-1">Manual Entry Key</p>
                <code className="text-xs font-mono text-neutral-700 bg-white border border-neutral-200 px-2 py-1 rounded select-all">
                  {mfaSetup.secret}
                </code>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Verification Code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="form-input text-center text-xl font-mono tracking-[0.5em] max-w-[160px]"
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                autoComplete="one-time-code"
              />
              <p className="text-xs text-neutral-400 mt-1">Enter the 6-digit code shown in your app.</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowSetupModal(false); setMfaSetup(null); setTotpCode(""); }}
                className="btn-secondary flex-1 py-2.5 text-sm justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm2FA}
                disabled={totpCode.length !== 6 || mfaActionLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40 transition-colors shadow-sm"
              >
                {mfaActionLoading ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                )}
                Activate 2FA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Disable Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-white p-6 max-w-sm w-full shadow-2xl border border-neutral-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
                <span className="material-symbols-outlined text-red-600 text-[22px]">no_encryption</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Disable Two-Factor Authentication</h3>
                <p className="text-xs text-neutral-400">This will reduce your account security</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600">
              Confirm your password to disable 2FA. You will no longer be required to enter a code on login.
            </p>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDisableModal(false); setDisablePassword(""); }}
                disabled={mfaActionLoading}
                className="btn-secondary flex-1 py-2.5 text-sm justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisable2FA}
                disabled={!disablePassword || mfaActionLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors shadow-sm"
              >
                {mfaActionLoading ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : null}
                Disable 2FA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session management */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
            <span className="material-symbols-outlined text-amber-600 text-[18px]">devices</span>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Active Sessions</h3>
            <p className="text-xs text-neutral-400">Devices currently signed in to your account</p>
          </div>
          {sessions.filter((s) => !s.is_current).length > 0 && (
            <button type="button" onClick={handleRevokeOthers} disabled={revokingOthers}
              className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-40">
              {revokingOthers ? "Signing out…" : "Sign out all others"}
            </button>
          )}
        </div>

        {sessionsLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-4">No active sessions found.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className={`flex items-start gap-3 rounded-xl p-3 ${s.is_current ? "bg-primary/5 border border-primary/20" : "bg-neutral-50 border border-neutral-100"}`}>
                <span className="material-symbols-outlined text-neutral-400 text-[22px] mt-0.5">
                  {deviceIcon(s.device)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{s.device}</p>
                    {s.is_current && <span className="badge badge-success text-[10px]">Current</span>}
                  </div>
                  {s.ip_address && (
                    <p className="text-xs text-neutral-400 mt-0.5">{s.ip_address}</p>
                  )}
                  <p className="text-xs text-neutral-300 mt-0.5">
                    Last active: {s.last_active_at ? formatDateRelative(s.last_active_at) : "Unknown"}
                  </p>
                </div>
                {!s.is_current && (
                  <button type="button" onClick={() => handleRevoke(s.id)} disabled={revokingId === s.id}
                    className="text-xs font-medium text-red-500 hover:underline flex-shrink-0 disabled:opacity-40">
                    {revokingId === s.id ? "Revoking…" : "Revoke"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Summary Email Preference */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
            <span className="material-symbols-outlined text-primary text-[18px]">calendar_month</span>
          </div>
          <h3 className="text-sm font-semibold text-neutral-900">Weekly Summary Emails</h3>
        </div>
        {weeklyPref ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-800">Receive weekly summary email</p>
                <p className="text-xs text-neutral-400 mt-0.5">Sent every Friday at 16:00 with your institutional summary</p>
              </div>
              <button
                type="button"
                onClick={() => setWeeklyPref({ ...weeklyPref, enabled: !weeklyPref.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${weeklyPref.enabled ? "bg-primary" : "bg-neutral-300"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${weeklyPref.enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Detail level</label>
              <select
                className="form-input max-w-xs"
                value={weeklyPref.detail_mode}
                onChange={(e) => setWeeklyPref({ ...weeklyPref, detail_mode: e.target.value as WeeklySummaryPreference["detail_mode"] })}
              >
                <option value="compact">Compact — key numbers only</option>
                <option value="standard">Standard — sections with stats</option>
                <option value="detailed">Detailed — full tables and lists</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={handleSaveWeeklyPref} disabled={savingWeekly} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-60">
                <span className="material-symbols-outlined text-[18px]">save</span>
                {savingWeekly ? "Saving…" : "Save Preference"}
              </button>
            </div>
          </div>
        ) : (
          <div className="h-20 rounded-xl bg-neutral-100 animate-pulse" />
        )}
      </div>

      {/* Session timeout */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100">
            <span className="material-symbols-outlined text-neutral-600 text-[18px]">timer</span>
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Auto Session Timeout</h3>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Sign out after inactivity</label>
          <select className="form-input max-w-xs" value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)}>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
            <option value="480">8 hours (work day)</option>
            <option value="0">Never (not recommended)</option>
          </select>
          <p className="text-xs text-neutral-400 mt-1">You will be automatically signed out after this period of inactivity.</p>
        </div>
        <div className="flex justify-end mt-4">
          <button type="button" onClick={() => showToast("Security settings saved.")}
            className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">save</span>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
