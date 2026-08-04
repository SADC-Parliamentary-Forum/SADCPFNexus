"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { accessApi, authApi, clearAuthCookie, clearMustResetCookie, clearSetupCompleteCookie } from "@/lib/api";
import { canAccessRoute, getStoredUser, isSystemAdmin } from "@/lib/auth";
import { clearStoredUser } from "@/lib/session";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { AccessNavItem, AuthUser } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

interface NavChild {
  label: string;
  href: string;
  icon: string;
  i18nKey?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
  section?: string;
  children?: NavChild[];
  /** Optional i18n key for critical shell labels (EN/FR/PT). */
  i18nKey?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard", i18nKey: "nav.dashboard" },
  { label: "My Work", href: "/my-work", icon: "work", i18nKey: "nav.my_work", children: [
      { label: "My Work Hub", href: "/my-work", icon: "work" },
      { label: "Procurement Evaluations", href: "/my-work/procurement-evaluations", icon: "fact_check" },
    ] },
  { label: "Approvals", href: "/approvals", icon: "fact_check", i18nKey: "nav.approvals" },
  { label: "Alerts & Notifications", href: "/notifications", icon: "notifications_active", i18nKey: "nav.notifications" },
  {
    label: "Assignments",
    href: "/assignments",
    icon: "task_alt",
    section: "Accountability",
    children: [
      { label: "My Dashboard", href: "/assignments", icon: "bar_chart_4_bars" },
      { label: "My Assignments", href: "/assignments/mine", icon: "person" },
      { label: "Assigned by Me", href: "/assignments/assigned-by-me", icon: "assignment_ind" },
      { label: "Awaiting My Review", href: "/assignments/review", icon: "rate_review" },
      { label: "Team Assignments", href: "/assignments/team", icon: "groups" },
      { label: "New Assignment", href: "/assignments/create", icon: "add_task" },
      { label: "Assignment Register", href: "/assignments/register", icon: "list_alt" },
      { label: "Unassigned Queue", href: "/assignments/unassigned", icon: "inbox" },
      { label: "Pending Acceptance", href: "/assignments/pending", icon: "pending_actions" },
      { label: "Overdue", href: "/assignments/overdue", icon: "event_busy" },
      { label: "Blocked", href: "/assignments/blocked", icon: "block" },
      { label: "Escalations", href: "/assignments/escalations", icon: "priority_high" },
      { label: "Recurring Tasks", href: "/assignments/recurring", icon: "event_repeat" },
      { label: "Completed", href: "/assignments/completed", icon: "task" },
      { label: "Reports", href: "/assignments/reports", icon: "analytics" },
      { label: "Calendar & ICS", href: "/assignments/calendar", icon: "calendar_month" },
      { label: "Capacity", href: "/assignments/capacity", icon: "group_work" },
    ],
  },
  {
    label: "Weekly Summaries",
    href: "/weekly-summaries",
    icon: "calendar_view_week",
    section: "Accountability",
    children: [
      { label: "My Weekly Summary", href: "/weekly-summaries", icon: "edit_note" },
      { label: "Team Review", href: "/weekly-summaries/review", icon: "rate_review" },
      { label: "Department Summary", href: "/weekly-summaries/department", icon: "corporate_fare" },
      { label: "Institutional Summary", href: "/weekly-summaries/institutional", icon: "account_balance" },
      { label: "Compliance", href: "/weekly-summaries/compliance", icon: "rule" },
      { label: "Email Digest", href: "/reports/weekly", icon: "mail" },
    ],
  },
  {
    label: "Travel",
    href: "/travel",
    icon: "flight_takeoff",
    section: "Operations",
    i18nKey: "nav.travel",
    children: [
      { label: "Travel Dashboard", href: "/travel", icon: "dashboard" },
      { label: "New Travel Requisition", href: "/travel/create", icon: "add_circle" },
      { label: "My Travel Requests", href: "/travel?scope=mine", icon: "person" },
      { label: "Pending My Approval", href: "/travel/queues/approval", icon: "fact_check" },
      { label: "Administration Queue", href: "/travel/queues/admin", icon: "admin_panel_settings" },
      { label: "Admin Dashboard", href: "/travel/dashboards/admin", icon: "admin_panel_settings" },
      { label: "Finance Review Queue", href: "/travel/queues/finance", icon: "account_balance" },
      { label: "Finance Dashboard", href: "/travel/dashboards/finance", icon: "payments" },
      { label: "Director Finance Queue", href: "/travel/queues/director-finance", icon: "verified" },
      { label: "Approved Travel", href: "/travel?view=approved", icon: "verified" },
      { label: "Upcoming Travel", href: "/travel?view=upcoming", icon: "flight" },
      { label: "Travellers Away", href: "/travel?view=away", icon: "public" },
      { label: "Travel Calendar", href: "/travel/calendar", icon: "calendar_month" },
      { label: "Mission Readiness", href: "/travel/missions", icon: "groups" },
      { label: "Travel Advances / Imprest", href: "/imprest?linked=travel", icon: "payments" },
      { label: "Travel Retirement", href: "/travel/queues/retirement", icon: "assignment_turned_in" },
      { label: "Potential Leave-in-Lieu", href: "/travel/toil", icon: "event_available" },
      { label: "Travel Register", href: "/travel/register", icon: "menu_book" },
      { label: "Reports", href: "/travel/reports", icon: "assessment" },
      { label: "Travel Settings", href: "/travel/settings", icon: "settings" },
    ],
  },
  {
    label: "Leave",
    href: "/leave",
    icon: "event_available",
    i18nKey: "nav.leave",
    children: [
      { label: "My Leave", href: "/leave", icon: "event_available" },
      { label: "Apply for Leave", href: "/leave/create", icon: "add_circle" },
      { label: "Leave Calendar", href: "/leave/calendar", icon: "calendar_month" },
      { label: "Recommend Inbox", href: "/leave?queue=recommend", icon: "thumb_up" },
      { label: "Certification Queue", href: "/leave/queues/certify", icon: "verified" },
      { label: "TOIL / LIL Credits", href: "/leave/toil", icon: "more_time" },
      // HR register & balances live under HR nav (canonical staff vs HR split)
    ],
  },
  {
    label: "Procurement",
    href: "/procurement",
    icon: "shopping_cart",
    i18nKey: "nav.procurement",
    children: [
      { label: "Dashboard",         href: "/procurement/analytics",        icon: "analytics"           },
      { label: "New Request",       href: "/procurement/create",           icon: "add_shopping_cart"   },
      { label: "Requests",          href: "/procurement",                  icon: "bar_chart_4_bars"    },
      { label: "Intake",            href: "/procurement/intake",           icon: "inbox"               },
      { label: "Budget Confirmation", href: "/procurement/budget",         icon: "account_balance"     },
      { label: "Quotations (RFQ)",  href: "/procurement/rfq",              icon: "request_quote"       },
      { label: "Tenders",           href: "/procurement/tenders",          icon: "gavel"               },
      { label: "Notice Board",      href: "/procurement/notices",          icon: "campaign"            },
      { label: "Bid Submissions",   href: "/procurement/bid-submissions",  icon: "inbox_customize"     },
      { label: "Evaluations",       href: "/procurement/evaluations",      icon: "fact_check"          },
      { label: "Tender Committee",  href: "/procurement/tender-committee", icon: "groups"              },
      { label: "Planning",          href: "/procurement/planning",         icon: "calendar_month"      },
      { label: "Catalogue",         href: "/procurement/catalogue",        icon: "menu_book"           },
      { label: "Vendors",           href: "/procurement/vendors",          icon: "store"               },
      { label: "Purchase Orders",   href: "/procurement/purchase-orders",  icon: "receipt_long"        },
      { label: "Receipts",          href: "/procurement/receipts",         icon: "inventory_2"         },
      { label: "Invoices",          href: "/procurement/invoices",         icon: "request_quote"       },
      { label: "Contracts",         href: "/procurement/contracts",        icon: "description"         },
      { label: "Register",          href: "/procurement/register",         icon: "menu_book"           },
      { label: "Settings",          href: "/procurement/settings",         icon: "settings"            },
    ],
  },
  {
    label: "Supplier Portal",
    href: "/supplier",
    icon: "storefront",
    children: [
      { label: "Overview", href: "/supplier", icon: "dashboard" },
      { label: "RFQs", href: "/supplier/rfqs", icon: "request_quote" },
      { label: "Purchase Orders", href: "/supplier/purchase-orders", icon: "receipt_long" },
      { label: "Invoices", href: "/supplier/invoices", icon: "description" },
      { label: "Profile", href: "/supplier/profile", icon: "badge" },
    ],
  },
  {
    label: "Finance",
    href: "/finance",
    icon: "payments",
    i18nKey: "nav.finance",
    children: [
      { label: "Overview", href: "/finance", icon: "bar_chart_4_bars" },
      { label: "Budget Control", href: "/budget", icon: "account_balance_wallet" },
      { label: "Budget Cycles", href: "/budget/cycles", icon: "calendar_month" },
      { label: "Budget Changes", href: "/budget/changes", icon: "swap_horiz" },
      { label: "Budget Variance", href: "/budget/variance", icon: "trending_down" },
      { label: "Budget Reports", href: "/budget/reports", icon: "analytics" },
      { label: "Cashflow / Scenarios", href: "/budget/cashflow", icon: "waterfall_chart" },
      { label: "FX Rates", href: "/budget/fx-rates", icon: "currency_exchange" },
      { label: "Contribution Schedules", href: "/budget/contribution-schedules", icon: "event_repeat" },
      { label: "Budgets", href: "/finance/budget", icon: "account_balance" },
      { label: "Payslips", href: "/finance/payslips", icon: "receipt_long" },
      { label: "Payroll Imports", href: "/finance/payroll-imports", icon: "upload_file" },
      { label: "Imprest", href: "/imprest", icon: "account_balance_wallet" },
      { label: "Balance Register", href: "/finance/balance-register", icon: "balance" },
    ],
  },
  {
    label: "Salary Advances",
    href: "/salary-advances",
    icon: "payments",
    section: "Operations",
    children: [
      { label: "Salary Advance Dashboard", href: "/salary-advances", icon: "dashboard" },
      { label: "Apply for Salary Advance", href: "/salary-advances/create", icon: "add_circle" },
      { label: "My Applications", href: "/salary-advances/applications", icon: "list_alt" },
      { label: "My Advance History", href: "/salary-advances/history", icon: "history" },
      { label: "Finance Dashboard", href: "/salary-advances/finance", icon: "monitoring" },
      { label: "Pending Finance Certification", href: "/salary-advances/queues/certify", icon: "verified" },
      { label: "Pending Approval", href: "/salary-advances/pending-approval", icon: "fact_check" },
      { label: "Approved for Payment", href: "/salary-advances/queues/payment", icon: "account_balance" },
      { label: "Payroll Recovery Queue", href: "/salary-advances/queues/recovery", icon: "event_repeat" },
      { label: "Outstanding Advances", href: "/salary-advances/outstanding", icon: "pending" },
      { label: "Reconciliation Queue", href: "/salary-advances/reconciliation", icon: "compare_arrows" },
      { label: "Salary Advance Register", href: "/salary-advances/register", icon: "menu_book" },
      { label: "Reports", href: "/salary-advances/reports", icon: "assessment" },
      { label: "Settings", href: "/salary-advances/settings", icon: "settings" },
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
      { label: "My Timesheet", href: "/hr/timesheets", icon: "edit_note" },
      { label: "Record Time", href: "/hr/timesheets", icon: "add_circle" },
      { label: "Monthly View", href: "/hr/timesheets/monthly", icon: "calendar_month" },
      { label: "My Overtime", href: "/hr/timesheets/overtime", icon: "more_time" },
      { label: "Team View", href: "/hr/timesheets/team", icon: "groups" },
      { label: "Pending Approval", href: "/hr/timesheets/team?status=submitted", icon: "pending_actions" },
      { label: "Work Schedules", href: "/hr/timesheets/schedules", icon: "event_available" },
      { label: "OT Validation", href: "/hr/timesheets/overtime?queue=hr", icon: "verified" },
      { label: "Payroll Export", href: "/hr/timesheets/payroll", icon: "payments" },
      { label: "Templates", href: "/hr/timesheets/templates", icon: "description" },
      { label: "History", href: "/hr/timesheets/history", icon: "history" },
    ],
  },
  {
    label: "HR",
    href: "/hr",
    icon: "people",
    i18nKey: "nav.hr",
    children: [
      { label: "Overview", href: "/hr", icon: "bar_chart_4_bars" },
      { label: "Staff Leave Register", href: "/hr/leave", icon: "menu_book" },
      { label: "Leave Balances", href: "/hr/leave/balances", icon: "balance" },
      { label: "Leave Certify Queue", href: "/leave/queues/certify", icon: "verified" },
      { label: "TOIL Credits", href: "/leave/toil", icon: "more_time" },
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
      { label: "Controls",      href: "/risk/controls",    icon: "verified_user"    },
      { label: "Incidents",     href: "/risk/incidents",   icon: "report"           },
      { label: "Appetite",      href: "/risk/appetite",    icon: "tune"             },
      { label: "Audit Trail",   href: "/risk/audit-trail", icon: "history"          },
      { label: "Policy Library",href: "/risk/policies",    icon: "policy"           },
      { label: "Log Risk",      href: "/risk/create",      icon: "add_circle"       },
      { label: "KRI Automation", href: "/risk/kri", icon: "speed" },
        { label: "Control Testing", href: "/risk/control-testing", icon: "fact_check" },
        { label: "BCP / Insurance", href: "/risk/bcp", icon: "health_and_safety" },
    ],
  },
  {
    label: "Audit Management",
    href: "/audit",
    icon: "policy",
    section: "Governance",
    children: [
      { label: "Dashboard", href: "/audit", icon: "dashboard" },
      { label: "Analytics", href: "/audit/analytics", icon: "analytics" },
      { label: "Universe", href: "/audit/universe", icon: "hub" },
      { label: "Plans", href: "/audit/plans", icon: "calendar_month" },
      { label: "Engagements", href: "/audit/engagements", icon: "assignment" },
      { label: "Findings", href: "/audit/findings", icon: "report" },
      { label: "Corrective Actions", href: "/audit/corrective-actions", icon: "task_alt" },
      { label: "Campaigns", href: "/audit/campaigns", icon: "fact_check" },
      { label: "Resources", href: "/audit/resources", icon: "groups" },
      { label: "QA Reviews", href: "/audit/qa", icon: "verified" },
      { label: "Templates", href: "/audit/templates", icon: "description" },
      { label: "Governance Packs", href: "/audit/governance-packs", icon: "folder_special" },
      { label: "Appointments", href: "/audit/appointments", icon: "handshake" },
      { label: "External Audit", href: "/audit/external", icon: "public" },
      { label: "AI Assist", href: "/audit/ai", icon: "smart_toy" },
      { label: "Settings / Charter", href: "/audit/settings", icon: "settings" },
    ],
  },
  {
    label: "People & Authority",
    href: "/people",
    icon: "badge",
    section: "Governance",
    children: [
      { label: "Hub", href: "/people", icon: "dashboard" },
      { label: "My Profile", href: "/profile", icon: "person" },
      { label: "My Signature", href: "/saam", icon: "draw" },
      { label: "Staff Directory", href: "/people/directory", icon: "contacts" },
      { label: "Organisation Chart", href: "/organogram", icon: "account_tree" },
      { label: "Authority Register", href: "/people/authority", icon: "gavel" },
      { label: "Delegations", href: "/people/delegations", icon: "handshake" },
      { label: "Acting Appointments", href: "/people/acting", icon: "supervisor_account" },
      { label: "Verify Signature", href: "/verify-signature", icon: "verified_user" },
    ],
  },
  {
    label: "M&E / Results Monitoring",
    href: "/mande",
    icon: "monitoring",
    section: "Governance",
    i18nKey: "nav.mande",
    children: [
      { label: "Dashboard", href: "/mande", icon: "dashboard" },
      { label: "Intake Queue", href: "/mande/intake", icon: "inbox" },
      { label: "My Reports", href: "/mande/activity-reports/mine", icon: "assignment_ind" },
      { label: "All Reports", href: "/mande/activity-reports", icon: "description" },
      { label: "Review Queue", href: "/mande/review-queue", icon: "rate_review" },
      { label: "PM Review", href: "/mande/pm-review", icon: "supervisor_account" },
      { label: "Strategic Plans", href: "/mande/strategic-plan", icon: "flag" },
      { label: "Results Frameworks", href: "/mande/results", icon: "account_tree" },
      { label: "Indicators", href: "/mande/indicators", icon: "speed" },
      { label: "Calendar", href: "/mande/calendar", icon: "calendar_month" },
      { label: "Reports", href: "/mande/reports", icon: "assessment" },
      { label: "Data Quality", href: "/mande/data-quality", icon: "fact_check" },
      { label: "Import", href: "/mande/import", icon: "upload_file" },
      { label: "Settings", href: "/mande/settings", icon: "settings" },
    ],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "assessment",
    i18nKey: "nav.reports",
    children: [
      { label: "Overview",        href: "/reports",         icon: "bar_chart_4_bars" },
      { label: "Weekly Summary",  href: "/reports/weekly",  icon: "calendar_month" },
    ],
  },
  {
    label: "Fixed Assets",
    href: "/assets",
    icon: "inventory_2",
    children: [
      { label: "Dashboard", href: "/assets/dashboard", icon: "dashboard" },
      { label: "Register", href: "/assets", icon: "inventory_2" },
      { label: "Fleet", href: "/fleet", icon: "directions_car" },
      { label: "Fleet Utilisation", href: "/fleet/utilisation", icon: "speed" },
      { label: "Intake / Pending", href: "/assets/intake", icon: "pending_actions" },
      { label: "My Assets", href: "/assets/mine", icon: "person" },
      { label: "Transfers", href: "/assets/transfers", icon: "swap_horiz" },
      { label: "Verification", href: "/assets/verification", icon: "fact_check" },
      { label: "Maintenance", href: "/assets/maintenance", icon: "build" },
      { label: "Depreciation", href: "/assets/depreciation", icon: "trending_down" },
      { label: "Disposal", href: "/assets/disposal", icon: "delete_forever" },
      { label: "Revaluation", href: "/assets/revaluation", icon: "currency_exchange" },
      { label: "Reports", href: "/assets/reports", icon: "summarize" },
      { label: "Settings", href: "/assets/settings", icon: "settings" },
      { label: "Categories", href: "/assets/categories", icon: "category" },
      { label: "My Requests", href: "/assets/requests", icon: "request_quote" },
      { label: "Insurance", href: "/assets/insurance", icon: "health_and_safety" },
    ],
  },
  {
    label: "Consumables / Stock",
    href: "/stock",
    icon: "shelves",
    children: [
      { label: "Dashboard", href: "/stock/dashboard", icon: "dashboard" },
      { label: "Stock Items", href: "/stock", icon: "inventory" },
      { label: "Stock Requests", href: "/stock/requests", icon: "assignment" },
      { label: "Issues / Vouchers", href: "/stock/issues", icon: "outbox" },
      { label: "Returns", href: "/stock/returns", icon: "assignment_return" },
      { label: "Transfers", href: "/stock/transfers", icon: "swap_horiz" },
      { label: "Stock Movements", href: "/stock/movements", icon: "swap_vert" },
      { label: "Stocktakes", href: "/stock/stocktakes", icon: "fact_check" },
      { label: "Barcode Scan", href: "/stock/scan", icon: "qr_code_scanner" },
      { label: "Write-Offs", href: "/stock/write-offs", icon: "delete_forever" },
      { label: "Replenishment", href: "/stock/replenishments", icon: "shopping_cart" },
      { label: "Low Stock / Reorder", href: "/stock/low-stock", icon: "production_quantity_limits" },
      { label: "Batches / Expiry", href: "/stock/batches", icon: "qr_code_2" },
      { label: "Reports", href: "/stock/reports", icon: "summarize" },
      { label: "Locations", href: "/stock/locations", icon: "warehouse" },
      { label: "Units", href: "/stock/units", icon: "straighten" },
      { label: "Categories", href: "/stock/categories", icon: "category" },
      { label: "Forecasting", href: "/stock/phase2/forecasting", icon: "trending_up" },
    ],
  },
  {
    label: "Governance",
    href: "/governance",
    icon: "policy",
    section: "Governance",
    children: [
      { label: "Decision Register",  href: "/decisions",              icon: "gavel" },
      { label: "Resolutions (legacy)", href: "/governance/resolutions", icon: "description" },
      { label: "Plenary Sessions",   href: "/governance/plenary",     icon: "groups_3" },
      { label: "Meetings & Minutes", href: "/governance",              icon: "meeting_room" },
    ],
  },
  {
    label: "Correspondence",
    href: "/correspondence",
    icon: "mark_email_read",
    children: [
      { label: "Dashboard", href: "/correspondence", icon: "bar_chart_4_bars" },
      { label: "Register Incoming", href: "/correspondence/incoming", icon: "move_to_inbox" },
      { label: "Incoming Register", href: "/correspondence/registry?direction=incoming", icon: "inbox" },
      { label: "Draft Outgoing", href: "/correspondence/create", icon: "edit_square" },
      { label: "Mail Merge", href: "/correspondence/mail-merge", icon: "merge_type" },
      { label: "Outgoing Register", href: "/correspondence/registry?direction=outgoing", icon: "outbox" },
      { label: "My Action Items", href: "/correspondence/my-actions", icon: "assignment_ind" },
      { label: "Pending SG Routing", href: "/correspondence/pending-routing", icon: "route" },
      { label: "Master Register", href: "/correspondence/master-register", icon: "menu_book" },
      { label: "Subject Files", href: "/correspondence/subject-files", icon: "folder_open" },
      { label: "Retention / Legal Holds", href: "/correspondence/retention", icon: "gavel" },
      { label: "Contacts", href: "/correspondence/contacts", icon: "contacts" },
      { label: "Letterhead", href: "/correspondence/letterhead", icon: "description" },
      { label: "Reports", href: "/correspondence/reports", icon: "summarize" },
      { label: "Mailbox", href: "/correspondence/mailbox", icon: "mail" },
    ],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: "analytics",
    section: "Intelligence",
    children: [
      { label: "Overview", href: "/analytics", icon: "bar_chart_4_bars" },
      { label: "Audit Ledger", href: "/admin/ledger", icon: "receipt_long" },
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
      { label: "Overview",             href: "/admin",                  icon: "space_dashboard" },
      { label: "Users",                href: "/admin/users",            icon: "manage_accounts" },
      { label: "Roles & Permissions",  href: "/admin/access/roles",     icon: "security" },
      { label: "Access Governance",    href: "/admin/access",           icon: "policy" },
      { label: "Departments",          href: "/admin/departments",      icon: "corporate_fare" },
      { label: "Portfolios",           href: "/admin/portfolios",       icon: "folder_special" },
      { label: "Approval Workflows",   href: "/admin/workflows",        icon: "account_tree" },
      { label: "Workflow Designer", href: "/admin/workflows/designer", icon: "schema" },
      { label: "Workflow Simulation", href: "/admin/workflows/simulate", icon: "science" },
      { label: "Workflow Analytics", href: "/admin/workflows/analytics", icon: "analytics" },
      { label: "Workflow AI Assist", href: "/admin/workflows/ai", icon: "psychology" },
      { label: "System Settings",      href: "/admin/settings",         icon: "settings" },
      { label: "HR Settings",          href: "/settings/hr",            icon: "tune" },
      { label: "Notifications",        href: "/admin/notifications",    icon: "notifications" },
      { label: "Timesheet Projects",   href: "/admin/timesheet-projects", icon: "task_alt" },
      { label: "Holiday Calendar",     href: "/admin/calendar",         icon: "event_busy" },
      { label: "Payslip Upload",       href: "/admin/payslips",         icon: "upload_file" },
      { label: "Salary Assignments",   href: "/admin/salary-assignments", icon: "badge" },
      { label: "Platform Audit Trail", href: "/admin/audit-trail",      icon: "policy" },
      { label: "Document Register",    href: "/admin/documents",        icon: "folder_managed" },
      { label: "Ledger Verification",  href: "/admin/ledger",           icon: "verified_user" },
      { label: "Data Scope & RLS",     href: "/admin/data-scope",       icon: "database" },
      { label: "Weekly Summary",       href: "/admin/weekly-summary",   icon: "calendar_month" },
    ],
  },
];

const MANIFEST_I18N_KEYS: Record<string, string> = {
  Dashboard: "nav.dashboard",
  "My Work": "nav.my_work",
  Approvals: "nav.approvals",
  "Alerts & Notifications": "nav.notifications",
  Travel: "nav.travel",
  Leave: "nav.leave",
  Procurement: "nav.procurement",
  Finance: "nav.finance",
  HR: "nav.hr",
  "M&E": "nav.mande",
  Reports: "nav.reports",
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOverlayClick: () => void;
}

function navItemFromManifest(item: AccessNavItem): NavItem | null {
  const children = (item.children ?? [])
    .map(navItemFromManifest)
    .filter((child): child is NavItem => child !== null)
    .map((child) => ({ label: child.label, href: child.href, icon: child.icon, i18nKey: child.i18nKey }));
  const href = item.href ?? children[0]?.href;

  if (!href) return null;

  return {
    label: item.label,
    href,
    icon: item.icon,
    i18nKey: MANIFEST_I18N_KEYS[item.label],
    children: children.length > 0 ? children : undefined,
  };
}

export function Sidebar({ isOpen, onClose, onOverlayClick }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [manifestItems, setManifestItems] = useState<NavItem[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isCollapsed = !isOpen;

  const navLabel = (item: NavItem) => (item.i18nKey ? t(item.i18nKey) : item.label);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    let cancelled = false;
    accessApi.navigation()
      .then(({ data }) => {
        if (cancelled) return;
        const items = (data.data.items ?? [])
          .map(navItemFromManifest)
          .filter((item): item is NavItem => item !== null);
        setManifestItems(items.length > 0 ? items : null);
      })
      .catch(() => {
        if (!cancelled) setManifestItems(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = useMemo(() => {
    // The server manifest is intentionally conservative and is still being
    // expanded module by module. A system administrator must see the full
    // application catalogue so newly deployed modules are not hidden merely
    // because their navigation entry has not reached the manifest yet.
    if (manifestItems && !isSystemAdmin(user)) return manifestItems;

    return NAV_ITEMS.map((item) => {
    if (item.children) {
      const children = item.children.filter((c) => canAccessRoute(user, c.href));
      if (children.length === 0) return null;
      return { ...item, children };
    }
    if (!canAccessRoute(user, item.href)) return null;
    return item;
    }).filter((item): item is NavItem => item !== null);
  }, [manifestItems, user]);

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
    clearStoredUser();
    clearAuthCookie();
    clearMustResetCookie();
    clearSetupCompleteCookie();
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
        ? (item.children![0]?.href ?? item.href)
        : item.href;
      return (
        <Link
          key={item.href}
          href={collapsedHref}
          title={navLabel(item)}
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
      const childGroupId = `sidebar-section-${item.href.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "root"}`;
      return (
        <div key={item.href}>
          {/* Parent toggle button */}
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={childGroupId}
            aria-label={`${navLabel(item)} navigation section`}
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
            <span className="flex-1 truncate text-left">{navLabel(item)}</span>
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
            <div id={childGroupId} role="group" aria-label={`${navLabel(item)} links`} className="mt-0.5 ml-3 pl-3 border-l border-neutral-700/60 space-y-0.5">
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
                    <span className="truncate">{navLabel(child)}</span>
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
        <span className="truncate">{navLabel(item)}</span>
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
            title={t("nav.signOut")}
            aria-label={t("nav.signOut")}
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
