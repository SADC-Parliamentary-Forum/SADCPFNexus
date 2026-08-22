import type { HubCard } from "@/components/ui/ModuleHubCards";

export const ASSIGNMENTS_SIDEBAR_CHILDREN = [
  { label: "Dashboard", href: "/assignments", icon: "bar_chart_4_bars" },
  { label: "My assignments", href: "/assignments/mine", icon: "person" },
  { label: "New assignment", href: "/assignments/create", icon: "add_task" },
  { label: "Register", href: "/assignments/register", icon: "list_alt" },
  { label: "Calendar", href: "/assignments/calendar", icon: "calendar_month" },
] as const;

const ASSIGNMENT_REVIEW = ["assignments.review", "assignments.admin"] as const;
const ASSIGNMENT_TEAM = ["assignments.team", "assignments.admin"] as const;
const ASSIGNMENT_ISSUE = ["assignments.issue", "assignments.admin"] as const;
const ASSIGNMENT_REPORTS = ["assignments.reports", "assignments.admin"] as const;

export const ASSIGNMENTS_HUB_CARDS: HubCard[] = [
  { href: "/assignments/create", title: "New assignment", purpose: "Issue a task with a due date and owner.", icon: "add_task", section: "queues" },
  {
    href: "/assignments/review",
    title: "Awaiting my review",
    purpose: "Work waiting for your acceptance or review.",
    icon: "rate_review",
    section: "queues",
    permission: [...ASSIGNMENT_REVIEW],
  },
  {
    href: "/assignments/unassigned",
    title: "Unassigned queue",
    purpose: "Tasks with no owner yet.",
    icon: "inbox",
    section: "queues",
    permission: [...ASSIGNMENT_ISSUE],
  },
  {
    href: "/assignments/pending",
    title: "Pending acceptance",
    purpose: "Issued assignments not yet accepted.",
    icon: "pending_actions",
    section: "queues",
    permission: [...ASSIGNMENT_ISSUE],
  },
  {
    href: "/assignments/overdue",
    title: "Overdue",
    purpose: "Open work past the due date.",
    icon: "event_busy",
    section: "queues",
    permission: [...ASSIGNMENT_TEAM],
  },
  {
    href: "/assignments/blocked",
    title: "Blocked",
    purpose: "Assignments stopped by a recorded blocker.",
    icon: "block",
    section: "queues",
    permission: [...ASSIGNMENT_TEAM],
  },
  {
    href: "/assignments/escalations",
    title: "Escalations",
    purpose: "Items raised for senior attention.",
    icon: "priority_high",
    section: "queues",
    permission: [...ASSIGNMENT_REVIEW],
  },
  { href: "/assignments/mine", title: "My assignments", purpose: "Work assigned to you.", icon: "person", section: "views" },
  {
    href: "/assignments/assigned-by-me",
    title: "Assigned by me",
    purpose: "Tasks you issued to others.",
    icon: "assignment_ind",
    section: "views",
    permission: [...ASSIGNMENT_ISSUE],
  },
  {
    href: "/assignments/team",
    title: "Team assignments",
    purpose: "Your unit's open work.",
    icon: "groups",
    section: "views",
    permission: [...ASSIGNMENT_TEAM],
  },
  { href: "/assignments/register", title: "Assignment register", purpose: "Institutional list with export.", icon: "list_alt", section: "views" },
  { href: "/assignments/completed", title: "Completed", purpose: "Closed and completed work.", icon: "task", section: "views" },
  { href: "/assignments/calendar", title: "Calendar & ICS", purpose: "Due dates and calendar subscribe URL.", icon: "calendar_month", section: "views" },
  {
    href: "/assignments/recurring",
    title: "Recurring tasks",
    purpose: "Templates that spawn repeating work.",
    icon: "event_repeat",
    section: "tools",
    permission: [...ASSIGNMENT_ISSUE],
  },
  {
    href: "/assignments/reports",
    title: "Reports",
    purpose: "Throughput and overdue analytics.",
    icon: "analytics",
    section: "tools",
    permission: [...ASSIGNMENT_REPORTS],
  },
  {
    href: "/assignments/capacity",
    title: "Capacity",
    purpose: "Load across people in your unit.",
    icon: "group_work",
    section: "tools",
    permission: [...ASSIGNMENT_TEAM],
  },
];
