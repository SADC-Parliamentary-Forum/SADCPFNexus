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
