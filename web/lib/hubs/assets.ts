import type { HubCard } from "@/components/ui/ModuleHubCards";

export const ASSETS_SIDEBAR_CHILDREN = [
  { label: "Dashboard", href: "/assets/dashboard", icon: "dashboard" },
  { label: "Register", href: "/assets", icon: "inventory_2" },
  { label: "Fleet", href: "/fleet", icon: "directions_car" },
  { label: "My requests", href: "/assets/requests", icon: "request_quote" },
  { label: "Import", href: "/assets/import", icon: "upload_file" },
  { label: "Labels", href: "/assets/labels", icon: "qr_code_2" },
  { label: "Verification", href: "/assets/verification", icon: "fact_check" },
  { label: "Settings", href: "/assets/settings", icon: "settings" },
] as const;

export const ASSETS_HUB_CARDS: HubCard[] = [
  { href: "/assets/intake", title: "Intake / pending", purpose: "GRN drafts waiting to be capitalised.", icon: "pending_actions", section: "queues" },
  { href: "/assets/verification", title: "Verification", purpose: "Physical verification exercises.", icon: "fact_check", section: "queues", permission: ["assets.verify", "assets.admin", "assets.manage"] },
  { href: "/assets/import", title: "Import", purpose: "Review staged Crystal listings before committing the register.", icon: "upload_file", section: "queues", permission: ["assets.import", "assets.admin", "assets.manage"] },
  { href: "/assets/disposal", title: "Disposal", purpose: "Assets pending disposal.", icon: "delete_forever", section: "queues" },
  { href: "/assets/requests", title: "My requests", purpose: "Asset issue and transfer requests.", icon: "request_quote", section: "queues" },
  { href: "/assets", title: "Register", purpose: "Fixed asset register.", icon: "inventory_2", section: "views" },
  { href: "/fleet", title: "Fleet", purpose: "Vehicles on the register.", icon: "directions_car", section: "views" },
  { href: "/fleet/utilisation", title: "Fleet utilisation", purpose: "Vehicle use and readiness.", icon: "speed", section: "views" },
  { href: "/assets/mine", title: "My assets", purpose: "Assets in your custody.", icon: "person", section: "views" },
  { href: "/assets/transfers", title: "Transfers", purpose: "Custody transfers.", icon: "swap_horiz", section: "views" },
  { href: "/assets/maintenance", title: "Maintenance", purpose: "Service due and warranty.", icon: "build", section: "views" },
  { href: "/assets/depreciation", title: "Depreciation", purpose: "Depreciation runs and values.", icon: "trending_down", section: "views" },
  { href: "/assets/revaluation", title: "Revaluation", purpose: "Revaluation exercises.", icon: "currency_exchange", section: "views" },
  { href: "/assets/reports", title: "Reports", purpose: "Asset report packs.", icon: "summarize", section: "tools" },
  { href: "/assets/labels", title: "Labels", purpose: "Print Avery and thermal asset labels.", icon: "qr_code_2", section: "tools", permission: ["assets.print", "assets.admin", "assets.manage"] },
  { href: "/assets/settings", title: "Settings", purpose: "Categories and capitalisation rules.", icon: "settings", section: "tools" },
  { href: "/assets/categories", title: "Categories", purpose: "Asset classes and useful lives.", icon: "category", section: "tools" },
  { href: "/assets/insurance", title: "Insurance", purpose: "Cover and claims.", icon: "health_and_safety", section: "tools" },
];
