/**
 * Workflow module -> record presentation and deep link. Shared by the
 * approvals inbox and the "Needs my action" queue so both link to the same
 * record pages. Unknown modules fall back to the approvals inbox.
 */
export type ModuleLink = { icon: string; color: string; bg: string; label: string; href: (id: number) => string };

export const MODULE_CONFIG: Record<string, ModuleLink> = {
  travel: {
    icon: "flight_takeoff",
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Travel",
    href: (id) => `/travel/${id}`,
  },
  leave: {
    icon: "event_available",
    color: "text-green-600 dark:text-green-300",
    bg: "bg-green-50 dark:bg-green-900/20",
    label: "Leave",
    href: (id) => `/leave/${id}`,
  },
  imprest: {
    icon: "account_balance_wallet",
    color: "text-amber-600 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    label: "Imprest",
    href: (id) => `/imprest/${id}`,
  },
  purchase_order: {
    icon: "receipt_long",
    color: "text-rose-600 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    label: "LPO",
    href: (id) => `/procurement/purchase-orders/${id}`,
  },
  procurement: {
    icon: "shopping_cart",
    color: "text-rose-600 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    label: "Procurement",
    href: (id) => `/procurement/${id}`,
  },
  advance: {
    icon: "payments",
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Advance",
    href: (id) => `/salary-advances/${id}`,
  },
  finance: {
    icon: "payments",
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Finance",
    href: (id) => `/salary-advances/${id}`,
  },
  governance: {
    icon: "gavel",
    color: "text-teal-600 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-900/20",
    label: "Governance",
    href: (id) => `/governance/${id}`,
  },
  correspondence: {
    icon: "mail",
    color: "text-sky-600 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-900/20",
    label: "Correspondence",
    href: (id) => `/correspondence/${id}`,
  },
  salary_advance: {
    icon: "payments",
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Salary Advance",
    href: (id) => `/salary-advances/${id}`,
  },
  programmes: {
    icon: "assignment",
    color: "text-indigo-600 dark:text-indigo-300",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    label: "Programme",
    href: (id) => `/pif/${id}`,
  },
  hr: {
    icon: "badge",
    color: "text-rose-600 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    label: "HR",
    // No single canonical HR request detail route yet — route to the inbox instead of a dead anchor.
    href: () => `/approvals`,
  },
  supplier: {
    icon: "storefront",
    color: "text-rose-600 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-900/20",
    label: "Supplier",
    href: (id) => `/procurement/vendors/${id}`,
  },
  risk: {
    icon: "warning",
    color: "text-orange-600 dark:text-orange-300",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    label: "Risk",
    href: (id) => `/risk/${id}`,
  },
  weekly_report: {
    icon: "summarize",
    color: "text-cyan-600 dark:text-cyan-300",
    bg: "bg-cyan-50 dark:bg-cyan-900/20",
    label: "Weekly Report",
    href: (id) => `/weekly-summaries/${id}`,
  },
  mande: {
    icon: "insights",
    color: "text-indigo-600 dark:text-indigo-300",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    label: "M&E Report",
    href: (id) => `/mande/activity-reports/${id}`,
  },
  budget_submission: {
    icon: "account_balance",
    color: "text-teal-600 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-900/20",
    label: "Budget",
    href: (id) => `/budget/submissions/${id}`,
  },
  timesheet: {
    icon: "schedule",
    color: "text-amber-600 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    label: "Timesheet",
    href: (id) => `/timesheets/${id}`,
  },
};

export const DEFAULT_MODULE: ModuleLink = {
  icon: "description",
  color: "text-neutral-600 dark:text-neutral-400",
  bg: "bg-neutral-100 dark:bg-neutral-700/40",
  label: "Request",
  // Unknown module types fall back to the general approvals inbox rather than a dead `#id` anchor.
  href: (_id: number) => `/approvals`,
};

export function moduleLink(moduleType: string | null | undefined): ModuleLink {
  return (moduleType && MODULE_CONFIG[moduleType]) || DEFAULT_MODULE;
}
