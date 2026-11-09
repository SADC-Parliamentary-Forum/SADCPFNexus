"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { isCompleteSecondFactor, normalizeSecondFactorInput } from "@/lib/secondFactorInput";
import { profileApi, profileSessionsApi, twoFactorApi, weeklySummaryApi, type UserSession, type WeeklySummaryPreference } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { readStoredUser, writeStoredUser } from "@/lib/session";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { requiresPrivilegedMfaSetup } from "@/lib/privilegedMfa";
import { formatDateRelative } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { accountProfilePath } from "@/lib/postAuthDestination";

function accountNav(profileHref: string, t: (key: string) => string) {
  return [
    { label: t("profile.account.profile"), href: profileHref, icon: "person" },
    { label: t("profile.account.preferences"), href: "/profile/settings", icon: "tune" },
    { label: t("profile.account.security"), href: "/profile/security", icon: "lock" },
  ];
}

export default function ProfileSecurityPage() {
  const { success, error, info } = useToast();
  const { t } = useI18n();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("120");
  const [savingTimeout, setSavingTimeout] = useState(false);
  const [forceMfaBanner, setForceMfaBanner] = useState(false);
  const [mfaJustEnabled, setMfaJustEnabled] = useState(false);

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qr_code_url: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  // Recovery codes are returned once (on activation / regeneration) and never again.
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryRemaining, setRecoveryRemaining] = useState<number | null>(null);
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenPassword, setRegenPassword] = useState("");
  const [regenCode, setRegenCode] = useState("");
  const [mfaActionLoading, setMfaActionLoading] = useState(false);
  const [profileHref, setProfileHref] = useState("/profile");

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });

  // Sessions state
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  // Weekly summary preference state
  const [weeklyPref, setWeeklyPref] = useState<WeeklySummaryPreference | null>(null);
  const [savingWeekly, setSavingWeekly] = useState(false);


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

  useEffect(() => {
    setProfileHref(accountProfilePath(readStoredUser()));
  }, []);

  // Load weekly summary preference after MFA status is known (avoid 403 noise while gated).
  useEffect(() => {
    if (mfaLoading) return;
    if (forceMfaBanner && !mfaEnabled) return;
    weeklySummaryApi.getPreferences()
      .then((res) => setWeeklyPref(res.data.data))
      .catch(() => {});
  }, [mfaLoading, forceMfaBanner, mfaEnabled]);

  const handleSaveWeeklyPref = async () => {
    if (!weeklyPref) return;
    setSavingWeekly(true);
    try {
      const res = await weeklySummaryApi.updatePreferences({
        enabled: weeklyPref.enabled,
        detail_mode: weeklyPref.detail_mode,
      });
      setWeeklyPref(res.data.data);
      success(t("profile.security.weeklySaved"));
    } catch {
      error(t("profile.security.saveFailed"));
    } finally {
      setSavingWeekly(false);
    }
  };

  // Load 2FA status
  useEffect(() => {
    const stored = getStoredUser();
    twoFactorApi.status()
      .then((res) => {
        setMfaEnabled(res.data.enabled);
        setRecoveryRemaining(res.data.recovery_codes_remaining ?? null);
        setForceMfaBanner(
          requiresPrivilegedMfaSetup({
            roles: stored?.roles,
            mfa_enabled: res.data.enabled,
          })
        );
      })
      .catch(() => {
        setForceMfaBanner(
          requiresPrivilegedMfaSetup({
            roles: stored?.roles,
            mfa_enabled: stored?.mfa_enabled,
          })
        );
      })
      .finally(() => setMfaLoading(false));
  }, []);

  useEffect(() => {
    profileApi.get()
      .then((res) => {
        const minutes = res.data.idle_timeout_minutes;
        setSessionTimeout(minutes === null || minutes === undefined ? "120" : String(minutes));
      })
      .catch(() => {});
  }, []);

  const handleSaveIdleTimeout = async () => {
    setSavingTimeout(true);
    try {
      const minutes = Number(sessionTimeout);
      const res = await profileApi.updateIdleTimeout(minutes);
      const stored = readStoredUser();
      if (stored) {
        writeStoredUser({ ...stored, idle_timeout_minutes: res.data.data.idle_timeout_minutes });
      }
      success(t("profile.security.timeoutSaved"));
    } catch {
      error(t("profile.security.timeoutFailed"));
    } finally {
      setSavingTimeout(false);
    }
  };

  const handleStartEnable2FA = async () => {
    setMfaActionLoading(true);
    try {
      const res = await twoFactorApi.enable();
      setMfaSetup(res.data);
      setTotpCode("");
      setShowSetupModal(true);
    } catch {
      error(t("profile.security.setupFailed"));
    } finally {
      setMfaActionLoading(false);
    }
  };

  const handleConfirm2FA = async () => {
    if (totpCode.length !== 6) return;
    setMfaActionLoading(true);
    try {
      const res = await twoFactorApi.confirm(totpCode);
      setRecoveryCodes(res.data.recovery_codes ?? null);
      setRecoveryRemaining(res.data.recovery_codes?.length ?? null);
      setMfaEnabled(true);
      setForceMfaBanner(false);
      setMfaJustEnabled(true);
      setShowSetupModal(false);
      setMfaSetup(null);
      setTotpCode("");
      const stored = readStoredUser();
      if (stored) {
        writeStoredUser({ ...stored, mfa_enabled: true });
      }
      success(t("profile.security.enabledToast"));
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { errors?: { code?: string[] }; message?: string } } };
      error(ax.response?.data?.errors?.code?.[0] ?? ax.response?.data?.message ?? t("profile.security.invalidCode"));
    } finally {
      setMfaActionLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword || !isCompleteSecondFactor(disableCode)) return;
    setMfaActionLoading(true);
    try {
      await twoFactorApi.disable(disablePassword, disableCode);
      setMfaEnabled(false);
      setRecoveryRemaining(null);
      setShowDisableModal(false);
      setDisablePassword("");
      setDisableCode("");
      success(t("profile.security.disabledToast"));
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { errors?: { password?: string[]; code?: string[] }; message?: string } } };
      const errors = ax.response?.data?.errors;
      error(errors?.password?.[0] ?? errors?.code?.[0] ?? ax.response?.data?.message ?? t("profile.security.disableFailed"));
    } finally {
      setMfaActionLoading(false);
    }
  };

  const handleRegenerateRecoveryCodes = async () => {
    if (!regenPassword || !/^\d{6}$/.test(regenCode)) return;
    setMfaActionLoading(true);
    try {
      const res = await twoFactorApi.regenerateRecoveryCodes(regenPassword, regenCode);
      setRecoveryCodes(res.data.recovery_codes);
      setRecoveryRemaining(res.data.recovery_codes.length);
      setShowRegenModal(false);
      setRegenPassword("");
      setRegenCode("");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { errors?: { password?: string[]; code?: string[] }; message?: string } } };
      const errors = ax.response?.data?.errors;
      error(errors?.password?.[0] ?? errors?.code?.[0] ?? ax.response?.data?.message ?? t("profile.security.regenFailed"));
    } finally {
      setMfaActionLoading(false);
    }
  };

  const handleCopyRecoveryCodes = async () => {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      success(t("profile.security.codesCopied"));
    } catch {
      error(t("profile.security.copyFailed"));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { error(t("auth.reset.mismatch")); return; }
    if (pwForm.next.length < 8) { error(t("auth.reset.tooShort")); return; }
    setSaving(true);
    try {
      await profileApi.updatePassword(pwForm.current, pwForm.next, pwForm.confirm);
      setPwForm({ current: "", next: "", confirm: "" });
      success(t("profile.passwordUpdatedBody"));
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string };
      const msg =
        ax.response?.data?.errors?.current_password?.[0] ??
        ax.response?.data?.message ??
        ax.message ??
        t("profile.security.pwChangeFailed");
      error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id: number) => {
    setRevokingId(id);
    try {
      await profileSessionsApi.revoke(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      success(t("profile.security.sessionRevoked"));
    } catch {
      error(t("profile.security.revokeFailed"));
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      await profileSessionsApi.revokeOthers();
      setSessions((prev) => prev.filter((s) => s.is_current));
      success(t("profile.security.othersSignedOut"));
    } catch {
      error(t("profile.security.othersFailed"));
    } finally {
      setRevokingOthers(false);
    }
  };

  const passwordStrength = (pw: string): { label: string; color: string; width: string } => {
    const score = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/, /.{8,}/].filter((r) => r.test(pw)).length;
    if (score <= 1) return { label: t("auth.reset.strength.veryWeak"), color: "bg-red-500", width: "w-1/5" };
    if (score === 2) return { label: t("auth.reset.strength.weak"), color: "bg-orange-400", width: "w-2/5" };
    if (score === 3) return { label: t("auth.reset.strength.fair"), color: "bg-amber-400", width: "w-3/5" };
    if (score === 4) return { label: t("auth.reset.strength.strong"), color: "bg-green-400", width: "w-4/5" };
    return { label: t("auth.reset.strength.veryStrong"), color: "bg-green-600", width: "w-full" };
  };

  const strength = pwForm.next ? passwordStrength(pwForm.next) : null;

  const deviceIcon = (device: string) =>
    device.toLowerCase().includes("iphone") || device.toLowerCase().includes("android") || device.toLowerCase().includes("mobile")
      ? "smartphone"
      : "computer";

  return (
    <div className="w-full min-w-0 space-y-6">

      <ModulePageHeader
        title={t("header.security")}
        subtitle={t("profile.security.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("header.security") }]} />}
      />

      {forceMfaBanner && !mfaEnabled && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="material-symbols-outlined text-[20px] text-amber-600 mt-0.5">security</span>
          <div>
            <p className="font-semibold">{t("mfa.setupTitle")}</p>
            <p className="mt-0.5 text-amber-800/90">{t("mfa.setupRequired")}</p>
            <p className="mt-2 text-xs text-amber-800/80">
              {t("profile.security.mfaBannerHint")}
            </p>
          </div>
        </div>
      )}

      {mfaJustEnabled && mfaEnabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <div>
            <p className="font-semibold">{t("profile.security.mfaEnabledTitle")}</p>
            <p className="text-green-800/90 text-xs mt-0.5">{t("profile.security.mfaEnabledBody")}</p>
          </div>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={() => router.push("/dashboard")}
          >
            {t("profile.security.continueDashboard")}
          </button>
        </div>
      )}

      {/* Sub nav */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-700">
        {accountNav(profileHref, t).map((n) => (
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
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("profile.nav.password")}</h3>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label htmlFor="profile-security-current-password" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">{t("profile.currentPassword")}</label>
            <input id="profile-security-current-password" type="password" required className="form-input" placeholder="••••••••" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} />
          </div>
          <div>
            <label htmlFor="profile-security-new-password" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">{t("profile.newPassword")}</label>
            <input id="profile-security-new-password" type="password" required className="form-input" placeholder="••••••••" value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })} />
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
                [/[A-Z]/, t("auth.reset.rule.upper")],
                [/[0-9]/, t("auth.reset.rule.number")],
                [/[^a-zA-Z0-9]/, t("auth.reset.rule.special")],
                [/.{8,}/, t("profile.req.length")],
              ].map(([regex, label]) => (
                <li key={label as string} className={`flex items-center gap-1.5 ${(regex as RegExp).test(pwForm.next) ? "text-green-600" : ""}`}>
                  <span className="material-symbols-outlined text-[13px]">{(regex as RegExp).test(pwForm.next) ? "check_circle" : "radio_button_unchecked"}</span>
                  {label as string}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label htmlFor="profile-security-confirm-new-password" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">{t("profile.confirmPassword")}</label>
            <input id="profile-security-confirm-new-password" type="password" required className="form-input" placeholder="••••••••" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} />
            {pwForm.confirm && pwForm.next !== pwForm.confirm && (
              <p className="text-xs text-red-500 mt-1">{t("auth.reset.mismatchInline")}</p>
            )}
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving || !pwForm.current || !pwForm.next || !pwForm.confirm}
              className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-40">
              <span className="material-symbols-outlined text-[18px]">lock_reset</span>
              {saving ? t("profile.security.changing") : t("profile.nav.password")}
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
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("profile.security.twoFactorTitle")}</h3>
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
                <p className="text-sm font-semibold text-neutral-900">{t("profile.security.totpTitle")}</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {mfaEnabled
                    ? t("profile.security.totpActive")
                    : t("profile.security.totpInactive")}
                </p>
              </div>
            </div>
            {mfaEnabled ? (
              <button
                type="button"
                onClick={() => { setDisablePassword(""); setDisableCode(""); setShowDisableModal(true); }}
                className="btn-secondary text-xs py-1 px-2 flex-shrink-0 text-red-600"
              >
                {t("profile.security.disable")}
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
                {t("profile.security.setUp")}
              </button>
            )}
          </div>
        )}

        {mfaEnabled && (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
            <span className="material-symbols-outlined text-[15px]">check_circle</span>
            {t("profile.security.protected")}
          </div>
        )}

        {mfaEnabled && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3">
            <div>
              <p className="text-xs font-semibold text-neutral-900">{t("profile.security.recoveryTitle")}</p>
              <p className="text-xs text-neutral-500">
                {recoveryRemaining === null
                  ? t("profile.security.recoveryHint")
                  : t("profile.security.recoveryRemaining", { count: recoveryRemaining })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setRegenPassword(""); setRegenCode(""); setShowRegenModal(true); }}
              className="btn-secondary text-xs py-1 px-2 flex-shrink-0"
            >
              {t("profile.security.generateNew")}
            </button>
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
                <h3 className="text-base font-bold text-neutral-900">{t("profile.security.setupModalTitle")}</h3>
                <p className="text-xs text-neutral-400">{t("profile.security.setupModalHint")}</p>
              </div>
            </div>

            <ol className="space-y-3 text-sm text-neutral-600">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold flex-shrink-0 mt-0.5">1</span>
                {t("profile.security.step1Prefix")}{" "}<strong className="text-neutral-900">Google Authenticator</strong>, <strong className="text-neutral-900">Authy</strong>{t("profile.security.step1Suffix")} {/* i18n-ignore */}
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold flex-shrink-0 mt-0.5">2</span>
                {t("profile.security.step2")}
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold flex-shrink-0 mt-0.5">3</span>
                {t("profile.security.step3")}
              </li>
            </ol>

            {/* Rendered locally: the otpauth URL contains the TOTP secret and must not go to a third-party QR service. */}
            <div className="flex flex-col items-center gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
              <div className="rounded-lg bg-white p-2">
                <QRCode value={mfaSetup.qr_code_url} size={164} title={t("profile.security.qrTitle")} />
              </div>
              <div className="text-center">
                <p className="text-[10px] text-neutral-400 uppercase tracking-wide mb-1">{t("profile.security.manualKey")}</p>
                <code className="text-xs font-mono text-neutral-700 bg-white border border-neutral-200 px-2 py-1 rounded select-all">
                  {mfaSetup.secret}
                </code>
              </div>
            </div>

            <div>
              <label htmlFor="profile-security-verification-code" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("profile.security.verificationCode")}</label>
              <input id="profile-security-verification-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="form-input text-center text-xl font-mono tracking-[0.5em] max-w-[160px]"
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                autoComplete="one-time-code"
              />
              <p className="text-xs text-neutral-400 mt-1">{t("profile.security.codeHint")}</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowSetupModal(false); setMfaSetup(null); setTotpCode(""); }}
                className="btn-secondary flex-1 py-2.5 text-sm justify-center"
              >
                {t("common.cancel")}
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
                {t("profile.security.activate")}
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
                <h3 className="text-base font-bold text-neutral-900">{t("profile.security.disableModalTitle")}</h3>
                <p className="text-xs text-neutral-400">{t("profile.security.disableModalHint")}</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600">
              {t("profile.security.disableBody")}
            </p>
            <div>
              <label htmlFor="profile-security-password" className="block text-xs font-semibold text-neutral-700 mb-1">{t("login.password")}</label>
              <input id="profile-security-password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label htmlFor="profile-security-disable-code" className="block text-xs font-semibold text-neutral-700 mb-1">{t("profile.security.authOrRecovery")}</label>
              <input id="profile-security-disable-code"
                type="text"
                className="form-input font-mono"
                placeholder="000000"
                value={disableCode}
                onChange={(e) => setDisableCode(normalizeSecondFactorInput(e.target.value))}
                autoComplete="one-time-code"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDisableModal(false); setDisablePassword(""); setDisableCode(""); }}
                disabled={mfaActionLoading}
                className="btn-secondary flex-1 py-2.5 text-sm justify-center"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleDisable2FA}
                disabled={!disablePassword || !isCompleteSecondFactor(disableCode) || mfaActionLoading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 transition-colors shadow-sm"
              >
                {mfaActionLoading ? (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                ) : null}
                {t("profile.security.disable2fa")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate recovery codes */}
      {showRegenModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="profile-security-regen-title" className="rounded-2xl bg-white p-6 max-w-sm w-full shadow-2xl border border-neutral-100 space-y-4">
            <h3 id="profile-security-regen-title" className="text-base font-bold text-neutral-900">{t("profile.security.regenTitle")}</h3>
            <p className="text-sm text-neutral-600">{t("profile.security.regenBody")}</p>
            <div>
              <label htmlFor="profile-security-regen-password" className="block text-xs font-semibold text-neutral-700 mb-1">{t("login.password")}</label>
              <input id="profile-security-regen-password" type="password" className="form-input" value={regenPassword}
                onChange={(e) => setRegenPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div>
              <label htmlFor="profile-security-regen-code" className="block text-xs font-semibold text-neutral-700 mb-1">{t("login.mfa")}</label>
              <input id="profile-security-regen-code" type="text" inputMode="numeric" maxLength={6} className="form-input font-mono" placeholder="000000"
                value={regenCode} onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowRegenModal(false)} disabled={mfaActionLoading} className="btn-secondary flex-1 py-2.5 text-sm justify-center">{t("common.cancel")}</button>
              <button type="button" onClick={handleRegenerateRecoveryCodes} disabled={!regenPassword || regenCode.length !== 6 || mfaActionLoading}
                className="btn-primary flex-1 py-2.5 text-sm justify-center disabled:opacity-40">{t("profile.security.generate")}</button>
            </div>
          </div>
        </div>
      )}

      {/* One-time display of recovery codes */}
      {recoveryCodes && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="profile-security-codes-title" className="rounded-2xl bg-white p-6 max-w-sm w-full shadow-2xl border border-neutral-100 space-y-4">
            <h3 id="profile-security-codes-title" className="text-base font-bold text-neutral-900">{t("profile.security.codesTitle")}</h3>
            <p className="text-sm text-neutral-600">
              {t("profile.security.codesBody")}
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 font-mono text-sm text-neutral-800 select-all">
              {recoveryCodes.map((code) => <li key={code}>{code}</li>)}
            </ul>
            <div className="flex gap-3">
              <button type="button" onClick={handleCopyRecoveryCodes} className="btn-secondary flex-1 py-2.5 text-sm justify-center">{t("profile.security.copy")}</button>
              <button type="button" onClick={() => setRecoveryCodes(null)} className="btn-primary flex-1 py-2.5 text-sm justify-center">{t("profile.security.savedThem")}</button>
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
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("profile.security.sessionsTitle")}</h3>
            <p className="text-xs text-neutral-400">{t("profile.security.sessionsHint")}</p>
          </div>
          {sessions.filter((s) => !s.is_current).length > 0 && (
            <button type="button" onClick={handleRevokeOthers} disabled={revokingOthers}
              className="btn-secondary text-xs py-1 px-2 text-red-600 disabled:opacity-40">
              {revokingOthers ? t("profile.security.signingOut") : t("profile.security.signOutOthers")}
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
          <EmptyState icon="devices" title={t("profile.security.noSessions")} className="py-8 min-h-0" />
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
                    {s.is_current && <span className="badge badge-success text-[10px]">{t("profile.security.current")}</span>}
                  </div>
                  {s.ip_address && (
                    <p className="text-xs text-neutral-400 mt-0.5">{s.ip_address}</p>
                  )}
                  <p className="text-xs text-neutral-300 mt-0.5">
                    {t("profile.security.lastActive", { when: s.last_active_at ? formatDateRelative(s.last_active_at) : t("profile.security.unknown") })}
                  </p>
                </div>
                {!s.is_current && (
                  <button type="button" onClick={() => handleRevoke(s.id)} disabled={revokingId === s.id}
                    className="btn-secondary text-xs py-1 px-2 flex-shrink-0 text-red-600 disabled:opacity-40">
                    {revokingId === s.id ? t("profile.security.revoking") : t("profile.signature.revoke")}
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
          <h3 className="text-sm font-semibold text-neutral-900">{t("profile.security.weeklyTitle")}</h3>
        </div>
        {weeklyPref ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-800">{t("profile.security.weeklyReceive")}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{t("profile.security.weeklyHint")}</p>
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
              <label htmlFor="profile-security-detail-level" className="block text-xs font-semibold text-neutral-700 mb-1">{t("profile.security.detailLevel")}</label>
              <select id="profile-security-detail-level"
                className="form-input max-w-xs"
                value={weeklyPref.detail_mode}
                onChange={(e) => setWeeklyPref({ ...weeklyPref, detail_mode: e.target.value as WeeklySummaryPreference["detail_mode"] })}
              >
                <option value="compact">{t("profile.security.detail.compact")}</option>
                <option value="standard">{t("profile.security.detail.standard")}</option>
                <option value="detailed">{t("profile.security.detail.detailed")}</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={handleSaveWeeklyPref} disabled={savingWeekly} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-60">
                <span className="material-symbols-outlined text-[18px]">save</span>
                {savingWeekly ? t("profile.security.saving") : t("profile.security.savePreference")}
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
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{t("profile.security.timeoutTitle")}</h3>
        </div>
        <div>
          <label htmlFor="idle-timeout" className="block text-xs font-semibold text-neutral-700 mb-1">{t("profile.security.timeoutLabel")}</label>
          <select
            id="idle-timeout"
            className="form-input max-w-xs"
            value={sessionTimeout}
            onChange={(e) => setSessionTimeout(e.target.value)}
          >
            <option value="15">{t("profile.security.timeout.15")}</option>
            <option value="30">{t("profile.security.timeout.30")}</option>
            <option value="60">{t("profile.security.timeout.60")}</option>
            <option value="120">{t("profile.security.timeout.120")}</option>
            <option value="480">{t("profile.security.timeout.480")}</option>
            <option value="0">{t("profile.security.timeout.0")}</option>
          </select>
          <p className="text-xs text-neutral-400 mt-1">
            {t("profile.security.timeoutHint")}
          </p>
        </div>
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={handleSaveIdleTimeout}
            disabled={savingTimeout}
            className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            {savingTimeout ? t("profile.security.saving") : t("profile.security.saveSettings")}
          </button>
        </div>
      </div>
    </div>
  );
}
