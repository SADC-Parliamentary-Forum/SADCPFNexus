/** Extract an opaque asset QR token from a pasted URL, path, or raw token. */
export function parseAssetQrToken(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const fromUrl = value.match(/\/a\/([A-Za-z0-9_-]+)/);
  if (fromUrl?.[1]) {
    return fromUrl[1];
  }

  try {
    const url = new URL(value);
    const pathMatch = url.pathname.match(/\/a\/([A-Za-z0-9_-]+)/);
    if (pathMatch?.[1]) {
      return pathMatch[1];
    }
  } catch {
    // Not a URL — treat as a token.
  }

  if (/^[A-Za-z0-9_-]{16,}$/.test(value)) {
    return value;
  }

  return null;
}
