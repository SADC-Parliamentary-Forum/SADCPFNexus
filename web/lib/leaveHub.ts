/** Primary Leave sidebar destinations — keep this short; queues live on the hub. */
export const LEAVE_SIDEBAR_CHILDREN = [
  { label: "Leave", href: "/leave", icon: "event_available" },
  { label: "New request", href: "/leave/create", icon: "add_circle" },
  { label: "Calendar", href: "/leave/calendar", icon: "calendar_month" },
  { label: "Settings", href: "/leave/settings", icon: "settings" },
] as const;

export type LeaveHubSection = "queues" | "views" | "tools";

export type LeaveHubCard = {
  href: string;
  title: string;
  purpose: string;
  icon: string;
  section: LeaveHubSection;
};

export const LEAVE_HUB_CARDS: LeaveHubCard[] = [
  {
    href: "/leave/create",
    title: "Apply for leave",
    purpose: "Start a draft or submit a request. Balances are shown before you pick dates.",
    icon: "add_circle",
    section: "queues",
  },
  {
    href: "/leave?queue=recommend",
    title: "Recommend inbox",
    purpose: "Requests waiting for your recommendation.",
    icon: "thumb_up",
    section: "queues",
  },
  {
    href: "/leave/queues/certify",
    title: "Certification queue",
    purpose: "Recommended requests awaiting HR / administration certification.",
    icon: "verified",
    section: "queues",
  },
  {
    href: "/leave",
    title: "My leave requests",
    purpose: "Drafts, submitted, and decided applications.",
    icon: "event_available",
    section: "views",
  },
  {
    href: "/leave/calendar",
    title: "Team calendar",
    purpose: "Who is away this month. Medical types stay masked for non-HR viewers.",
    icon: "calendar_month",
    section: "views",
  },
  {
    href: "/hr/leave",
    title: "HR leave register",
    purpose: "Institutional register of staff leave.",
    icon: "menu_book",
    section: "views",
  },
  {
    href: "/leave/toil",
    title: "TOIL / leave in lieu",
    purpose: "Credits you can attach when applying for leave in lieu.",
    icon: "more_time",
    section: "tools",
  },
  {
    href: "/leave/settings",
    title: "Leave workflow settings",
    purpose: "Policy versions and approval routing.",
    icon: "settings",
    section: "tools",
  },
];

export const LEAVE_TYPE_ICONS: Record<string, string> = {
  annual: "sunny",
  sick: "medical_services",
  lil: "swap_horiz",
  unpaid: "money_off",
  study: "school",
  home: "home",
  maternity: "child_care",
  paternity: "family_restroom",
  compassionate: "volunteer_activism",
  special: "star",
};

export const LEAVE_TYPE_COLORS: Record<string, string> = {
  annual: "text-green-700 bg-green-50 border-green-200",
  sick: "text-red-700 bg-red-50 border-red-200",
  lil: "text-primary bg-primary/10 border-primary/20",
  unpaid: "text-neutral-700 bg-neutral-50 border-neutral-200",
  study: "text-primary bg-primary/5 border-primary/20",
  home: "text-neutral-700 bg-neutral-50 border-neutral-200",
  maternity: "text-neutral-800 bg-neutral-50 border-neutral-200",
  paternity: "text-neutral-800 bg-neutral-50 border-neutral-200",
  compassionate: "text-amber-800 bg-amber-50 border-amber-200",
  special: "text-amber-800 bg-amber-50 border-amber-200",
};
