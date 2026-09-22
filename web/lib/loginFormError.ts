import { isCsrfMismatch } from "./csrf.ts";

type LoginErr = {
  response?: {
    status?: number;
    data?: { message?: string; errors?: Record<string, string[] | string> };
  };
};

function firstFieldError(
  data: { errors?: Record<string, string[] | string> } | undefined,
  field: string,
): string | null {
  const value = data?.errors?.[field];
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0];
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return null;
}

/** User-facing login error. Never leaks raw Laravel CSRF copy. */
export function loginFormErrorMessage(err: unknown, t: (key: string) => string): string {
  if (isCsrfMismatch(err)) {
    return t("login.csrfExpired");
  }
  const data = (err as LoginErr).response?.data;
  const fieldMessage =
    firstFieldError(data, "captcha_token") ??
    firstFieldError(data, "code") ??
    firstFieldError(data, "email") ??
    firstFieldError(data, "password");
  if (fieldMessage) {
    return fieldMessage;
  }
  const message = data?.message?.trim();
  if (message && !/csrf token mismatch|page expired/i.test(message)) {
    return message;
  }
  return t("login.error");
}

export function shouldResetLoginCaptcha(err: unknown): boolean {
  if (isCsrfMismatch(err)) {
    return true;
  }
  return firstFieldError((err as LoginErr).response?.data, "captcha_token") !== null;
}
