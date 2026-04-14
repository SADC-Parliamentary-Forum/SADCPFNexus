"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { canAccessRoute, getStoredUser } from "@/lib/auth";
import type { AuthUser } from "@/lib/api";

export default function SupplierLayout({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  if (user === undefined) {
    return <div className="card p-6">Loading supplier portal...</div>;
  }

  const canAccessSupplierPortal = canAccessRoute(user, "/supplier");

  if (!canAccessSupplierPortal) {
    return (
      <div className="card p-8 text-center space-y-3">
        <span className="material-symbols-outlined text-4xl text-neutral-300">storefront</span>
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Supplier Portal Access Required</h1>
          <p className="mt-1 text-sm text-neutral-500">
            This area is only available to supplier portal accounts linked to a vendor profile.
          </p>
        </div>
        <Link href="/dashboard" className="btn-secondary">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
