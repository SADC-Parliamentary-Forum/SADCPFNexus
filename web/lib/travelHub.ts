/** Primary Travel sidebar destinations — keep this short; everything else lives on the hub. */
export const TRAVEL_SIDEBAR_CHILDREN = [
  { label: "Travel", href: "/travel", icon: "dashboard" },
  { label: "New request", href: "/travel/create", icon: "add_circle" },
  { label: "Register", href: "/travel/register", icon: "menu_book" },
  { label: "Missions", href: "/travel/missions", icon: "groups" },
  { label: "Settings", href: "/travel/settings", icon: "settings" },
] as const;

export type TravelHubSection = "queues" | "views" | "tools";

export type TravelHubCard = {
  href: string;
  title: string;
  purpose: string;
  icon: string;
  section: TravelHubSection;
};

/**
 * Former Travel submenu leaves, shown as labelled hub cards.
 * Permissions are enforced at the route (`canAccessRoute`) — never show a dead link.
 */
export const TRAVEL_HUB_CARDS: TravelHubCard[] = [
  {
    href: "/travel?scope=mine",
    title: "My travel requests",
    purpose: "Drafts and requisitions you submitted.",
    icon: "person",
    section: "queues",
  },
  {
    href: "/travel/queues/approval",
    title: "Pending my approval",
    purpose: "Requisitions waiting for your recommendation or approval.",
    icon: "fact_check",
    section: "queues",
  },
  {
    href: "/travel/queues/admin",
    title: "Administration queue",
    purpose: "Logistics, bookings, and administration review.",
    icon: "admin_panel_settings",
    section: "queues",
  },
  {
    href: "/travel/dashboards/admin",
    title: "Admin dashboard",
    purpose: "Itinerary, visa, and booking readiness counts.",
    icon: "dashboard",
    section: "queues",
  },
  {
    href: "/travel/queues/finance",
    title: "Finance review queue",
    purpose: "DSA calculations and funds confirmation.",
    icon: "account_balance",
    section: "queues",
  },
  {
    href: "/travel/dashboards/finance",
    title: "Finance dashboard",
    purpose: "DSA, advances, and outstanding retirement.",
    icon: "payments",
    section: "queues",
  },
  {
    href: "/travel/queues/director-finance",
    title: "Director Finance queue",
    purpose: "Final finance confirmation before payment.",
    icon: "verified",
    section: "queues",
  },
  {
    href: "/travel/queues/retirement",
    title: "Travel retirement",
    purpose: "Trips due to retire advances and receipts.",
    icon: "assignment_turned_in",
    section: "queues",
  },
  {
    href: "/travel?view=approved",
    title: "Approved travel",
    purpose: "Approved requisitions across the institution.",
    icon: "verified",
    section: "views",
  },
  {
    href: "/travel?view=upcoming",
    title: "Upcoming travel",
    purpose: "Approved trips that have not yet departed.",
    icon: "flight",
    section: "views",
  },
  {
    href: "/travel?view=away",
    title: "Travellers away",
    purpose: "Staff currently on approved travel.",
    icon: "public",
    section: "views",
  },
  {
    href: "/travel/calendar",
    title: "Travel calendar",
    purpose: "Month view of departures, returns, and missions.",
    icon: "calendar_month",
    section: "views",
  },
  {
    href: "/travel/missions",
    title: "Mission readiness",
    purpose: "Group readiness for tickets, visas, and hotel.",
    icon: "groups",
    section: "views",
  },
  {
    href: "/travel/register",
    title: "Travel register",
    purpose: "Institutional register with export.",
    icon: "menu_book",
    section: "views",
  },
  {
    href: "/imprest?linked=travel",
    title: "Travel advances / Imprest",
    purpose: "Advances linked to approved travel.",
    icon: "payments",
    section: "tools",
  },
  {
    href: "/travel/toil",
    title: "Potential leave-in-lieu",
    purpose: "TOIL candidates from weekend and rest-day travel.",
    icon: "event_available",
    section: "tools",
  },
  {
    href: "/travel/reports",
    title: "Reports & analytics",
    purpose: "Cost, programme, and CSV report packs.",
    icon: "assessment",
    section: "tools",
  },
  {
    href: "/travel/reports",
    title: "Visa reminders",
    purpose: "Visa watchlist and outstanding travel documents.",
    icon: "badge",
    section: "tools",
  },
  {
    href: "/travel/settings",
    title: "DSA rates & settings",
    purpose: "Rate types, FX, and sponsored meal deductions.",
    icon: "settings",
    section: "tools",
  },
];
