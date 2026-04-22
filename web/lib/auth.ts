import { createContext } from "react";
import type { AuthUser } from "@/lib/api";
import { readStoredUser } from "@/lib/session";

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (user: AuthUser) => void;
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

export function canViewProcurementVendors(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, ["procurement.view", "procurement.manage_vendors", "procurement.admin"]);
}

export function canManageProcurementVendors(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, ["procurement.manage_vendors", "procurement.admin"]);
}

export function canViewProcurementRfq(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, ["procurement.view", "procurement.approve", "procurement.admin"]);
}

export function canIssueProcurementRfq(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, ["procurement.create", "procurement.approve", "procurement.admin"]);
}

/** Routes that require system admin (no permission string; admin-only). */
const ADMIN_ONLY_PATHS: string[] = [
  "/admin",
  "/organogram",
  "/analytics",
  "/finance/budget",
];

interface RouteAccessRule {
  path: string;
  permission?: string | string[];
  allowSystemAdmin?: boolean;
}

/** Path prefix or exact path -> required permission(s). Empty = allow any authenticated. */
const ROUTE_ACCESS: RouteAccessRule[] = [
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
  { path: "/procurement/create", permission: ["procurement.create", "procurement.admin"] },
  { path: "/procurement/rfq", permission: ["procurement.view", "procurement.approve", "procurement.admin"] },
  { path: "/procurement/vendors", permission: ["procurement.view", "procurement.manage_vendors", "procurement.admin"] },
  { path: "/procurement/purchase-orders", permission: ["procurement.manage_po", "procurement.admin"] },
  { path: "/procurement/receipts", permission: ["procurement.receive_goods", "procurement.admin"] },
  { path: "/procurement/invoices", permission: ["procurement.approve_invoice", "procurement.admin"] },
  { path: "/procurement/contracts", permission: ["procurement.manage_po", "procurement.admin"] },
  { path: "/procurement/analytics", permission: ["procurement.view", "procurement.admin"] },
  { path: "/procurement", permission: "procurement.view" },
  { path: "/supplier", permission: "supplier.portal", allowSystemAdmin: false },
  { path: "/settings/hr", permission: ["hr.admin", "hr_settings.view", "hr_settings.edit", "hr_settings.approve", "hr_settings.publish"] },
  { path: "/hr/payslips", permission: ["hr.admin"] },
  { path: "/correspondence", permission: "correspondence.view" },
];

/**
 * True if the user can access the given path. Uses admin-only list and permission map,
 * while allowing route-level exceptions for areas that should stay hidden from admins.
 */
export function canAccessRoute(user: AuthUser | null | undefined, pathOrId: string): boolean {
  if (!user) return false;
  const path = pathOrId.split("?")[0];
  const systemAdmin = isSystemAdmin(user);

  if (ADMIN_ONLY_PATHS.some((p) => path === p || path.startsWith(p + "/"))) {
    return systemAdmin;
  }

  const entry = ROUTE_ACCESS.find((e) => path === e.path || path.startsWith(e.path + "/"));
  if (!entry) return true; // unknown route: allow (or tighten later)
  if (systemAdmin && entry.allowSystemAdmin !== false) return true;
  if (systemAdmin && entry.allowSystemAdmin === false) return false;
  if (!entry.permission) return true;
  return hasPermission(user, entry.permission);
}

/**
 * Parse stored user from localStorage (includes roles). Returns null if missing or invalid.
 */
export function getStoredUser(): AuthUser | null {
  return readStoredUser();
}
