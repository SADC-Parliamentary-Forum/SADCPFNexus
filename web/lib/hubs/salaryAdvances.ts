import type { HubCard } from "@/components/ui/ModuleHubCards";

export const SALARY_ADVANCE_SIDEBAR_CHILDREN = [
  { label: "Salary Advances", href: "/salary-advances", icon: "dashboard" },
  { label: "Apply", href: "/salary-advances/create", icon: "add_circle" },
  { label: "My applications", href: "/salary-advances/applications", icon: "list_alt" },
] as const;

const SA_FINANCE = [
  "salary_advance.certify",
  "salary_advance.pay",
  "salary_advance.recover",
  "salary_advance.approve",
  "salary_advance.admin",
  "finance.approve",
  "finance.admin",
] as const;

export const SALARY_ADVANCE_HUB_CARDS: HubCard[] = [
  { href: "/salary-advances/create", title: "Apply for salary advance", purpose: "Start an application against confirmed net salary.", icon: "add_circle", section: "queues" },
  {
    href: "/salary-advances/queues/certify",
    title: "Pending finance certification",
    purpose: "Applications waiting for finance to certify.",
    icon: "verified",
    section: "queues",
    permission: [...SA_FINANCE],
  },
  {
    href: "/salary-advances/pending-approval",
    title: "Pending approval",
    purpose: "Certified applications awaiting decision.",
    icon: "fact_check",
    section: "queues",
    permission: ["salary_advance.approve", "finance.approve"],
  },
  {
    href: "/salary-advances/queues/payment",
    title: "Approved for payment",
    purpose: "Advances ready to pay.",
    icon: "account_balance",
    section: "queues",
    permission: [...SA_FINANCE],
  },
  {
    href: "/salary-advances/queues/recovery",
    title: "Payroll recovery queue",
    purpose: "Recoveries due on the next payroll.",
    icon: "event_repeat",
    section: "queues",
    permission: [...SA_FINANCE],
  },
  {
    href: "/salary-advances/reconciliation",
    title: "Reconciliation queue",
    purpose: "Match recoveries to payroll postings.",
    icon: "compare_arrows",
    section: "queues",
    permission: [...SA_FINANCE],
  },
  { href: "/salary-advances/applications", title: "My applications", purpose: "Drafts and in-flight requests you submitted.", icon: "list_alt", section: "views" },
  { href: "/salary-advances/history", title: "My advance history", purpose: "Closed and recovered advances.", icon: "history", section: "views" },
  {
    href: "/salary-advances/finance",
    title: "Finance dashboard",
    purpose: "Queue counts for certification, payment, and recovery.",
    icon: "monitoring",
    section: "views",
    permission: [...SA_FINANCE],
  },
  {
    href: "/salary-advances/outstanding",
    title: "Outstanding advances",
    purpose: "Balances still being recovered.",
    icon: "pending",
    section: "views",
    permission: [...SA_FINANCE],
  },
  {
    href: "/salary-advances/register",
    title: "Salary advance register",
    purpose: "Institutional register with export.",
    icon: "menu_book",
    section: "views",
    permission: ["salary_advance.certify", "salary_advance.export", "salary_advance.admin", "finance.approve", "finance.export", "finance.admin"],
  },
  {
    href: "/salary-advances/reports",
    title: "Reports",
    purpose: "CSV packs for finance and audit.",
    icon: "assessment",
    section: "tools",
    permission: ["salary_advance.export", "salary_advance.certify", "finance.export", "finance.approve", "reports.export"],
  },
  {
    href: "/salary-advances/settings",
    title: "Settings",
    purpose: "Policy version, exceptions, and recovery rule.",
    icon: "settings",
    section: "tools",
    permission: ["salary_advance.admin", "finance.admin"],
  },
];
