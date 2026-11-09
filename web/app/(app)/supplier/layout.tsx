"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { canAccessRoute, getStoredUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function SupplierLayout({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  if (user === undefined) {
    return <div className="card p-6">{t("supplier.portal.loading")}</div>;
  }

  const canAccessSupplierPortal = canAccessRoute(user, "/supplier");

  if (!canAccessSupplierPortal) {
    return (
      <div className="card p-8 text-center space-y-3" data-testid="supplier-portal-denied">
        <span className="material-symbols-outlined text-4xl text-neutral-300">storefront</span>
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{t("supplier.portal.accessRequired")}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {t("supplier.portal.accessHint")}
          </p>
        </div>
        <Link href="/dashboard" className="btn-secondary">
          {t("supplier.portal.returnDashboard")}
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
