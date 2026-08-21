import type { HubCard } from "@/components/ui/ModuleHubCards";

export const RISK_SIDEBAR_CHILDREN = [
  { label: "All risks", href: "/risk", icon: "bar_chart_4_bars" },
  { label: "Dashboard", href: "/risk/dashboard", icon: "dashboard" },
  { label: "Log risk", href: "/risk/create", icon: "add_circle" },
  { label: "Policy library", href: "/risk/policies", icon: "policy" },
] as const;

export const RISK_HUB_CARDS: HubCard[] = [
  { href: "/risk/create", title: "Log risk", purpose: "Record a new risk on the register.", icon: "add_circle", section: "queues" },
  { href: "/risk/incidents", title: "Incidents", purpose: "Linked operational incidents.", icon: "report", section: "queues" },
  { href: "/risk/control-testing", title: "Control testing", purpose: "Scheduled tests of controls.", icon: "fact_check", section: "queues" },
  { href: "/risk/dashboard", title: "Dashboard", purpose: "Heat map and residual risk counts.", icon: "dashboard", section: "views" },
  { href: "/risk/analytics", title: "Analytics", purpose: "Trends across categories.", icon: "analytics", section: "views" },
  { href: "/risk/controls", title: "Controls", purpose: "Control library linked to risks.", icon: "verified_user", section: "views" },
  { href: "/risk/appetite", title: "Appetite", purpose: "Risk appetite statements.", icon: "tune", section: "views" },
  { href: "/risk/audit-trail", title: "Audit trail", purpose: "Changes to risk records.", icon: "history", section: "views" },
  { href: "/risk/policies", title: "Policy library", purpose: "Risk and control policies.", icon: "policy", section: "tools" },
  { href: "/risk/kri", title: "KRI automation", purpose: "Key risk indicator feeds.", icon: "speed", section: "tools" },
  { href: "/risk/bcp", title: "BCP / Insurance", purpose: "Business continuity and insurance.", icon: "health_and_safety", section: "tools" },
];
