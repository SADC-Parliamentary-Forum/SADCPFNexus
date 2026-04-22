import type { AuthUser } from "@/lib/api";
import { USER_KEY } from "@/lib/constants";

function readRawStoredUser(): string | null {
  if (typeof window === "undefined") return null;

  const sessionValue = sessionStorage.getItem(USER_KEY);
  if (sessionValue) return sessionValue;

  const legacyValue = localStorage.getItem(USER_KEY);
  if (legacyValue) {
    sessionStorage.setItem(USER_KEY, legacyValue);
    localStorage.removeItem(USER_KEY);
  }

  return legacyValue;
}

export function readStoredUser(): AuthUser | null {
  try {
    const raw = readRawStoredUser();
    if (!raw) return null;

    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;

    const user = data as Record<string, unknown>;
    if (!user.id || !user.email) return null;

    if (!Array.isArray(user.roles)) {
      user.roles = user.roles && typeof user.roles === "object"
        ? Object.values(user.roles as Record<string, string>)
        : [];
    }

    if (!Array.isArray(user.permissions)) {
      user.permissions = user.permissions && typeof user.permissions === "object"
        ? Object.values(user.permissions as Record<string, string>)
        : [];
    }

    return user as unknown as AuthUser;
  } catch {
    return null;
  }
}

export function writeStoredUser(user: AuthUser | (AuthUser & Record<string, unknown>)): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem(USER_KEY);
}

export function clearStoredUser(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(USER_KEY);
}
