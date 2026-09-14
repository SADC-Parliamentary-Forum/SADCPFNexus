"use client";

import Link from "next/link";
import { useEffect } from "react";
import { clearAuthCookie } from "@/lib/api";
import { clearStoredUser } from "@/lib/session";
import { LocaleSwitcher, useI18n } from "@/lib/i18n/LocaleProvider";
import { PortalSignInForm } from "@/components/auth/PortalSignInForm";

const FEATURES = [
  { icon: "request_quote", key: "auth.feature.rfqs" },
  { icon: "upload_file", key: "auth.feature.quotes" },
  { icon: "receipt_long", key: "auth.feature.orders" },
];

export default function SupplierLoginPage() {
  const { t } = useI18n();

  useEffect(() => {
    clearAuthCookie();
    clearStoredUser();
  }, []);

  return (
    <div className="min-h-screen flex bg-white" suppressHydrationWarning>
      <div className="hidden lg:flex lg:w-[480px] flex-col justify-between bg-[#0f3d38] px-12 py-14 text-white">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <img
              src="/sadcpf-logo.jpg"
              alt="SADC Parliamentary Forum"
              className="h-10 w-auto object-contain flex-shrink-0"
            />
            <div>
              <h1 className="text-lg font-bold leading-tight">{t("auth.supplierPortalName")}</h1>
              <p className="text-xs text-white/70">SADC-PF Nexus</p>
            </div>
          </div>

          <h2 className="text-3xl font-bold leading-snug mb-4">
            {t("auth.supplierBrandTitle")}
          </h2>
          <p className="text-sm text-white/70 leading-relaxed mb-10">
            {t("auth.supplierBrandDescription")}
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
          <p className="text-xs text-white/70">
            {t("login.staffInstead")}{" "}
            <Link href="/login" className="font-medium text-white underline underline-offset-2">
              {t("login.staffPortalLink")}
            </Link>
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
              <h1 className="text-base font-bold text-neutral-900">{t("auth.supplierPortalName")}</h1>
              <p className="text-xs text-neutral-600">SADC-PF Nexus</p>
            </div>
          </div>

          <div className="mb-8 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 mb-1">{t("auth.supplierPortalName")}</p>
              <h2 className="text-2xl font-bold text-neutral-900">{t("login.supplierSignInTitle")}</h2>
              <p className="text-sm text-neutral-700 mt-1">{t("login.supplierSignInSubtitle")}</p>
            </div>
            <LocaleSwitcher />
          </div>

          <PortalSignInForm portal="supplier" emailPlaceholder="you@company.com" />

          <div className="mt-6 text-center text-xs text-neutral-700 space-y-2">
            <p>
              {t("login.noSupplierAccount")}{" "}
              <Link href="/supplier/register" className="font-medium text-primary-800 hover:underline">
                {t("login.supplierRegister")}
              </Link>
            </p>
            <p>
              <Link href="/forgot-password" className="font-medium text-primary-800 hover:underline">
                {t("login.resetPassword")}
              </Link>
            </p>
            <p className="lg:hidden">
              {t("login.staffInstead")}{" "}
              <Link href="/login" className="font-medium text-primary-800 hover:underline">
                {t("login.staffPortalLink")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
