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
