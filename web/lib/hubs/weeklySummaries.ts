import type { HubCard } from "@/components/ui/ModuleHubCards";

export const WEEKLY_SUMMARIES_SIDEBAR_CHILDREN = [
  { label: "My weekly summary", href: "/weekly-summaries", icon: "edit_note" },
] as const;

export const WEEKLY_SUMMARIES_HUB_CARDS: HubCard[] = [
  {
    href: "/weekly-summaries/review",
    title: "Team review",
    purpose: "Accept or return summaries from your team.",
    icon: "rate_review",
    section: "queues",
  },
  {
    href: "/weekly-summaries/department",
    title: "Department summary",
    purpose: "Who submitted, who is missing, and who is late in a unit.",
    icon: "corporate_fare",
    section: "views",
  },
  {
    href: "/weekly-summaries/institutional",
    title: "Institutional summary",
    purpose: "Forum-wide consolidation for the Secretary General.",
    icon: "account_balance",
    section: "views",
  },
  {
    href: "/weekly-summaries/compliance",
    title: "Compliance",
    purpose: "Late, missing, and unaccepted weekly summaries.",
    icon: "rule",
    section: "views",
  },
  {
    href: "/weekly-summaries/trends",
    title: "Digest trends",
    purpose: "Completion rates across recent weeks.",
    icon: "monitoring",
    section: "tools",
  },
  {
    href: "/reports/weekly",
    title: "Email digest",
    purpose: "Weekly digest report for email distribution.",
    icon: "mail",
    section: "tools",
  },
];
