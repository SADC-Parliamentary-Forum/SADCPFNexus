import type { HubCard } from "@/components/ui/ModuleHubCards";

export const AUDIT_SIDEBAR_CHILDREN = [
  { label: "Dashboard", href: "/audit", icon: "dashboard" },
  { label: "Engagements", href: "/audit/engagements", icon: "assignment" },
  { label: "Findings", href: "/audit/findings", icon: "report" },
  { label: "Settings / Charter", href: "/audit/settings", icon: "settings" },
] as const;

export const AUDIT_HUB_CARDS: HubCard[] = [
  { href: "/audit/engagements", title: "Engagements", purpose: "Active and closed audit work.", icon: "assignment", section: "queues" },
  { href: "/audit/findings", title: "Findings", purpose: "Issues and ratings.", icon: "report", section: "queues" },
  { href: "/audit/corrective-actions", title: "Corrective actions", purpose: "Remediation tracker.", icon: "task_alt", section: "queues" },
  { href: "/audit/qa", title: "QA reviews", purpose: "Quality assurance of files.", icon: "verified", section: "queues" },
  { href: "/audit/analytics", title: "Analytics", purpose: "Coverage and overdue actions.", icon: "analytics", section: "views" },
  { href: "/audit/universe", title: "Universe", purpose: "Auditable entities.", icon: "hub", section: "views" },
  { href: "/audit/plans", title: "Plans", purpose: "Annual and engagement plans.", icon: "calendar_month", section: "views" },
  { href: "/audit/campaigns", title: "Campaigns", purpose: "Thematic campaigns.", icon: "fact_check", section: "views" },
  { href: "/audit/resources", title: "Resources", purpose: "Auditor allocation.", icon: "groups", section: "views" },
  { href: "/audit/governance-packs", title: "Governance packs", purpose: "Committee packs.", icon: "folder_special", section: "views" },
  { href: "/audit/appointments", title: "Appointments", purpose: "External appointments.", icon: "handshake", section: "views" },
  { href: "/audit/external", title: "External audit", purpose: "External engagements.", icon: "public", section: "views" },
  { href: "/audit/templates", title: "Templates", purpose: "Work programmes.", icon: "description", section: "tools" },
  { href: "/audit/ai", title: "AI assist", purpose: "Drafting support. Never auto-issues findings.", icon: "smart_toy", section: "tools" },
  { href: "/audit/settings", title: "Settings / Charter", purpose: "Mandate and charter.", icon: "settings", section: "tools" },
];
