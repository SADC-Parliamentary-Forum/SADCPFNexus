/**
 * Allow only absolute http(s) URLs for user-supplied links rendered as hrefs.
 * Blocks javascript:, data:, vbscript: and other schemes that execute or embed content.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  return parsed.href;
}
