import { createContext } from "react";
import type { AuthUser } from "@/lib/api";
import { USER_KEY } from "@/lib/constants";

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

const ADMIN_ROLES = ["System Admin", "System Administrator", "super-admin", "admin", "Admin"];

/**
 * True if the user has a system administrator role (aligns with backend User::isSystemAdmin()).
 */
export function isSystemAdmin(user: AuthUser | null | undefined): boolean {
  if (!user?.roles?.length) return false;
  return user.roles.some((r) => ADMIN_ROLES.includes(r));
}

/**
 * True if the user has the given permission (or any of the given permissions if array).
 */
export function hasPermission(
  user: AuthUser | null | undefined,
  permission: string | string[]
): boolean {
  if (!user?.permissions?.length) return false;
  const list = Array.isArray(permission) ? permission : [permission];
  return list.some((p) => user.permissions.includes(p));
}

/** Permission(s) that allow adding/managing assets (add asset, approve requests). */
const ASSETS_MANAGE_PERMISSIONS = ["assets.admin", "assets.manage", "assets.create"];

/**
 * True if the user can add or manage assets (not just view/request).
 */
export function canManageAssets(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, ASSETS_MANAGE_PERMISSIONS);
}

/** Routes that require system admin (no permission string; admin-only). */
const ADMIN_ONLY_PATHS: string[] = [
  "/admin",
  "/organogram",
  "/analytics",
  "/finance/budget",
];

/** Path prefix or exact path -> required permission(s). Empty = allow any authenticated. */
const ROUTE_ACCESS: { path: string; permission?: string | string[] }[] = [
  { path: "/dashboard" },
  { path: "/approvals", permission: ["travel.approve", "leave.approve", "imprest.approve", "procurement.approve", "finance.approve", "governance.approve", "hr.approve"] },
  { path: "/alerts" },
  { path: "/assignments" },
  { path: "/travel", permission: "travel.view" },
  { path: "/leave", permission: "leave.view" },
  { path: "/finance", permission: "finance.view" },
  { path: "/imprest", permission: "imprest.view" },
  { path: "/pif", permission: "governance.view" },
  { path: "/workplan" },
  { path: "/hr/timesheets/team", permission: ["hr.admin", "hr.approve", "hr.edit"] },
  { path: "/hr", permission: "hr.view" },
  { path: "/reports", permission: "reports.view" },
  { path: "/assets", permission: "assets.view" },
  { path: "/governance", permission: "governance.view" },
  { path: "/procurement", permission: "procurement.view" },
  { path: "/settings/hr", permission: ["hr.admin", "hr_settings.view", "hr_settings.edit", "hr_settings.approve", "hr_settings.publish"] },
];

/**
 * True if the user can access the given path. Uses admin-only list and permission map.
 * System admins can access everything.
 */
export function canAccessRoute(user: AuthUser | null | undefined, pathOrId: string): boolean {
  if (!user) return false;
  // System admins can access everything without further checks.
  if (isSystemAdmin(user)) return true;

  const path = pathOrId.split("?")[0];

  if (ADMIN_ONLY_PATHS.some((p) => path === p || path.startsWith(p + "/"))) {
    return false;
  }

  const entry = ROUTE_ACCESS.find((e) => path === e.path || path.startsWith(e.path + "/"));
  if (!entry) return true; // unknown route: allow (or tighten later)
  if (!entry.permission) return true;
  return hasPermission(user, entry.permission);
}

/**
 * Parse stored user from localStorage (includes roles). Returns null if missing or invalid.
 */
export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const user = data as Record<string, unknown>;
    if (!user.id || !user.email) return null;
    // Normalize roles: may be array, plain object (numeric keys), or missing.
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
