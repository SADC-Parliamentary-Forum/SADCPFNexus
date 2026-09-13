import type { HubCard } from "@/components/ui/ModuleHubCards";

export const PEOPLE_SIDEBAR_CHILDREN = [
  { label: "Hub", href: "/people", icon: "dashboard" },
  { label: "Staff directory", href: "/people/directory", icon: "contacts" },
  { label: "Authority register", href: "/people/authority", icon: "gavel" },
  { label: "My profile", href: "/profile", icon: "person" },
] as const;

export const PEOPLE_HUB_CARDS: HubCard[] = [
  { href: "/people/delegations", title: "Delegations", purpose: "Standing delegations of authority.", icon: "handshake", section: "queues" },
  { href: "/people/acting", title: "Acting appointments", purpose: "Temporary acting roles.", icon: "supervisor_account", section: "queues" },
  { href: "/profile", title: "My profile", purpose: "Personal details and documents.", icon: "person", section: "views" },
  { href: "/saam", title: "My signature", purpose: "Enrol and manage your signature.", icon: "draw", section: "views" },
  { href: "/people/directory", title: "Staff directory", purpose: "Search institutional staff.", icon: "contacts", section: "views" },
  { href: "/organogram", title: "Organisation chart", purpose: "Interactive department canvas.", icon: "account_tree", section: "views" },
  { href: "/people/authority", title: "Authority register", purpose: "Delegated authorities.", icon: "gavel", section: "views" },
  { href: "/verify-signature", title: "Verify signature", purpose: "Public signature verification.", icon: "verified_user", section: "tools" },
];

export const PEOPLE_SETTINGS_HUB_CARDS: HubCard[] = [
  { href: "/people/m365", title: "M365 / directory sync", purpose: "Directory sync status and operator controls.", icon: "sync", section: "tools" },
  { href: "/people/esign", title: "External e-sign", purpose: "Env-gated external signing providers.", icon: "draw", section: "tools" },
  { href: "/people/recertification", title: "Role recertification", purpose: "Periodic role recertification campaigns.", icon: "verified_user", section: "tools" },
  { href: "/people/sod", title: "SoD analysis", purpose: "Segregation of duties analysis.", icon: "policy", section: "tools" },
  { href: "/people/scenarios", title: "Org scenarios", purpose: "Organisation change scenarios.", icon: "schema", section: "tools" },
  { href: "/people/succession", title: "Succession", purpose: "Succession planning.", icon: "diversity_3", section: "tools" },
  { href: "/people/skills", title: "Skills directory", purpose: "Staff skills catalogue.", icon: "psychology", section: "tools" },
  { href: "/people/analytics", title: "Analytics", purpose: "People and authority analytics.", icon: "analytics", section: "views" },
  { href: "/people/ai", title: "AI assist", purpose: "AI assist — never auto-grant access.", icon: "smart_toy", section: "tools" },
  { href: "/admin/settings", title: "Operator credentials", purpose: "Operator credential status in system settings.", icon: "admin_panel_settings", section: "tools" },
  { href: "/verify-signature", title: "Public signature verification", purpose: "Verify a document signature.", icon: "verified", section: "tools" },
];
