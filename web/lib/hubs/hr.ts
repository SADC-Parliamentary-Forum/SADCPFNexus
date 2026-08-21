import type { HubCard } from "@/components/ui/ModuleHubCards";

export const HR_SIDEBAR_CHILDREN = [
  { label: "Overview", href: "/hr", icon: "bar_chart_4_bars" },
  { label: "Staff leave register", href: "/hr/leave", icon: "menu_book" },
  { label: "Employee files", href: "/hr/files", icon: "folder_shared" },
  { label: "Appraisals", href: "/hr/appraisals", icon: "rate_review" },
  { label: "Departments", href: "/hr/departments", icon: "corporate_fare" },
] as const;

export const HR_HUB_CARDS: HubCard[] = [
  { href: "/leave/queues/certify", title: "Leave certify queue", purpose: "Recommended leave awaiting HR certification.", icon: "verified", section: "queues" },
  { href: "/hr/profile-requests", title: "Profile requests", purpose: "Staff profile change requests.", icon: "manage_accounts", section: "queues" },
  { href: "/hr/incidents", title: "Incidents", purpose: "HR incident records.", icon: "report", section: "queues" },
  { href: "/hr/leave", title: "Staff leave register", purpose: "Institutional register of staff leave.", icon: "menu_book", section: "views" },
  { href: "/hr/leave/balances", title: "Leave balances", purpose: "Balances by staff member and type.", icon: "balance", section: "views" },
  { href: "/leave/toil", title: "TOIL credits", purpose: "Leave in lieu credits.", icon: "more_time", section: "views" },
  { href: "/hr/appraisals", title: "Appraisals", purpose: "Appraisal cycles and forms.", icon: "rate_review", section: "views" },
  { href: "/hr/conduct", title: "Conduct", purpose: "Commendations and warnings.", icon: "gavel", section: "views" },
  { href: "/hr/performance", title: "Performance", purpose: "Performance records.", icon: "trending_up", section: "views" },
  { href: "/hr/files", title: "Employee files", purpose: "Digital personal files.", icon: "folder_shared", section: "views" },
  { href: "/hr/documents", title: "Documents", purpose: "HR document library.", icon: "description", section: "views" },
  { href: "/hr/payslips", title: "Payslips", purpose: "HR view of staff payslips.", icon: "receipt_long", section: "views" },
  { href: "/hr/departments", title: "Departments", purpose: "Organisational units.", icon: "corporate_fare", section: "tools" },
  { href: "/hr/positions", title: "Positions", purpose: "Establishment positions.", icon: "work", section: "tools" },
];
