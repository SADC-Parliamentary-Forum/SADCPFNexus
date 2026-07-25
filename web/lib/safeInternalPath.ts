/**
 * Allow only same-origin relative paths for post-login redirects.
 * Blocks protocol-relative URLs (//evil.com), absolute URLs, and backslash tricks.
 */
export function safeInternalPath(from: string | null | undefined): string | null {
  if (!from || typeof from !== "string") return null;
  if (!from.startsWith("/") || from.startsWith("//")) return null;
  if (from.includes("://") || from.includes("\\") || from.includes("\0")) return null;

  let decoded = from;
  try {
    decoded = decodeURIComponent(from);
  } catch {
    return null;
  }
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("://") ||
    decoded.includes("\\") ||
    decoded.includes("\0")
  ) {
    return null;
  }

  return from;
}
