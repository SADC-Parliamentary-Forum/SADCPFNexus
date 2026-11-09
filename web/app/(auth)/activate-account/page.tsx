"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function ActivateAccountForm() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();

  const [email, setEmail] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [isSupplier, setIsSupplier] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInvitation() {
      if (!token) {
        setError(t("auth.activate.missingToken"));
        setBootstrapping(false);
        return;
      }

      try {
        const { data } = await authApi.getInvitation(token);
        if (cancelled) return;
        setEmail(data.data.email);
        setName(data.data.name ?? null);
        setIsSupplier(Boolean(data.data.is_supplier));
      } catch (err: unknown) {
        if (cancelled) return;
        const ax = err as { response?: { data?: { message?: string } } };
        setLinkInvalid(true);
        setError(ax.response?.data?.message ?? t("auth.activate.invalidLink"));
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void loadInvitation();
    return () => {
      cancelled = true;
    };
    // Error copy is read once when the link loads; re-running on a locale change would refetch the invitation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.activateInvitation(token, password, passwordConfirmation);
      setDone(true);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const msg = ax.response?.data?.message
        ?? (ax.response?.data?.errors && Object.values(ax.response.data.errors).flat()[0])
        ?? t("auth.activate.failed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-neutral-200 shadow-sm p-8">
        <h1 className="text-xl font-bold text-neutral-900">{t("auth.activate.title")}</h1>
        <p className="mt-2 text-sm text-neutral-500">
          {t("auth.activate.subtitle")}
        </p>

        {bootstrapping && (
          <p className="mt-4 text-sm text-neutral-500">{t("auth.activate.checking")}</p>
        )}

        {done && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {t("auth.activate.done")}
            </div>
            <Link href={isSupplier ? "/supplier/login" : "/login"} className="inline-flex text-sm font-medium text-primary hover:underline">
              {t("auth.activate.goToSignIn")}
            </Link>
          </div>
        )}

        {error && !done && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {!bootstrapping && !done && !linkInvalid && !error.includes("invalid") && email && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                {t("auth.activate.account")}
              </label>
              <p className="text-sm text-neutral-800">{name ? `${name} · ${email}` : email}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                {t("auth.activate.password")}
              </label>
              <input
                type="password"
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-neutral-400">
                {t("auth.activate.passwordHint")}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                {t("auth.activate.confirmPassword")}
              </label>
              <input
                type="password"
                required
                minLength={12}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                className="form-input"
                autoComplete="new-password"
              />
            </div>
            <button type="submit" disabled={loading || !token} className="btn-primary w-full">
              {loading ? t("auth.activate.activating") : t("auth.activate.title")}
            </button>
          </form>
        )}

        {!done && (
          <p className="mt-6 text-center text-sm text-neutral-500">
            <Link href="/login" className="text-primary hover:underline font-medium">{t("auth.activate.backToSignIn")}</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function ActivateAccountPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">{t("common.loading")}</div>}>
      <ActivateAccountForm />
    </Suspense>
  );
}
