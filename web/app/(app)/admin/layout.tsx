"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredUser, isSystemAdmin } from "@/lib/auth";

/**
 * Admin layout: only render children if the current user is a system admin.
 * Non-admins are redirected to /dashboard and never see admin content or trigger admin API calls.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowAccess, setAllowAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    const admin = isSystemAdmin(user);
    if (!admin) {
      router.replace("/dashboard");
      return;
    }
    setAllowAccess(true);
  }, [router]);

  // While we haven't confirmed access, show nothing (avoid flashing admin UI or mounting child pages)
  if (allowAccess !== true) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
          Checking access…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
