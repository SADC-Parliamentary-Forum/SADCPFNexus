/**
 * Sign-in / disable second-factor input: either a 6-digit authenticator code
 * or a one-time recovery code (10 hex characters, shown as "xxxxx-xxxxx").
 */
export function normalizeSecondFactorInput(raw: string): string {
  return raw.replace(/[^0-9a-zA-Z-]/g, "").slice(0, 11);
}

export function isCompleteSecondFactor(code: string): boolean {
  if (/^\d{6}$/.test(code)) return true;
  return code.replace(/-/g, "").length === 10;
}
