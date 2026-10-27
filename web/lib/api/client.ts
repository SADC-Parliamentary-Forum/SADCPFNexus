// Shared API transport: one configured axios instance (CSRF, locale, multipart,
// global 401 / MFA-setup / 5xx handling). Domain clients use this instance;
// application code imports it via "@/lib/api".
import axios from "axios";
import { clearStoredUser } from "@/lib/session";
import { captureClientException } from "@/lib/observability";
import { MFA_SETUP_PATH } from "@/lib/privilegedMfa";
import { readStoredLocale } from "@/lib/i18n/messages";
import { shouldRetryCsrf } from "@/lib/csrf";
import { clearAuthCookie, clearPortalCookie } from "./cookies";
import { clearAllFormDrafts } from "@/lib/formDraft";

function readXsrfCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
  withXSRFToken: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// FormData + default application/json makes axios JSON.stringify the body
// (File → {}), which Laravel rejects as "The file field is required."
// Drop Content-Type so the browser sets multipart/form-data with boundary.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    config.headers["Accept-Language"] = readStoredLocale();
    const xsrf = readXsrfCookie();
    if (xsrf) {
      config.headers["X-XSRF-TOKEN"] = xsrf;
    }
  }
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    const headers = config.headers;
    if (headers && typeof headers.setContentType === "function") {
      headers.setContentType(false);
    } else if (headers) {
      delete (headers as Record<string, unknown>)["Content-Type"];
      delete (headers as Record<string, unknown>)["content-type"];
    }
  }
  return config;
});

// In-memory token cache — avoids synchronous localStorage read on every request
let csrfBootstrapped = false;

export async function ensureCsrfCookie(force = false): Promise<void> {
  if (csrfBootstrapped && !force) return;
  try {
    await axios.get("/sanctum/csrf-cookie", { withCredentials: true });
    csrfBootstrapped = true;
  } catch (error) {
    csrfBootstrapped = false;
    throw error;
  }
}

// Handle 401 globally — flag prevents concurrent 401s from firing multiple hard reloads
let _redirecting401 = false;
let _redirectingMfaSetup = false;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window !== "undefined") {
      const status = error.response?.status;
      const original = error.config as (typeof error.config & { _csrfRetry?: boolean }) | undefined;
      if (original && shouldRetryCsrf(error, Boolean(original._csrfRetry))) {
        original._csrfRetry = true;
        csrfBootstrapped = false;
        try {
          await ensureCsrfCookie(true);
          const xsrf = readXsrfCookie();
          if (xsrf) {
            original.headers = original.headers ?? {};
            original.headers["X-XSRF-TOKEN"] = xsrf;
          }
          return api.request(original);
        } catch {
          /* fall through to existing handlers */
        }
      }
      const data = error.response?.data as { mfa_setup_required?: boolean; message?: string; code?: string } | undefined;

      // Privileged role without MFA — send user to security setup (API middleware).
      // Skip background notification polls and any call already on the security page.
      if (
        status === 403 &&
        data?.mfa_setup_required === true &&
        !_redirectingMfaSetup &&
        !window.location.pathname.startsWith(MFA_SETUP_PATH)
      ) {
        const failedUrl = (error.config?.url ?? "").toString();
        const isBackgroundNoise =
          failedUrl.includes("/notifications") ||
          failedUrl.includes("unread-count");
        if (!isBackgroundNoise) {
          _redirectingMfaSetup = true;
          window.location.href = MFA_SETUP_PATH;
        }
        return Promise.reject(error);
      }

      if (status === 401) {
        const path = window.location.pathname;
        // Public auth flows (forgot / request / email-token reset) must stay put
        // when a background /auth/me 401 fires — otherwise the form never loads.
        const isPublicAuthPath =
          path.startsWith("/login") ||
          path.startsWith("/forgot-password") ||
          path.startsWith("/request-password") ||
          path.startsWith("/activate-account") ||
          path.startsWith("/reset-password") ||
          path.startsWith("/setup") ||
          path.startsWith("/approval") ||
          path === "/supplier/login" ||
          path === "/supplier/register" ||
          path === "/supplier/verify-email";

        if (!isPublicAuthPath && !_redirecting401) {
          _redirecting401 = true;
          clearStoredUser();
          clearAuthCookie();
          clearPortalCookie();
          // Expired session on a possibly shared browser: drop autosaved drafts too.
          clearAllFormDrafts();

          // Best-effort: invalidate the server-side session so Laravel emits a
          // Set-Cookie that wipes the httpOnly session cookie. Without this the
          // proxy could still see a stale session cookie and bounce us back.
          // Skip when the failing request was already /auth/logout to avoid
          // recursion.
          const failedUrl = (error.config?.url ?? "").toString();
          if (!failedUrl.includes("/auth/logout")) {
            // Fire-and-forget — don't block the redirect.
            axios.post("/api/v1/auth/logout", null, { withCredentials: true })
              .catch(() => { /* ignore — session is already invalid */ });
          }

          const supplierArea = path === "/supplier" || path.startsWith("/supplier/");
          window.location.href = data?.code === "session_idle_timeout"
            ? (supplierArea ? "/supplier/login?reason=idle" : "/login?reason=idle")
            : (supplierArea ? "/supplier/login" : "/login");
        }
      } else if (status && status >= 500) {
        captureClientException(error, { status, url: error.config?.url });
      }
    }
    return Promise.reject(error);
  }
);

export { api };
export default api;
