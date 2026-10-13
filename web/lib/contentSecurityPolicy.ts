const CAPTCHA_HOSTS = [
  "https://challenges.cloudflare.com",
  "https://hcaptcha.com",
  "https://*.hcaptcha.com",
];

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

/** Fresh base64 nonce for one HTML response. */
export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Page CSP. Scripts need the per-request nonce (no 'unsafe-inline'); 'self'
 * stays so same-origin chunks and Cloudflare's /cdn-cgi scripts still load.
 * style-src keeps 'unsafe-inline' because React style={{}} attributes cannot
 * carry a nonce.
 */
export function buildContentSecurityPolicy(nonce: string, publicApiUrl?: string): string {
  const apiOrigin = originOf(publicApiUrl);
  const connect = ["'self'", ...(apiOrigin ? [apiOrigin] : []), ...CAPTCHA_HOSTS];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' ${CAPTCHA_HOSTS.join(" ")}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${CAPTCHA_HOSTS.join(" ")}`,
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob:",
    `frame-src 'self' blob: ${CAPTCHA_HOSTS.join(" ")}`,
    `connect-src ${connect.join(" ")}`,
  ].join("; ");
}
