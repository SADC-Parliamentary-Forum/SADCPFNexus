// Client-side routing cookies read by the Next.js proxy (auth, portal, setup, must-reset).
// Re-exported from "@/lib/api"; import from there.

const MUST_RESET_COOKIE = "sadcpf_must_reset";
const COOKIE_MAX_AGE_DAYS = 7;

export function setMustResetCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${MUST_RESET_COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE_DAYS * 86400}; SameSite=Lax`;
}

export function clearMustResetCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${MUST_RESET_COOKIE}=; path=/; max-age=0`;
}

const SETUP_COMPLETE_COOKIE = "sadcpf_setup_complete";

export function setSetupCompleteCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SETUP_COMPLETE_COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE_DAYS * 86400}; SameSite=Lax`;
}

export function clearSetupCompleteCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SETUP_COMPLETE_COOKIE}=; path=/; max-age=0`;
}

const AUTH_COOKIE = "sadcpf_authenticated";

export function setAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE_DAYS * 86400}; SameSite=Lax`;
}

export function clearAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
}

const PORTAL_COOKIE = "sadcpf_portal";

export function setPortalCookie(portal: "staff" | "supplier"): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PORTAL_COOKIE}=${portal}; path=/; max-age=${COOKIE_MAX_AGE_DAYS * 86400}; SameSite=Lax`;
}

export function clearPortalCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PORTAL_COOKIE}=; path=/; max-age=0`;
}
