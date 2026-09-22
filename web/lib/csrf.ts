export const CSRF_EXPIRED_MESSAGE = "Your session expired. Refresh the page and try again.";

export function isCsrfMismatch(err: unknown): boolean {
  const ax = err as {
    response?: { status?: number; data?: { message?: string; code?: string } };
  };
  const status = ax.response?.status;
  const code = ax.response?.data?.code;
  const message = (ax.response?.data?.message ?? "").toLowerCase();
  return status === 419 || code === "csrf_mismatch" || message.includes("csrf token mismatch");
}

export function shouldRetryCsrf(err: unknown, alreadyRetried: boolean): boolean {
  return !alreadyRetried && isCsrfMismatch(err);
}
