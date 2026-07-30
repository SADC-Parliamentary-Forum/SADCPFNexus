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

/** Permission(s) that allow managing the consumables/stock register. */
const STOCK_MANAGE_PERMISSIONS = ["stock.admin", "stock.manage", "stock.create", "stock.edit"];

/** Permission(s) that allow recording stock movements (in/out/adjustment). */
const STOCK_ISSUE_PERMISSIONS = ["stock.admin", "stock.manage", "stock.issue"];

/**
 * True if the user can add or manage consumable stock items (not just view).
 */
export function canManageStock(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, STOCK_MANAGE_PERMISSIONS);
}

/**
 * True if the user can record stock movements (stock-in / stock-out / adjustment).
 */
export function canIssueStock(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, STOCK_ISSUE_PERMISSIONS);
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

/** Salary Advance permission with finance.* fallbacks (mirrors API). */
const SA_PERM_FALLBACKS: Record<string, string[]> = {
  "salary_advance.view": ["finance.view"],
  "salary_advance.create": ["finance.create"],
  "salary_advance.certify": ["finance.approve"],
  "salary_advance.approve": ["finance.approve"],
  "salary_advance.pay": ["finance.approve", "finance.admin"],
  "salary_advance.recover": ["finance.approve", "finance.admin"],
  "salary_advance.export": ["finance.export"],
  "salary_advance.admin": ["finance.admin"],
};

export function hasSalaryAdvancePermission(
  user: AuthUser | null | undefined,
  permission: string | string[]
): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  const list = Array.isArray(permission) ? permission : [permission];
  return list.some((p) => {
    if (hasPermission(user, p)) return true;
    return (SA_PERM_FALLBACKS[p] ?? []).some((legacy) => hasPermission(user, legacy));
  });
}

export function canAccessSalaryAdvances(user: AuthUser | null | undefined): boolean {
  return hasSalaryAdvancePermission(user, [
    "salary_advance.view",
    "salary_advance.create",
    "salary_advance.certify",
    "salary_advance.approve",
    "salary_advance.pay",
    "salary_advance.recover",
    "salary_advance.admin",
  ]);
}

export function canManageSalaryAdvanceFinance(user: AuthUser | null | undefined): boolean {
  return hasSalaryAdvancePermission(user, [
    "salary_advance.certify",
    "salary_advance.pay",
    "salary_advance.recover",
    "salary_advance.approve",
    "salary_advance.admin",
  ]);
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
  { path: "/weekly-summaries" },
  { path: "/travel/settings", permission: ["travel.admin", "travel.finance-review"] },
  { path: "/travel/reports", permission: ["travel.export", "travel.view", "reports.export"] },
  { path: "/travel/register", permission: ["travel.view", "travel.export", "travel.admin"] },
  { path: "/travel/toil", permission: ["travel.review-toil", "travel.admin", "hr.admin", "leave.approve"] },
  { path: "/travel/queues/finance", permission: ["travel.finance-review", "travel.admin", "finance.approve"] },
  { path: "/travel/queues/director-finance", permission: ["travel.director-finance-confirm", "travel.admin"] },
  { path: "/travel/queues/admin", permission: ["travel.admin-review", "travel.admin"] },
  { path: "/travel/queues/retirement", permission: ["travel.review-retirement", "travel.admin"] },
  { path: "/travel/queues", permission: ["travel.approve", "travel.recommend", "travel.admin", "travel.finance-review", "travel.final-approve"] },
  { path: "/travel/create", permission: ["travel.create", "travel.prepare-for-others"] },
  { path: "/travel", permission: "travel.view" },
  { path: "/leave", permission: "leave.view" },
  { path: "/budget", permission: ["finance.view", "finance.approve", "finance.admin", "procurement.manage_budget"] },
  { path: "/finance", permission: "finance.view" },
  // Salary Advances — more specific paths first (finance queues exclude plain employee view)
  { path: "/salary-advances/settings", permission: ["salary_advance.admin", "finance.admin"] },
  { path: "/salary-advances/reports", permission: ["salary_advance.export", "salary_advance.certify", "finance.export", "finance.approve", "reports.export"] },
  { path: "/salary-advances/register", permission: ["salary_advance.certify", "salary_advance.export", "salary_advance.admin", "finance.approve", "finance.export", "finance.admin"] },
  { path: "/salary-advances/reconciliation", permission: ["salary_advance.recover", "salary_advance.certify", "finance.approve", "finance.admin"] },
  { path: "/salary-advances/outstanding", permission: ["salary_advance.certify", "salary_advance.pay", "salary_advance.recover", "finance.approve", "finance.admin"] },
  { path: "/salary-advances/queues", permission: ["salary_advance.certify", "salary_advance.pay", "salary_advance.recover", "salary_advance.approve", "finance.approve", "finance.admin"] },
  { path: "/salary-advances/finance", permission: ["salary_advance.certify", "salary_advance.pay", "salary_advance.recover", "salary_advance.approve", "salary_advance.admin", "finance.approve", "finance.admin"] },
  { path: "/salary-advances/pending-approval", permission: ["salary_advance.approve", "finance.approve"] },
  { path: "/salary-advances/create", permission: ["salary_advance.create", "finance.create"] },
  { path: "/salary-advances/applications", permission: ["salary_advance.view", "salary_advance.create", "finance.view", "finance.create"] },
  { path: "/salary-advances/history", permission: ["salary_advance.view", "salary_advance.create", "finance.view", "finance.create"] },
  { path: "/salary-advances", permission: ["salary_advance.view", "salary_advance.create", "finance.view", "finance.create"] },
  { path: "/imprest", permission: "imprest.view" },
  { path: "/pif", permission: ["pif.view", "programme.module.view", "programme.request.create", "governance.view"] },
  { path: "/my-work/procurement-evaluations", permission: ["procurement.evaluation.read.assigned", "procurement.evaluation.score.assigned"] },
  { path: "/my-work", permission: ["my_work.view", "approvals.inbox.view", "procurement.evaluation.read.assigned", "assignment.read.assigned"] },
  { path: "/admin/access", permission: ["admin.roles.view", "roles.view", "roles.manage", "admin.access.simulate", "admin.access.explore"] },
  { path: "/workplan" },
  { path: "/hr/timesheets/templates", permission: ["hr.admin", "timesheets.admin"] },
  { path: "/hr/timesheets/team", permission: ["hr.admin", "hr.approve", "hr.edit"] },
  { path: "/hr", permission: "hr.view" },
  { path: "/reports", permission: "reports.view" },
  { path: "/assets", permission: "assets.view" },
  { path: "/fleet", permission: "assets.view" },
  { path: "/stock", permission: "stock.view" },
  { path: "/governance", permission: "governance.view" },
  { path: "/procurement/create", permission: ["procurement.create", "procurement.admin"] },
  { path: "/procurement/rfq", permission: ["procurement.view", "procurement.approve", "procurement.admin"] },
  { path: "/procurement/vendors", permission: ["procurement.view", "procurement.manage_vendors", "procurement.admin"] },
  { path: "/procurement/purchase-orders", permission: ["procurement.manage_po", "procurement.admin"] },
  { path: "/procurement/receipts", permission: ["procurement.receive_goods", "procurement.admin"] },
  { path: "/procurement/invoices", permission: ["procurement.approve_invoice", "procurement.admin"] },
  { path: "/procurement/contracts", permission: ["procurement.manage_po", "procurement.admin"] },
  { path: "/procurement/analytics", permission: ["procurement.view", "procurement.admin"] },
  { path: "/procurement/settings", permission: ["procurement.admin"] },
  { path: "/procurement/register", permission: ["procurement.view", "procurement.admin"] },
  { path: "/procurement/budget", permission: ["finance.approve", "finance.admin", "procurement.admin"] },
  { path: "/procurement/intake", permission: ["procurement.view", "procurement.approve", "procurement.admin"] },
  { path: "/procurement", permission: "procurement.view" },
  { path: "/supplier", permission: "supplier.portal", allowSystemAdmin: false },
  { path: "/settings/hr", permission: ["hr.admin", "hr_settings.view", "hr_settings.edit", "hr_settings.approve", "hr_settings.publish"] },
  { path: "/hr/payslips", permission: ["hr.admin"] },
  { path: "/correspondence", permission: "correspondence.view" },
  // M&E / Results Monitoring (PRD §10) — more specific paths first
  { path: "/mande/strategic-plan", permission: ["mande.admin"] },
  { path: "/mande/results-framework", permission: ["mande.admin", "mande.view"] },
  { path: "/mande/results", permission: ["mande.admin", "mande.view"] },
  { path: "/mande/settings", permission: ["mande.admin"] },
  { path: "/mande/review-queue", permission: ["mande.review", "mande.admin"] },
  { path: "/mande/intake", permission: ["mande.view", "mande.create", "mande.review"] },
  { path: "/mande/activity-reports", permission: ["mande.view", "mande.create", "mande.review"] },
  { path: "/mande/indicators", permission: ["mande.view", "mande.create"] },
  { path: "/mande/reports", permission: ["mande.view"] },
  { path: "/mande", permission: "mande.view" },
  // Audit Management Module (Phase 1)
  { path: "/audit", permission: ["audit.view", "audit.findings.view", "audit.dashboard.auditor", "audit.dashboard.management", "audit.dashboard.sg", "audit.admin"] },
  // People & Authority Module (Phase 1)
  { path: "/people", permission: ["people.view-directory", "people.view-profile", "people.manage", "organisation.view"] },
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
