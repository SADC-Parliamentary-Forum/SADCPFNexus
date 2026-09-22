type AxiosLike = {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      code?: string;
      errors?: Record<string, string[] | string>;
    };
  };
};

/** Laravel/Sanctum CSRF failure (419, csrf_mismatch, or stock mismatch copy). */
export function isCsrfMismatch(err: unknown): boolean {
  const axiosErr = err as AxiosLike;
  const status = axiosErr.response?.status;
  const code = axiosErr.response?.data?.code;
  const message = `${axiosErr.response?.data?.message ?? ""} ${axiosErr.message ?? ""}`;
  if (code === "csrf_mismatch" || status === 419) {
    return true;
  }
  return /csrf token mismatch|page expired/i.test(message);
}

/** First Laravel validation message, then top-level message. Prefer over Error.message (Axios 422). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as {
    response?: { data?: { message?: string; errors?: Record<string, string[] | string> } };
  };
  const data = axiosErr?.response?.data;
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0];
    if (typeof first === "string" && first.trim()) return first;
  }
  if (data?.message?.trim()) return data.message;
  if (err instanceof Error && err.message.trim() && !/^Request failed with status code \d+$/.test(err.message)) {
    return err.message;
  }
  return fallback;
}
