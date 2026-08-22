/** Pure auth/access helpers - no React or path-alias imports (node:test safe). */
export type AuthAccessUser = {
  roles?: string[];
  permissions?: string[];
};

export type AccessEffectivePayloadLike = {
  permissions?: string[];
  roles?: string[];
};
const ADMIN_ROLES = ["System Admin", "System Administrator", "super-admin", "admin", "Admin"];

/**
 * True if the user has a system administrator role (aligns with backend User::isSystemAdmin()).
 */
export function isSystemAdmin(user: AuthAccessUser | null | undefined): boolean {
  if (!user?.roles?.length) return false;
  return user.roles.some((r) => ADMIN_ROLES.includes(r));
}

/**
 * True if the user has the given permission (or any of the given permissions if array).
 */
export function hasPermission(
  user: AuthAccessUser | null | undefined,
  permission: string | string[]
): boolean {
  if (!user?.permissions?.length) return false;
  const list = Array.isArray(permission) ? permission : [permission];
  return list.some((p) => (user.permissions ?? []).includes(p));
}

export function mergeEffectivePermissions<T extends AuthAccessUser>(
  user: T | null | undefined,
  effective: Pick<AccessEffectivePayloadLike, "permissions" | "roles"> | null | undefined
): T | null {
  if (!user) return null;
  if (!effective) return user;

  return {
    ...user,
    roles: Array.from(new Set([...(user.roles ?? []), ...(effective.roles ?? [])])),
    permissions: Array.from(new Set([...(user.permissions ?? []), ...(effective.permissions ?? [])])),
  };
}

export function canAccessRouteWithEffective(
  user: AuthAccessUser | null | undefined,
  pathOrId: string,
  effective: Pick<AccessEffectivePayloadLike, "permissions" | "roles"> | null | undefined
): boolean {
  return canAccessRoute(mergeEffectivePermissions(user, effective), pathOrId);
}

/** Permission(s) that allow adding/managing assets (add asset, approve requests). */
const ASSETS_MANAGE_PERMISSIONS = ["assets.admin", "assets.manage", "assets.create"];

/**
 * True if the user can add or manage assets (not just view/request).
 */
export function canManageAssets(user: AuthAccessUser | null | undefined): boolean {
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
export function canManageStock(user: AuthAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, STOCK_MANAGE_PERMISSIONS);
}

/**
 * True if the user can record stock movements (stock-in / stock-out / adjustment).
 */
export function canIssueStock(user: AuthAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, STOCK_ISSUE_PERMISSIONS);
}

export function canViewProcurementVendors(user: AuthAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, ["procurement.view", "procurement.manage_vendors", "procurement.admin"]);
}

export function canManageProcurementVendors(user: AuthAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, ["procurement.manage_vendors", "procurement.admin"]);
}

export function canViewProcurementRfq(user: AuthAccessUser | null | undefined): boolean {
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
  user: AuthAccessUser | null | undefined,
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

export function canAccessSalaryAdvances(user: AuthAccessUser | null | undefined): boolean {
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

export function canManageSalaryAdvanceFinance(user: AuthAccessUser | null | undefined): boolean {
  return hasSalaryAdvancePermission(user, [
    "salary_advance.certify",
    "salary_advance.pay",
    "salary_advance.recover",
    "salary_advance.approve",
    "salary_advance.admin",
  ]);
}

export function canIssueProcurementRfq(user: AuthAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, ["procurement.create", "procurement.approve", "procurement.admin"]);
}

const WEEKLY_REVIEW_PERMISSIONS = [
  "weekly-reports.review-team",
  "weekly-reports.accept",
  "weekly-reports.admin",
  "weekly-reports.return",
];

const WEEKLY_REVIEW_ROLES = ["Secretary General", "HOD", "Director"];

/** Supervisors (HOD/Director/review permission) and the Secretary General - not plain staff. */
export function canReviewWeeklySummaries(user: AuthAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  if (user.roles?.some((role) => WEEKLY_REVIEW_ROLES.includes(role))) return true;
  return hasPermission(user, WEEKLY_REVIEW_PERMISSIONS);
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
  roles?: string[];
  allowSystemAdmin?: boolean;
}

/** Path prefix or exact path -> required permission(s). Empty = allow any authenticated. */
const ROUTE_ACCESS: RouteAccessRule[] = [
  { path: "/dashboard" },
  { path: "/approvals", permission: ["travel.approve", "leave.approve", "imprest.approve", "procurement.approve", "finance.approve", "governance.approve", "hr.approve"] },
  { path: "/alerts" },
  { path: "/assignments/unassigned", permission: ["assignments.issue", "assignments.admin"] },
  { path: "/assignments/escalations", permission: ["assignments.review", "assignments.admin"] },
  { path: "/assignments/review", permission: ["assignments.review", "assignments.admin"] },
  { path: "/assignments/pending", permission: ["assignments.issue", "assignments.admin"] },
  { path: "/assignments/assigned-by-me", permission: ["assignments.issue", "assignments.admin"] },
  { path: "/assignments/capacity", permission: ["assignments.team", "assignments.admin"] },
  { path: "/assignments/reports", permission: ["assignments.reports", "assignments.admin"] },
  { path: "/assignments/team", permission: ["assignments.team", "assignments.admin"] },
  { path: "/assignments/recurring", permission: ["assignments.issue", "assignments.admin"] },
  { path: "/assignments/overdue", permission: ["assignments.team", "assignments.admin", "assignments.review"] },
  { path: "/assignments/blocked", permission: ["assignments.team", "assignments.admin"] },
  { path: "/assignments" },
  {
    path: "/weekly-summaries/review",
    permission: WEEKLY_REVIEW_PERMISSIONS,
    roles: WEEKLY_REVIEW_ROLES,
  },
  {
    path: "/weekly-summaries/department",
    permission: ["weekly-reports.view-department", "weekly-reports.consolidate-department", "weekly-reports.admin", "weekly-reports.review-team"],
    roles: WEEKLY_REVIEW_ROLES,
  },
  {
    path: "/weekly-summaries/institutional",
    permission: ["weekly-reports.view-management", "weekly-reports.publish-institutional", "weekly-reports.admin"],
    roles: ["Secretary General", "Director"],
  },
  {
    path: "/weekly-summaries/compliance",
    permission: ["weekly-reports.admin", "weekly-reports.audit", "weekly-reports.view-management", "weekly-reports.view-department"],
    roles: WEEKLY_REVIEW_ROLES,
  },
  {
    path: "/weekly-summaries/trends",
    permission: ["weekly-reports.admin", "weekly-reports.audit", "weekly-reports.view-management"],
    roles: WEEKLY_REVIEW_ROLES,
  },
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
  // Salary Advances - more specific paths first (finance queues exclude plain employee view)
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
  { path: "/hr/timesheets/payroll", permission: ["hr.admin", "timesheets.admin", "finance.admin"] },
  { path: "/hr/timesheets/schedules", permission: ["hr.admin", "timesheets.admin"] },
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
  // Risk Register
  { path: "/risk", permission: ["risk.view", "risk.admin", "risk.manage", "governance.view"] },
  // Notifications
  { path: "/notifications", permission: ["notifications.view", "notifications.inbox", "alerts.view"] },
  { path: "/alerts", permission: ["alerts.view", "notifications.view"] },
  // Documents
  { path: "/documents", permission: ["documents.view", "documents.manage", "documents.admin"] },
  { path: "/admin/documents", permission: ["documents.admin", "documents.manage", "admin.roles.view"] },
  { path: "/admin/notifications", permission: ["notifications.admin", "admin.roles.view"] },
  { path: "/admin/audit-trail", permission: ["audit-trail.search", "audit-trail.admin", "audit-trail.manage-holds", "audit-trail.manage-alerts"] },
  { path: "/admin/users", permission: ["users.view", "users.manage", "admin.roles.view"] },
  { path: "/admin/roles", permission: ["roles.view", "roles.manage", "admin.roles.view"] },
  // Profile / settings (authenticated)
  { path: "/profile" },
  { path: "/settings" },
  { path: "/help" },
  // Timesheets
  { path: "/hr/timesheets", permission: ["timesheets.view", "timesheets.create", "hr.view", "hr.admin"] },
  // Decisions / meetings
  { path: "/decisions", permission: ["decisions.view", "governance.view", "meetings.view"] },
  { path: "/meetings", permission: ["meetings.view", "governance.view", "decisions.view"] },
  // Workflow
  { path: "/workflows", permission: ["workflows.view", "workflows.admin"] },
  // M&E / Results Monitoring (PRD section 10) - more specific paths first
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
  // Employee Lifecycle (Phase 1)
  { path: "/lifecycle/admin/templates", permission: ["lifecycle.templates.view", "lifecycle.templates.edit", "lifecycle.admin"] },
  { path: "/lifecycle/onboarding/create", permission: ["lifecycle.manage-onboarding", "lifecycle.admin"] },
  { path: "/lifecycle/separation/create", permission: ["lifecycle.manage-separation", "lifecycle.admin"] },
  { path: "/lifecycle/onboarding", permission: ["lifecycle.view", "lifecycle.manage-onboarding", "lifecycle.admin"] },
  { path: "/lifecycle/separation", permission: ["lifecycle.view", "lifecycle.manage-separation", "lifecycle.admin"] },
  { path: "/lifecycle/reports", permission: ["lifecycle.view", "lifecycle.admin"] },
  { path: "/lifecycle/my-tasks" },
  { path: "/lifecycle", permission: ["lifecycle.view", "lifecycle.view-own", "lifecycle.manage-onboarding", "lifecycle.manage-separation", "lifecycle.admin"] },
];

/**
 * True if the user can access the given path. Uses admin-only list and permission map.
 * Unknown / unregistered routes deny by default (Access Control Phase 7-8 residual).
 */
export function canAccessRoute(user: AuthAccessUser | null | undefined, pathOrId: string): boolean {
  if (!user) return false;
  const path = pathOrId.split("?")[0];
  const systemAdmin = isSystemAdmin(user);

  if (ADMIN_ONLY_PATHS.some((p) => path === p || path.startsWith(p + "/"))) {
    return systemAdmin;
  }

  // System administrators are the platform-wide fallback for routes that are
  // not yet represented in the client-side registry. Keep explicitly
  // restricted external portals opt-out below. This prevents a stale route
  // catalogue from hiding or blocking a deployed Nexus module while ordinary
  // users still fail closed on unknown routes.
  if (systemAdmin && path !== "/supplier" && !path.startsWith("/supplier/")) {
    return true;
  }

  const entry = ROUTE_ACCESS.find((e) => path === e.path || path.startsWith(e.path + "/"));
  if (!entry) return false; // unknown route: deny-default
  if (systemAdmin && entry.allowSystemAdmin !== false) return true;
  if (systemAdmin && entry.allowSystemAdmin === false) return false;
  if (entry.roles?.some((role) => user.roles?.includes(role))) return true;
  if (!entry.permission) return true;
  return hasPermission(user, entry.permission);
}