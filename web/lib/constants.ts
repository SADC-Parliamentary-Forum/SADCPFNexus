/**
 * Central constants file — no magic strings or numbers scattered in UI components.
 * All lists that drive dropdowns, badge colours, or lookups live here.
 */

// ─── Organisation ─────────────────────────────────────────────────────────────
export const ORG_NAME = "SADC Parliamentary Forum";
export const ORG_ABBR = "SADC-PF";
export const APP_NAME = "SADC-PF Nexus";
export const APP_VERSION = "4.2.0";

// ─── Authentication ───────────────────────────────────────────────────────────
export const USER_KEY  = "sadcpf_user";
export const PREFS_KEY = "sadcpf_user_prefs";
export const RECENT_SEARCHES_KEY = "sadcpf_recent_searches";

// ─── Currencies ───────────────────────────────────────────────────────────────
export const CURRENCIES = ["NAD", "USD", "EUR", "ZAR", "BWP", "ZMW", "MZN", "TZS", "UGX"] as const;
export type Currency = typeof CURRENCIES[number];

// ─── Timezones (SADC member states) ──────────────────────────────────────────
export const TIMEZONES = [
  "Africa/Windhoek",
  "Africa/Johannesburg",
  "Africa/Harare",
  "Africa/Lusaka",
  "Africa/Gaborone",
  "Africa/Maputo",
  "Africa/Nairobi",
  "Africa/Blantyre",
  "Africa/Dar_es_Salaam",
  "Africa/Kinshasa",
  "Indian/Mauritius",
  "Africa/Mbabane",
  "UTC",
] as const;
export type Timezone = typeof TIMEZONES[number];

// ─── Languages ────────────────────────────────────────────────────────────────
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
] as const;

// ─── Date formats ─────────────────────────────────────────────────────────────
export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MMM-YYYY"] as const;

// ─── Data classification levels ───────────────────────────────────────────────
export const CLASSIFICATION_LEVELS = ["UNCLASSIFIED", "RESTRICTED", "CONFIDENTIAL", "SECRET"] as const;
export type ClassificationLevel = typeof CLASSIFICATION_LEVELS[number];

export const CLASSIFICATION_BADGE: Record<ClassificationLevel, string> = {
  UNCLASSIFIED: "badge-muted",
  RESTRICTED:   "badge-warning",
  CONFIDENTIAL: "badge-warning",
  SECRET:       "badge-danger",
};

// ─── Asset categories ─────────────────────────────────────────────────────────
export const ASSET_CATEGORIES = ["IT Equipment", "Furniture & Fixtures", "Vehicles", "Other Assets"] as const;
export type AssetCategory = typeof ASSET_CATEGORIES[number];

export const ASSET_CONDITIONS = ["New", "Good", "Fair", "Poor"] as const;
export type AssetCondition = typeof ASSET_CONDITIONS[number];

export const ASSET_CONDITION_BADGE: Record<AssetCondition, string> = {
  New:  "badge-success",
  Good: "badge-primary",
  Fair: "badge-warning",
  Poor: "badge-danger",
};

// ─── Programme / PIF ─────────────────────────────────────────────────────────
export const PROGRAMME_STATUSES = ["Active", "Completed", "On Hold", "Cancelled"] as const;
export type ProgrammeStatus = typeof PROGRAMME_STATUSES[number];

export const PROGRAMME_STATUS_BADGE: Record<ProgrammeStatus, string> = {
  Active:    "badge-success",
  Completed: "badge-primary",
  "On Hold": "badge-warning",
  Cancelled: "badge-danger",
};

export const ACTIVITY_STATUSES = ["Planned", "In Progress", "Completed", "Cancelled"] as const;
export type ActivityStatus = typeof ACTIVITY_STATUSES[number];

export const MILESTONE_STATUSES = ["Pending", "Achieved", "Missed"] as const;
export type MilestoneStatus = typeof MILESTONE_STATUSES[number];

export const DELIVERABLE_STATUSES = ["Pending", "Submitted", "Accepted"] as const;
export type DeliverableStatus = typeof DELIVERABLE_STATUSES[number];

// ─── Workplan event types ─────────────────────────────────────────────────────
export const EVENT_TYPES = ["meeting", "travel", "leave", "milestone", "deadline"] as const;
export type EventType = typeof EVENT_TYPES[number];

export const EVENT_TYPE_STYLE: Record<EventType, { bg: string; text: string; dot: string }> = {
  meeting:   { bg: "bg-primary/10",  text: "text-primary",    dot: "bg-primary"    },
  travel:    { bg: "bg-teal-50",     text: "text-teal-700",   dot: "bg-teal-500"   },
  leave:     { bg: "bg-amber-50",    text: "text-amber-700",  dot: "bg-amber-500"  },
  milestone: { bg: "bg-purple-50",   text: "text-purple-700", dot: "bg-purple-500" },
  deadline:  { bg: "bg-red-50",      text: "text-red-700",    dot: "bg-red-500"    },
};

/** Style for public holidays (calendar entries) shown in workplan */
export const PUBLIC_HOLIDAY_STYLE = { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" };

// ─── System roles ────────────────────────────────────────────────────────────
export const SYSTEM_ROLES = ["Administrator", "Finance Officer", "HR Officer", "Staff", "Read Only"] as const;
export type SystemRole = typeof SYSTEM_ROLES[number];

export const ROLE_DESCRIPTIONS: Record<SystemRole, string> = {
  Administrator:    "Full system access — all modules and settings",
  "Finance Officer": "Manage finance, imprest, and travel approvals",
  "HR Officer":      "Leave management, timesheets, and staff records",
  Staff:             "Self-service — submit travel, leave, and imprest requests",
  "Read Only":       "View-only access across all operational modules",
};

// ─── Module permission actions ────────────────────────────────────────────────
export const MODULE_ACTIONS = {
  view:     { label: "View",           color: "bg-neutral-100 text-neutral-600" },
  create:   { label: "Create",         color: "bg-blue-50 text-blue-700"        },
  edit:     { label: "Edit",           color: "bg-amber-50 text-amber-700"      },
  approve:  { label: "Approve",        color: "bg-green-50 text-green-700"      },
  admin:    { label: "Admin",          color: "bg-red-50 text-red-700"          },
  export:   { label: "Export",         color: "bg-teal-50 text-teal-700"        },
  users:    { label: "Manage Users",   color: "bg-purple-50 text-purple-700"    },
  roles:    { label: "Manage Roles",   color: "bg-indigo-50 text-indigo-700"    },
  settings: { label: "System Settings",color: "bg-amber-50 text-amber-700"     },
  audit:    { label: "Audit Logs",     color: "bg-neutral-100 text-neutral-600" },
} as const;

// ─── Module definitions (for permissions matrix) ─────────────────────────────
export const MODULE_DEFINITIONS = [
  { module: "Dashboard",   icon: "dashboard",              actions: ["view"] as string[] },
  { module: "Alerts",      icon: "notifications_active",   actions: ["view"] as string[] },
  { module: "Travel",      icon: "flight_takeoff",         actions: ["view","create","edit","approve","admin"] },
  { module: "Leave",       icon: "event_available",        actions: ["view","create","edit","approve","admin"] },
  { module: "Finance",     icon: "payments",               actions: ["view","create","edit","approve","admin"] },
  { module: "Imprest",     icon: "account_balance_wallet", actions: ["view","create","edit","approve","admin"] },
  { module: "Programmes",  icon: "account_tree",           actions: ["view","create","edit","admin"] },
  { module: "Workplan",    icon: "calendar_month",         actions: ["view","create","edit","admin"] },
  { module: "HR",          icon: "people",                 actions: ["view","create","edit","approve","admin"] },
  { module: "Reports",     icon: "assessment",             actions: ["view","export"] },
  { module: "Assets",      icon: "inventory_2",            actions: ["view","create","edit","admin"] },
  { module: "Governance",  icon: "policy",                 actions: ["view","create","edit","admin"] },
  { module: "Admin",       icon: "admin_panel_settings",   actions: ["view","users","roles","settings","audit"] },
] as const;

// ─── Role preset permissions ──────────────────────────────────────────────────
export const ROLE_PERMISSION_PRESETS: Record<SystemRole, Record<string, string[]>> = {
  Administrator: {
    Dashboard: ["view"], Alerts: ["view"],
    Travel: ["view","create","edit","approve","admin"], Leave: ["view","create","edit","approve","admin"],
    Finance: ["view","create","edit","approve","admin"], Imprest: ["view","create","edit","approve","admin"],
    Programmes: ["view","create","edit","admin"], Workplan: ["view","create","edit","admin"],
    HR: ["view","create","edit","approve","admin"], Reports: ["view","export"],
    Assets: ["view","create","edit","admin"], Governance: ["view","create","edit","admin"],
    Admin: ["view","users","roles","settings","audit"],
  },
  "Finance Officer": {
    Dashboard: ["view"], Alerts: ["view"],
    Travel: ["view","approve"], Leave: ["view"],
    Finance: ["view","create","edit","approve"], Imprest: ["view","create","edit","approve"],
    Programmes: ["view"], Workplan: ["view"], HR: ["view"], Reports: ["view","export"],
    Assets: ["view"], Governance: ["view"], Admin: [],
  },
  "HR Officer": {
    Dashboard: ["view"], Alerts: ["view"],
    Travel: ["view","approve"], Leave: ["view","create","edit","approve"],
    Finance: ["view"], Imprest: ["view"],
    Programmes: ["view"], Workplan: ["view"],
    HR: ["view","create","edit","approve"], Reports: ["view","export"],
    Assets: ["view"], Governance: ["view"], Admin: ["view"],
  },
  Staff: {
    Dashboard: ["view"], Alerts: ["view"],
    Travel: ["view","create"], Leave: ["view","create"],
    Finance: ["view"], Imprest: ["view","create"],
    Programmes: ["view"], Workplan: ["view"], HR: ["view"], Reports: ["view"],
    Assets: ["view"], Governance: ["view"], Admin: [],
  },
  "Read Only": {
    Dashboard: ["view"], Alerts: ["view"],
    Travel: ["view"], Leave: ["view"], Finance: ["view"], Imprest: ["view"],
    Programmes: ["view"], Workplan: ["view"], HR: ["view"], Reports: ["view"],
    Assets: ["view"], Governance: ["view"], Admin: [],
  },
};

// ─── Admin module lookup types ────────────────────────────────────────────────
export const ADMIN_MODULES = [
  "Travel", "Leave", "Finance", "Imprest", "Programmes",
  "Workplan", "HR", "Reports", "Assets", "Governance", "Admin",
] as const;

// ─── Session timeouts ─────────────────────────────────────────────────────────
export const SESSION_TIMEOUT_OPTIONS = [
  { value: "15",  label: "15 minutes"              },
  { value: "30",  label: "30 minutes"              },
  { value: "60",  label: "1 hour"                  },
  { value: "120", label: "2 hours"                 },
  { value: "480", label: "8 hours (work day)"      },
  { value: "0",   label: "Never (not recommended)" },
] as const;

// ─── Audit actions ────────────────────────────────────────────────────────────
export const AUDIT_ACTIONS = ["CREATE","UPDATE","DELETE","APPROVE","REJECT","LOGIN","LOGOUT","SUBMIT","VIEW","EXPORT"] as const;
export type AuditAction = typeof AUDIT_ACTIONS[number];

export const AUDIT_ACTION_BADGE: Record<AuditAction, string> = {
  CREATE:  "badge-success",
  UPDATE:  "badge-primary",
  DELETE:  "badge-danger",
  APPROVE: "badge-success",
  REJECT:  "badge-danger",
  LOGIN:   "badge-muted",
  LOGOUT:  "badge-muted",
  SUBMIT:  "badge-warning",
  VIEW:    "badge-muted",
  EXPORT:  "badge-muted",
};

// ─── Fiscal year months ───────────────────────────────────────────────────────
export const MONTHS_OF_YEAR = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
] as const;

// ─── PIF / Programme Implementation System ───────────────────────────────────
export const PIF_STRATEGIC_ALIGNMENTS = [
  "SADC PF Strategic Plan 2024–2028",
  "Annual Operational Plan",
  "Committee Resolution",
  "Plenary Decision",
  "Executive Committee Mandate",
  "Donor Agreement",
] as const;

export const PIF_STRATEGIC_PILLARS = [
  "Governance & Human Rights",
  "Trade & Economic Development",
  "Food, Agriculture & Natural Resources",
  "Gender & Youth",
  "Health & Social Development",
  "Institutional Strengthening",
  "Other",
] as const;

export const PIF_PROGRAMME_STATUSES = [
  "Draft", "Submitted", "Approved", "Active", "On Hold", "Completed", "Financially Closed", "Archived",
] as const;
export type PifProgrammeStatus = typeof PIF_PROGRAMME_STATUSES[number];

export const DEPARTMENTS = [
  "Governance & Human Rights",
  "Finance",
  "ICT",
  "HR & Administration",
  "Media & Communication",
  "Language Services",
  "Research & Knowledge Management",
  "Gender & Youth",
  "Trade & Development",
] as const;
export type Department = typeof DEPARTMENTS[number];

export const SUPPORT_DEPARTMENTS = [
  "Finance", "ICT", "HR", "Media & Communication", "Admin", "Language Services", "Research", "Other",
] as const;

export const PROGRAMME_BENEFICIARIES = [
  "MPs", "Parliamentary Staff", "Citizens", "Civil Society", "Youth", "Women", "Media", "Other",
] as const;

export const PIF_ACTIVITY_STATUSES = [
  "Draft", "Approved", "In Progress", "Completed", "Postponed", "Cancelled",
] as const;
export type PifActivityStatus = typeof PIF_ACTIVITY_STATUSES[number];

export const FUNDING_SOURCES = ["Core Budget", "Donor", "Cost-sharing", "Other"] as const;
export type FundingSource = typeof FUNDING_SOURCES[number];

export const BUDGET_CATEGORIES = [
  "Travel", "Accommodation", "Per Diem", "Venue", "Catering",
  "ICT Support", "Media", "Translation", "Consultancy",
  "Printing", "Equipment", "Contingency",
] as const;
export type BudgetCategory = typeof BUDGET_CATEGORIES[number];

export const PROCUREMENT_METHODS = ["Direct Purchase", "3 Quotations", "Tender"] as const;
export type ProcurementMethod = typeof PROCUREMENT_METHODS[number];

// ─── Payslip upload ───────────────────────────────────────────────────────────
export const PAYSLIP_ACCEPTED_TYPES = ".pdf,.xlsx,.xls";
export const PAYSLIP_EMPLOYEE_PATTERN = /EMP\d+/i;
export const PAYSLIP_MONTH_NAMES = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december",
];
