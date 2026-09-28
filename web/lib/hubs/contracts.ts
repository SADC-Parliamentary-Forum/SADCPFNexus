import type { HubCard } from "@/components/ui/ModuleHubCards";

export const CONTRACTS_HUB_CARDS: HubCard[] = [
  { href: "/contracts/create", title: "contracts.new", purpose: "contracts.hub.createPurpose", icon: "add_circle", section: "queues", permission: "contract.create" },
  { href: "/contracts/register", title: "contracts.registerTitle", purpose: "contracts.hub.registerPurpose", icon: "menu_book", section: "views" },
  { href: "/contracts/analytics", title: "contracts.analyticsTitle", purpose: "contracts.hub.analyticsPurpose", icon: "insights", section: "views" },
  { href: "/contracts/risk", title: "contracts.riskTitle", purpose: "contracts.hub.riskPurpose", icon: "warning", section: "views" },
  { href: "/contracts/reports", title: "contracts.reportsTitle", purpose: "contracts.hub.reportsPurpose", icon: "assessment", section: "tools" },
  { href: "/contracts/settings", title: "contracts.settingsTitle", purpose: "contracts.hub.settingsPurpose", icon: "settings", section: "tools" },
];
