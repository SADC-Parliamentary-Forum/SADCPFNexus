"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { authApi, clearAuthCookie } from "@/lib/api";
import { canAccessRoute, getStoredUser, isSystemAdmin } from "@/lib/auth";
import { USER_KEY } from "@/lib/constants";
import type { AuthUser } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

interface NavChild {
  label: string;
  href: string;
  icon: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  section?: string;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Approvals", href: "/approvals", icon: "fact_check" },
  { label: "Alerts & Notifications", href: "/notifications", icon: "notifications_active" },
  {
    label: "Assignments",
    href: "/assignments",
    icon: "task_alt",
    section: "Accountability",
    children: [
      { label: "Overview", href: "/assignments", icon: "bar_chart_4_bars" },
      { label: "New Assignment", href: "/assignments/create", icon: "add_task" },
      { label: "All Assignments", href: "/assignments/all", icon: "list_alt" },
      { label: "Pending Acceptance", href: "/assignments/pending", icon: "pending_actions" },
      { label: "Overdue", href: "/assignments/overdue", icon: "event_busy" },
      { label: "Blocked", href: "/assignments/blocked", icon: "block" },
    ],
  },
  {
    label: "Travel", href: "/travel", icon: "flight_takeoff", section: "Operations",
  },
  { label: "Leave", href: "/leave", icon: "event_available" },
  {
    label: "Procurement",
    href: "/procurement",
    icon: "shopping_cart",
    children: [
      { label: "Requests",        href: "/procurement",                  icon: "bar_chart_4_bars"    },
      { label: "Quotations (RFQ)",href: "/procurement/rfq",              icon: "request_quote"       },
      { label: "Vendors",         href: "/procurement/vendors",          icon: "store"               },
      { label: "Purchase Orders", href: "/procurement/purchase-orders",  icon: "receipt_long"        },
      { label: "Receipts",        href: "/procurement/receipts",         icon: "inventory_2"         },
      { label: "Invoices",        href: "/procurement/invoices",         icon: "request_quote"       },
      { label: "Contracts",       href: "/procurement/contracts",        icon: "description"         },
      { label: "Analytics",       href: "/procurement/analytics",        icon: "analytics"           },
      { label: "New Request",     href: "/procurement/create",           icon: "add_shopping_cart"   },
    ],
  },
  {
    label: "Finance",
    href: "/finance",
    icon: "payments",
    children: [
      { label: "Overview", href: "/finance", icon: "bar_chart_4_bars" },
      { label: "Budgets", href: "/finance/budget", icon: "account_balance" },
      { label: "Salary Advance", href: "/finance/advances", icon: "payments" },
      { label: "Payslips", href: "/finance/payslips", icon: "receipt_long" },
      { label: "Imprest", href: "/imprest", icon: "account_balance_wallet" },
    ],
  },
  { label: "Programmes", href: "/pif", icon: "account_tree", section: "Management" },
  {
    label: "Field Researchers",
    href: "/srhr",
    icon: "science",
    children: [
      { label: "Overview",     href: "/srhr",                  icon: "bar_chart_4_bars" },
      { label: "Parliaments",  href: "/srhr/parliaments",      icon: "account_balance" },
      { label: "Deployments",  href: "/srhr/deployments",      icon: "transfer_within_a_station" },
      { label: "Reports",      href: "/srhr/reports",          icon: "summarize" },
    ],
  },
  {
    label: "Workplan",
    href: "/workplan",
    icon: "calendar_month",
    children: [
      { label: "Events", href: "/workplan", icon: "calendar_month" },
      { label: "Meeting categories", href: "/workplan/meeting-types", icon: "meeting_room" },
      { label: "Event types", href: "/workplan/event-types", icon: "category" },
    ],
  },
  {
    label: "Timesheets",
    href: "/hr/timesheets",
    icon: "schedule",
    section: "Management",
    children: [
      { label: "My Timesheet",  href: "/hr/timesheets",         icon: "edit_note" },
      { label: "Monthly View",  href: "/hr/timesheets/monthly", icon: "calendar_month" },
      { label: "Team View",     href: "/hr/timesheets/team",    icon: "groups" },
      { label: "History",       href: "/hr/timesheets/history", icon: "history" },
    ],
  },
  {
    label: "HR",
    href: "/hr",
    icon: "people",
    children: [
      { label: "Overview", href: "/hr", icon: "bar_chart_4_bars" },
      { label: "Leave", href: "/hr/leave", icon: "event_available" },
      { label: "Leave Balances", href: "/hr/leave/balances", icon: "balance" },
      { label: "Appraisals", href: "/hr/appraisals", icon: "rate_review" },
      { label: "Conduct", href: "/hr/conduct", icon: "gavel" },
      { label: "Performance", href: "/hr/performance", icon: "trending_up" },
      { label: "Incidents", href: "/hr/incidents", icon: "report" },
      { label: "Employee Files", href: "/hr/files", icon: "folder_shared" },
      { label: "Documents", href: "/hr/documents", icon: "description" },
      { label: "Profile Requests", href: "/hr/profile-requests", icon: "manage_accounts" },
      { label: "Payslips", href: "/hr/payslips", icon: "receipt_long" },
      { label: "Departments", href: "/hr/departments", icon: "corporate_fare" },
      { label: "Positions", href: "/hr/positions", icon: "work" },
      { label: "HR Settings", href: "/settings/hr", icon: "tune" },
    ],
  },
  {
    label: "Risk Register",
    href: "/risk",
    icon: "shield",
    section: "Governance",
    children: [
      { label: "All Risks",      href: "/risk",              icon: "bar_chart_4_bars" },
      { label: "Dashboard",     href: "/risk/dashboard",   icon: "dashboard"        },
      { label: "Analytics",     href: "/risk/analytics",   icon: "analytics"        },
      { label: "Audit Trail",   href: "/risk/audit-trail", icon: "history"          },
      { label: "Policy Library",href: "/risk/policies",    icon: "policy"           },
      { label: "Log Risk",      href: "/risk/create",      icon: "add_circle"       },
    ],
  },
  { label: "Reports", href: "/reports", icon: "assessment" },
  {
    label: "Assets",
    href: "/assets",
    icon: "inventory_2",
    children: [
      { label: "Inventory", href: "/assets", icon: "inventory_2" },
      { label: "My Requests", href: "/assets/requests", icon: "request_quote" },
    ],
  },
  {
    label: "Governance",
    href: "/governance",
    icon: "policy",
    section: "Governance",
    children: [
      { label: "Resolutions",        href: "/governance/resolutions", icon: "gavel" },
      { label: "Plenary Sessions",   href: "/governance/plenary",     icon: "groups_3" },
      { label: "Meetings & Minutes", href: "/governance",              icon: "meeting_room" },
    ],
  },
  {
    label: "Correspondence",
    href: "/correspondence",
    icon: "mark_email_read",
    children: [
      { label: "Overview", href: "/correspondence", icon: "bar_chart_4_bars" },
      { label: "New Letter", href: "/correspondence/create", icon: "edit_square" },
      { label: "Registry", href: "/correspondence/registry", icon: "inventory_2" },
      { label: "Incoming Mail", href: "/correspondence/incoming", icon: "move_to_inbox" },
      { label: "Contacts", href: "/correspondence/contacts", icon: "contacts" },
      { label: "Letterhead", href: "/correspondence/letterhead", icon: "description" },
    ],
  },
  { label: "Organogram", href: "/organogram", icon: "account_tree" },
  {
    label: "Analytics",
    href: "/analytics",
    icon: "analytics",
    section: "Intelligence",
    children: [
      { label: "Overview", href: "/analytics", icon: "bar_chart_4_bars" },
      { label: "Audit Ledger", href: "/analytics/ledger", icon: "receipt_long" },
    ],
  },
  {
    label: "Signatures",
    href: "/saam",
    icon: "draw",
    children: [
      { label: "My Signature",  href: "/saam",              icon: "signature" },
      { label: "Delegations",   href: "/saam/delegations",  icon: "supervised_user_circle" },
      { label: "Verify",        href: "/saam/verify",          icon: "verified" },
    ],
  },
  { label: "Help & Support", href: "/profile/support", icon: "help" },
  {
    label: "Administration",
    href: "/admin",
    icon: "admin_panel_settings",
    section: "Configuration",
    children: [
      { label: "Overview",             href: "/admin",               icon: "space_dashboard" },
      { label: "Users",                href: "/admin/users",         icon: "manage_accounts" },
      { label: "Roles & Permissions",  href: "/admin/roles",         icon: "security" },
      { label: "Approval Workflows",   href: "/admin/workflows",     icon: "account_tree" },
      { label: "System Settings",      href: "/admin/settings",      icon: "settings" },
      { label: "Notifications",        href: "/admin/notifications", icon: "notifications" },
      { label: "Audit Logs",           href: "/admin/audit",         icon: "manage_search" },
      { label: "Ledger Verification",  href: "/admin/ledger",        icon: "verified_user" },
      { label: "Data Scope & RLS",     href: "/admin/data-scope",    icon: "database" },
      { label: "Holiday Calendar",     href: "/admin/calendar",      icon: "event_busy" },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOverlayClick: () => void;
}

export function Sidebar({ isOpen, onClose, onOverlayClick }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isCollapsed = !isOpen;

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const navItems = useMemo(() => NAV_ITEMS.map((item) => {
    if (item.children) {
      const children = item.children.filter((c) => canAccessRoute(user, c.href));
      if (children.length === 0) return null;
      return { ...item, children };
    }
    if (!canAccessRoute(user, item.href)) return null;
    return item;
  }).filter((item): item is NavItem => item !== null), [user]);

  // Auto-expand parent when a child is active
  useEffect(() => {
    const updates: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.children) {
        const childActive = item.children.some(
          (c) => pathname === c.href || pathname.startsWith(c.href + "/")
        );
        if (childActive) updates[item.href] = true;
      }
    }
    if (Object.keys(updates).length > 0) {
      setExpanded((prev) => ({ ...prev, ...updates }));
    }
  }, [pathname]);

  const toggleExpand = (href: string) => {
    setExpanded((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem("sadcpf_token");
    localStorage.removeItem(USER_KEY);
    clearAuthCookie();
    router.push("/login");
  };

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  // Group nav items by section
  const sections: { label: string | null; items: NavItem[] }[] = [];
  let currentSection: { label: string | null; items: NavItem[] } = { label: null, items: [] };
  for (const item of navItems) {
    if (item.section && item.section !== currentSection.label) {
      if (currentSection.items.length > 0) sections.push(currentSection);
      currentSection = { label: item.section, items: [item] };
    } else {
      currentSection.items.push(item);
    }
  }
  if (currentSection.items.length > 0) sections.push(currentSection);

  const renderItem = (item: NavItem) => {
    const hasChildren = item.children && item.children.length > 0;

    // A parent is "active" if the pathname matches itself OR any child
    const isParentActive = hasChildren
      ? item.children!.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))
      : pathname === item.href || pathname.startsWith(item.href + "/");

    const isExpanded = expanded[item.href] ?? false;

    // Collapsed: icon-only link (parent goes to first accessible child)
    if (isCollapsed) {
      const collapsedHref = hasChildren
        ? (item.children!.find((c) => canAccessRoute(user, c.href))?.href ?? item.href)
        : item.href;
      return (
        <Link
          key={item.href}
          href={collapsedHref}
          title={item.label}
          className={cn(
            "flex items-center justify-center rounded-lg py-2.5 text-sm font-medium transition-all min-w-0",
            isParentActive
              ? "bg-white/10 text-white"
              : "text-neutral-300 hover:text-white hover:bg-white/10"
          )}
        >
          <span
            className="material-symbols-outlined flex-shrink-0"
            style={{
              fontSize: "22px",
              fontVariationSettings: isParentActive ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400",
            }}
          >
            {item.icon}
          </span>
        </Link>
      );
    }

    if (hasChildren) {
      return (
        <div key={item.href}>
          {/* Parent toggle button */}
          <button
            type="button"
            onClick={() => toggleExpand(item.href)}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              isParentActive
                ? "bg-white/10 text-white"
                : "text-neutral-300 hover:text-white hover:bg-white/10"
            )}
          >
            <span
              className="material-symbols-outlined flex-shrink-0"
              style={{
                fontSize: "20px",
                fontVariationSettings: isParentActive ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400",
              }}
            >
              {item.icon}
            </span>
            <span className="flex-1 truncate text-left">{item.label}</span>
            <span
              className={cn(
                "material-symbols-outlined flex-shrink-0 text-[16px] transition-transform duration-200",
                isExpanded ? "rotate-90" : ""
              )}
            >
              chevron_right
            </span>
          </button>

          {/* Children */}
          {isExpanded && (
            <div className="mt-0.5 ml-3 pl-3 border-l border-neutral-700/60 space-y-0.5">
              {item.children!.map((child) => {
                // Use exact match for index-style hrefs (e.g. /governance) to avoid
                // matching siblings like /governance/resolutions as also active.
                const isChildActive = pathname === child.href ||
                  (child.href !== item.href && pathname.startsWith(child.href + "/"));
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                      isChildActive
                        ? "bg-primary text-white shadow-sm"
                        : "text-neutral-400 hover:text-white hover:bg-white/10"
                    )}
                  >
                    <span
                      className="material-symbols-outlined flex-shrink-0"
                      style={{
                        fontSize: "17px",
                        fontVariationSettings: isChildActive ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400",
                      }}
                    >
                      {child.icon}
                    </span>
                    <span className="truncate">{child.label}</span>
                    {isChildActive && (
                      <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-white/60 flex-shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // Leaf item
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
          isActive
            ? "bg-primary text-white shadow-sm"
            : "text-neutral-300 hover:text-white hover:bg-white/10"
        )}
      >
        <span
          className="material-symbols-outlined flex-shrink-0"
          style={{
            fontSize: "20px",
            fontVariationSettings: isActive ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400",
          }}
        >
          {item.icon}
        </span>
        <span className="truncate">{item.label}</span>
        {isActive && (
          <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-white/60 flex-shrink-0" />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Overlay on small screens when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden
          onClick={onOverlayClick}
        />
      )}
      <aside
        className={cn(
          "flex flex-col bg-background-dark border-r border-neutral-800 shadow-sidebar overflow-hidden z-50 transition-all duration-300 ease-in-out",
          "fixed md:relative inset-y-0 left-0 top-0 flex-shrink-0",
          isOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full md:translate-x-0 md:w-16"
        )}
      >
      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden sidebar-nav min-h-0 flex flex-col gap-0.5",
          isCollapsed ? "p-2" : "p-3 gap-0.5"
        )}
      >
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? (isCollapsed ? "mt-1" : "mt-2") : ""}>
            {section.label && !isCollapsed && (
              <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-500 select-none">
                {section.label}
              </p>
            )}
            <div className={isCollapsed ? "flex flex-col gap-0.5" : "space-y-0.5"}>
              {section.items.map(renderItem)}
            </div>
            {si < sections.length - 1 && !isCollapsed && (
              <div className="my-2 h-px bg-neutral-700/50 mx-2" />
            )}
          </div>
        ))}
      </nav>

      {/* ── User footer ───────────────────────────────────────────────── */}
      <div className={cn("border-t border-neutral-700/50 flex-shrink-0", isCollapsed ? "p-2" : "p-3")}>
        <div
          className={cn(
            "rounded-lg transition-colors",
            isCollapsed
              ? "flex flex-col items-center gap-1.5 py-2"
              : "flex items-center gap-2.5 px-2 py-2 hover:bg-white/5"
          )}
        >
          <div
            className={cn(
              "rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-white font-bold",
              isCollapsed ? "h-8 w-8 text-xs" : "h-8 w-8 text-xs"
            )}
          >
            {initials}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name ?? "Staff Member"}</p>
              <p className="text-[10px] text-neutral-400 truncate">{user?.email ?? "staff@sadcpf.org"}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Sign out"
            className={cn(
              "flex items-center justify-center rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0",
              isCollapsed ? "h-8 w-8" : "h-7 w-7"
            )}
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
