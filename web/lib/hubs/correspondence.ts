import type { HubCard } from "@/components/ui/ModuleHubCards";

export const CORRESPONDENCE_SIDEBAR_CHILDREN = [
  { label: "Dashboard", href: "/correspondence", icon: "bar_chart_4_bars" },
  { label: "Register incoming", href: "/correspondence/incoming", icon: "move_to_inbox" },
  { label: "Draft outgoing", href: "/correspondence/create", icon: "edit_square" },
  { label: "Mailbox", href: "/correspondence/mailbox", icon: "mail" },
  { label: "Master register", href: "/correspondence/master-register", icon: "menu_book" },
] as const;

export const CORRESPONDENCE_HUB_CARDS: HubCard[] = [
  { href: "/correspondence/incoming", title: "Register incoming", purpose: "Capture a letter or memo received.", icon: "move_to_inbox", section: "queues" },
  { href: "/correspondence/create", title: "Draft outgoing", purpose: "Draft a letter for routing and dispatch.", icon: "edit_square", section: "queues" },
  { href: "/correspondence/my-actions", title: "My action items", purpose: "Correspondence assigned to you.", icon: "assignment_ind", section: "queues" },
  { href: "/correspondence/pending-routing", title: "Pending SG routing", purpose: "Incoming items waiting for SG direction.", icon: "route", section: "queues" },
  { href: "/correspondence/registry?direction=incoming", title: "Incoming register", purpose: "All incoming correspondence.", icon: "inbox", section: "views" },
  { href: "/correspondence/registry?direction=outgoing", title: "Outgoing register", purpose: "All outgoing correspondence.", icon: "outbox", section: "views" },
  { href: "/correspondence/master-register", title: "Master register", purpose: "Combined institutional register.", icon: "menu_book", section: "views" },
  { href: "/correspondence/subject-files", title: "Subject files", purpose: "Files by subject heading.", icon: "folder_open", section: "views" },
  { href: "/correspondence/mailbox", title: "Mailbox", purpose: "IMAP intake for the registry.", icon: "mail", section: "views" },
  { href: "/correspondence/mail-merge", title: "Mail merge", purpose: "Merge labelled fields into a letter.", icon: "merge_type", section: "tools" },
  { href: "/correspondence/retention", title: "Retention / legal holds", purpose: "Retention periods and holds.", icon: "gavel", section: "tools" },
  { href: "/correspondence/contacts", title: "Contacts", purpose: "Correspondents and addresses.", icon: "contacts", section: "tools" },
  { href: "/correspondence/letterhead", title: "Letterhead", purpose: "Official letterhead templates.", icon: "description", section: "tools" },
  { href: "/correspondence/reports", title: "Reports", purpose: "Turnaround and overdue packs.", icon: "summarize", section: "tools" },
];
