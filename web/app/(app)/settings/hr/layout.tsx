"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

/**
 * HR Settings layout: accessible to system admins and users with any hr_settings.* permission.
 */
export default function HrSettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowAccess, setAllowAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    const allowed =
      isSystemAdmin(user) ||
      hasPermission(user, ["hr.admin", "hr_settings.view", "hr_settings.edit", "hr_settings.approve", "hr_settings.publish"]);
    if (!allowed) {
      router.replace("/dashboard");
      return;
    }
    setAllowAccess(true);
  }, [router]);

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
