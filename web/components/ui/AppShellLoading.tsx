"use client";

/**
 * Neutral loading state shown while access permissions are still being
 * verified. Deliberately distinct from AccessDenied — a loading page should
 * never look like a denial.
 */
export function AppShellLoading() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4"
      role="status"
      aria-live="polite"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-primary dark:border-neutral-700 dark:border-t-primary" />
      <span className="text-sm text-neutral-700 dark:text-neutral-300">Loading…</span>
    </div>
  );
}
