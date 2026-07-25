/**
 * Optional browser Sentry hook. No-ops unless NEXT_PUBLIC_SENTRY_DSN is set
 * and @sentry/nextjs (or similar) is installed later. Never hardcode a DSN.
 */
export function captureClientException(error: unknown, context?: Record<string, unknown>): void {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[observability]", error, context);
    }
    return;
  }
  // SDK not bundled by default — operators install @sentry/nextjs when ready.
  if (typeof window !== "undefined" && (window as unknown as { Sentry?: { captureException: (e: unknown) => void } }).Sentry) {
    (window as unknown as { Sentry: { captureException: (e: unknown) => void } }).Sentry.captureException(error);
  }
}
