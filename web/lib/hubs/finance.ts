import type { HubCard } from "@/components/ui/ModuleHubCards";

export const FINANCE_SIDEBAR_CHILDREN = [
  { label: "Overview", href: "/finance", icon: "bar_chart_4_bars" },
  { label: "Budget control", href: "/budget", icon: "account_balance_wallet" },
  { label: "Imprest", href: "/imprest", icon: "account_balance_wallet" },
  { label: "Payslips", href: "/finance/payslips", icon: "receipt_long" },
  { label: "Issue payslips", href: "/hr/payslips", icon: "upload_file" },
] as const;

export const FINANCE_HUB_CARDS: HubCard[] = [
  { href: "/hr/payslips", title: "Issue payslips", purpose: "Drop a pay-period envelope and assign files to staff.", icon: "upload_file", section: "queues", permission: "hr.admin" },
  { href: "/budget", title: "Budget control", purpose: "Live control of voted funds.", icon: "account_balance_wallet", section: "queues" },
  { href: "/budget/changes", title: "Budget changes", purpose: "Virements and change requests.", icon: "swap_horiz", section: "queues" },
  { href: "/budget/variance", title: "Budget variance", purpose: "Over/under spend explanations.", icon: "trending_down", section: "queues" },
  { href: "/imprest", title: "Imprest", purpose: "Cash advances and retirements.", icon: "account_balance_wallet", section: "queues" },
  { href: "/finance/payslips", title: "My payslips", purpose: "Your payslip history and downloads.", icon: "receipt_long", section: "views" },
  { href: "/budget/cycles", title: "Budget cycles", purpose: "Annual cycle and institutional decisions.", icon: "calendar_month", section: "views" },
  { href: "/budget/reports", title: "Budget reports", purpose: "Voted funds reporting packs.", icon: "analytics", section: "views" },
  { href: "/budget/cashflow", title: "Cashflow / scenarios", purpose: "Period closing balances and overlays.", icon: "waterfall_chart", section: "views" },
  { href: "/finance/budget", title: "Budgets", purpose: "Budget records and line detail.", icon: "account_balance", section: "views" },
  { href: "/finance/balance-register", title: "Balance register", purpose: "Control-account balances.", icon: "balance", section: "views" },
  { href: "/budget/fx-rates", title: "FX rates", purpose: "Foreign-exchange rates used in budgeting.", icon: "currency_exchange", section: "tools" },
  { href: "/budget/contribution-schedules", title: "Contribution schedules", purpose: "Member contribution calendars.", icon: "event_repeat", section: "tools" },
  { href: "/finance/payroll-imports", title: "Payroll imports", purpose: "Upload payroll files for recovery matching.", icon: "upload_file", section: "tools" },
];
