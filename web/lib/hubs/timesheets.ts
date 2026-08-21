import type { HubCard } from "@/components/ui/ModuleHubCards";

export const TIMESHEET_SIDEBAR_CHILDREN = [
  { label: "My timesheet", href: "/hr/timesheets", icon: "edit_note" },
  { label: "Monthly view", href: "/hr/timesheets/monthly", icon: "calendar_month" },
  { label: "Team view", href: "/hr/timesheets/team", icon: "groups" },
  { label: "Templates", href: "/hr/timesheets/templates", icon: "description" },
] as const;

export const TIMESHEET_HUB_CARDS: HubCard[] = [
  { href: "/hr/timesheets", title: "Record time", purpose: "Capture this week's hours.", icon: "add_circle", section: "queues" },
  { href: "/hr/timesheets/team?status=submitted", title: "Pending approval", purpose: "Submitted timesheets waiting for a supervisor.", icon: "pending_actions", section: "queues" },
  { href: "/hr/timesheets/overtime?queue=hr", title: "OT validation", purpose: "HR validation of overtime claims.", icon: "verified", section: "queues" },
  { href: "/hr/timesheets/monthly", title: "Monthly view", purpose: "Month grid of recorded time.", icon: "calendar_month", section: "views" },
  { href: "/hr/timesheets/overtime", title: "My overtime", purpose: "Your overtime claims and status.", icon: "more_time", section: "views" },
  { href: "/hr/timesheets/team", title: "Team view", purpose: "Unit timesheets for review.", icon: "groups", section: "views" },
  { href: "/hr/timesheets/history", title: "History", purpose: "Previous weeks you submitted.", icon: "history", section: "views" },
  { href: "/hr/timesheets/schedules", title: "Work schedules", purpose: "Standard hours and duty patterns.", icon: "event_available", section: "tools" },
  { href: "/hr/timesheets/payroll", title: "Payroll export", purpose: "Export approved time for payroll.", icon: "payments", section: "tools" },
  { href: "/hr/timesheets/templates", title: "Templates", purpose: "Reusable weekly patterns.", icon: "description", section: "tools" },
];
