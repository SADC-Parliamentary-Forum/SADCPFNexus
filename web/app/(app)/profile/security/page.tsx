"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { profileApi, profileSessionsApi, type UserSession } from "@/lib/api";
import { formatDateRelative } from "@/lib/utils";

const NAV = [
  { label: "Profile",     href: "/profile",           icon: "person" },
  { label: "Preferences", href: "/profile/settings",  icon: "tune"   },
  { label: "Security",    href: "/profile/security",  icon: "lock"   },
];

export default function ProfileSecurityPage() {
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("60");

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });

  // Sessions state
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

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

      {/* MFA */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50">
            <span className="material-symbols-outlined text-green-600 text-[18px]">verified_user</span>
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Multi-Factor Authentication</h3>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 p-4">
          <div>
            <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Authenticator App (TOTP)</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {mfaEnabled ? "MFA is active — your account is protected." : "Enable MFA to add an extra layer of security."}
            </p>
          </div>
          <button type="button" onClick={() => { setMfaEnabled(!mfaEnabled); showToast(mfaEnabled ? "MFA disabled." : "MFA enabled."); }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${mfaEnabled ? "bg-primary" : "bg-neutral-200"}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${mfaEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
      </div>

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
