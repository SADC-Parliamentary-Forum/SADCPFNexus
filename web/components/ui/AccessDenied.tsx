"use client";

import Link from "next/link";

interface AccessDeniedProps {
  path?: string;
  reason?: string;
}

/**
 * Explicit 403 / access-denied surface. Prefer this over silent redirects to dashboard.
 */
export function AccessDenied({
  path,
  reason = "You do not have permission to view this page.",
}: AccessDeniedProps) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
        <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          lock
        </span>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-700">Access denied</p>
      <h1 className="page-title mt-1">You cannot open this page</h1>
      <p className="page-subtitle mt-2 max-w-md">{reason}</p>
      {path ? (
        <p className="mt-2 font-mono text-xs text-neutral-400 break-all">{path}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/dashboard" className="btn-primary">
          Back to dashboard
        </Link>
        <Link href="/profile/support" className="btn-secondary">
          Request access
        </Link>
      </div>
    </div>
  );
}
