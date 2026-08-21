import type { HubCard } from "@/components/ui/ModuleHubCards";

export const MANDE_SIDEBAR_CHILDREN = [
  { label: "Dashboard", href: "/mande", icon: "dashboard" },
  { label: "My reports", href: "/mande/activity-reports/mine", icon: "assignment_ind" },
  { label: "Calendar", href: "/mande/calendar", icon: "calendar_month" },
  { label: "Strategic plans", href: "/mande/strategic-plan", icon: "flag" },
  { label: "Settings", href: "/mande/settings", icon: "settings" },
] as const;

export const MANDE_HUB_CARDS: HubCard[] = [
  { href: "/mande/intake", title: "Intake queue", purpose: "Activity reports awaiting intake.", icon: "inbox", section: "queues" },
  { href: "/mande/review-queue", title: "Review queue", purpose: "Reports waiting for M&E review.", icon: "rate_review", section: "queues" },
  { href: "/mande/pm-review", title: "PM review", purpose: "Programme manager review.", icon: "supervisor_account", section: "queues" },
  { href: "/mande/activity-reports/mine", title: "My reports", purpose: "Activity reports you own.", icon: "assignment_ind", section: "views" },
  { href: "/mande/activity-reports", title: "All reports", purpose: "Institutional activity reports.", icon: "description", section: "views" },
  { href: "/mande/strategic-plan", title: "Strategic plans", purpose: "Plans and results frameworks.", icon: "flag", section: "views" },
  { href: "/mande/results", title: "Results frameworks", purpose: "Outcomes, outputs, and indicators.", icon: "account_tree", section: "views" },
  { href: "/mande/indicators", title: "Indicators", purpose: "Indicator catalogue and updates.", icon: "speed", section: "views" },
  { href: "/mande/calendar", title: "Calendar", purpose: "Reporting calendar.", icon: "calendar_month", section: "views" },
  { href: "/mande/reports", title: "Reports", purpose: "M&E report packs.", icon: "assessment", section: "views" },
  { href: "/mande/data-quality", title: "Data quality", purpose: "Completeness and evidence checks.", icon: "fact_check", section: "tools" },
  { href: "/mande/import", title: "Import", purpose: "Bulk import of indicator data.", icon: "upload_file", section: "tools" },
  { href: "/mande/settings", title: "Settings", purpose: "M&E configuration.", icon: "settings", section: "tools" },
];
