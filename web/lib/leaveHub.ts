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
  /** i18n key (lib/i18n/keys.ts) */
  title: string;
  /** i18n key (lib/i18n/keys.ts) */
  purpose: string;
  icon: string;
  section: LeaveHubSection;
};

export const LEAVE_HUB_CARDS: LeaveHubCard[] = [
  {
    href: "/leave/create",
    title: "leave.hub.apply.title",
    purpose: "leave.hub.apply.purpose",
    icon: "add_circle",
    section: "queues",
  },
  {
    href: "/leave?queue=recommend",
    title: "leave.list.recommendTitle",
    purpose: "leave.list.recommendSubtitle",
    icon: "thumb_up",
    section: "queues",
  },
  {
    href: "/leave/queues/certify",
    title: "leave.common.certQueue",
    purpose: "leave.hub.certify.purpose",
    icon: "verified",
    section: "queues",
  },
  {
    href: "/leave",
    title: "leave.hub.mine.title",
    purpose: "leave.hub.mine.purpose",
    icon: "event_available",
    section: "views",
  },
  {
    href: "/leave/calendar",
    title: "leave.calendar.breadcrumb",
    purpose: "leave.hub.calendar.purpose",
    icon: "calendar_month",
    section: "views",
  },
  {
    href: "/hr/leave",
    title: "leave.hub.hrRegister.title",
    purpose: "leave.hub.hrRegister.purpose",
    icon: "menu_book",
    section: "views",
  },
  {
    href: "/hr/leave/import",
    title: "leave.import.hubTitle",
    purpose: "leave.import.hubPurpose",
    icon: "upload_file",
    section: "tools",
  },
  {
    href: "/leave/toil",
    title: "leave.hub.toil.title",
    purpose: "leave.hub.toil.purpose",
    icon: "more_time",
    section: "tools",
  },
  {
    href: "/leave/settings",
    title: "leave.settings.title",
    purpose: "leave.hub.settings.purpose",
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
