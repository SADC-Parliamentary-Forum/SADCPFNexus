/** Dashboard tile visibility — org hubs stay hidden unless the user holds hub keys. */

import { canAccessRoute, hasPermission, type AuthAccessUser } from "./authAccess.ts";

export type DashboardModule = {
  label: string;
  href: string;
  icon: string;
  desc: string;
  /**
   * Extra assigned keys required to advertise this organisation hub.
   * Self-service `.view` (e.g. correspondence.view, governance.view, risk.view)
   * still unlocks the route for own records, but must not put the registry
   * on every employee's dashboard.
   */
  hubPermissions?: string | string[];
};

export const DASHBOARD_MODULES: DashboardModule[] = [
  { label: "Travel", href: "/travel", icon: "flight_takeoff", desc: "Missions & DSA" },
  { label: "Leave", href: "/leave", icon: "event_available", desc: "Leave management" },
  { label: "Finance", href: "/finance", icon: "payments", desc: "Payslips & advances" },
  { label: "Imprest", href: "/imprest", icon: "account_balance_wallet", desc: "Petty cash" },
  { label: "Procurement", href: "/procurement", icon: "shopping_cart", desc: "Requisitions" },
  { label: "Stock", href: "/stock", icon: "inventory_2", desc: "Consumables" },
  { label: "Assets", href: "/assets", icon: "precision_manufacturing", desc: "Fixed assets" },
  { label: "Fleet", href: "/fleet", icon: "directions_car", desc: "Vehicles & bookings" },
  { label: "HR", href: "/hr", icon: "people", desc: "Timesheets & leave" },
  { label: "People", href: "/people", icon: "badge", desc: "Directory & authority" },
  { label: "Assignments", href: "/assignments", icon: "task_alt", desc: "Tasks & accountability" },
  { label: "Workplan", href: "/workplan", icon: "calendar_month", desc: "Institutional calendar" },
  {
    label: "Correspondence",
    href: "/correspondence",
    icon: "mail",
    desc: "Registry & letters",
    hubPermissions: ["correspondence.registry", "correspondence.admin", "correspondence.route"],
  },
  {
    label: "Governance",
    href: "/governance",
    icon: "gavel",
    desc: "Resolutions & meetings",
    hubPermissions: ["governance.admin", "governance.approve", "governance.create"],
  },
  {
    label: "Risk",
    href: "/risk",
    icon: "warning",
    desc: "Risk register",
    hubPermissions: ["risk.review", "risk.manage", "risk.admin", "risk.approve"],
  },
  { label: "Audit", href: "/audit", icon: "policy", desc: "Plans & findings" },
  { label: "Reports", href: "/reports", icon: "summarize", desc: "Exports & packs" },
  { label: "Admin", href: "/admin", icon: "admin_panel_settings", desc: "Users & settings" },
];

export function canShowDashboardModule(
  user: AuthAccessUser | null | undefined,
  module: DashboardModule
): boolean {
  if (!canAccessRoute(user, module.href)) return false;
  if (!module.hubPermissions) return true;
  return hasPermission(user, module.hubPermissions);
}

export function dashboardModulesForUser(user: AuthAccessUser | null | undefined): DashboardModule[] {
  return DASHBOARD_MODULES.filter((module) => canShowDashboardModule(user, module));
}
