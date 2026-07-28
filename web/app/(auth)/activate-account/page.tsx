"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api";

function ActivateAccountForm() {
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();

  const [email, setEmail] = useState("");
  const [name, setName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInvitation() {
      if (!token) {
        setError("This invitation link is missing a token.");
        setBootstrapping(false);
        return;
      }

      try {
        const { data } = await authApi.getInvitation(token);
        if (cancelled) return;
        setEmail(data.data.email);
        setName(data.data.name ?? null);
      } catch (err: unknown) {
        if (cancelled) return;
        const ax = err as { response?: { data?: { message?: string } } };
        setError(ax.response?.data?.message ?? "This invitation link is invalid or has expired.");
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    void loadInvitation();
    return () => {
      cancelled = true;
    };
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
        ?? "Unable to activate this account right now.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-neutral-200 shadow-sm p-8">
        <h1 className="text-xl font-bold text-neutral-900">Activate account</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Choose a strong password to finish setting up your SADC PF Nexus account.
        </p>

        {bootstrapping && (
          <p className="mt-4 text-sm text-neutral-500">Checking invitation…</p>
        )}

        {done && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Account activated. You can now sign in.
            </div>
            <Link href="/login" className="inline-flex text-sm font-medium text-primary hover:underline">
              Go to sign in
            </Link>
          </div>
        )}

        {error && !done && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {!bootstrapping && !done && !error.includes("invalid") && email && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                Account
              </label>
              <p className="text-sm text-neutral-800">{name ? `${name} · ${email}` : email}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                Password
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
                At least 12 characters with upper/lower case, a number, and a symbol.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
                Confirm password
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
              {loading ? "Activating…" : "Activate account"}
            </button>
          </form>
        )}

        {!done && (
          <p className="mt-6 text-center text-sm text-neutral-500">
            <Link href="/login" className="text-primary hover:underline font-medium">Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function ActivateAccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-neutral-500">Loading…</div>}>
      <ActivateAccountForm />
    </Suspense>
  );
}
