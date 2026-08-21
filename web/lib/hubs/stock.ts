import type { HubCard } from "@/components/ui/ModuleHubCards";

export const STOCK_SIDEBAR_CHILDREN = [
  { label: "Dashboard", href: "/stock/dashboard", icon: "dashboard" },
  { label: "Stock items", href: "/stock", icon: "inventory" },
  { label: "Requests", href: "/stock/requests", icon: "assignment" },
  { label: "Stocktakes", href: "/stock/stocktakes", icon: "fact_check" },
  { label: "Locations", href: "/stock/locations", icon: "warehouse" },
] as const;

export const STOCK_HUB_CARDS: HubCard[] = [
  { href: "/stock/requests", title: "Stock requests", purpose: "Staff requests for consumables.", icon: "assignment", section: "queues" },
  { href: "/stock/issues", title: "Issues / vouchers", purpose: "Store issues to staff.", icon: "outbox", section: "queues" },
  { href: "/stock/returns", title: "Returns", purpose: "Items returned to stores.", icon: "assignment_return", section: "queues" },
  { href: "/stock/transfers", title: "Transfers", purpose: "Moves between locations.", icon: "swap_horiz", section: "queues" },
  { href: "/stock/write-offs", title: "Write-offs", purpose: "Loss and damage write-offs.", icon: "delete_forever", section: "queues" },
  { href: "/stock/replenishments", title: "Replenishment", purpose: "Reorder proposals.", icon: "shopping_cart", section: "queues" },
  { href: "/stock", title: "Stock items", purpose: "Consumables catalogue and balances.", icon: "inventory", section: "views" },
  { href: "/stock/movements", title: "Stock movements", purpose: "Receipts, issues, and adjustments.", icon: "swap_vert", section: "views" },
  { href: "/stock/stocktakes", title: "Stocktakes", purpose: "Counts and variances.", icon: "fact_check", section: "views" },
  { href: "/stock/low-stock", title: "Low stock / reorder", purpose: "Items at or below reorder level.", icon: "production_quantity_limits", section: "views" },
  { href: "/stock/batches", title: "Batches / expiry", purpose: "Lot and expiry tracking.", icon: "qr_code_2", section: "views" },
  { href: "/stock/reports", title: "Reports", purpose: "Stock value and movement packs.", icon: "summarize", section: "views" },
  { href: "/stock/scan", title: "Barcode scan", purpose: "Scan to issue or count.", icon: "qr_code_scanner", section: "tools" },
  { href: "/stock/locations", title: "Locations", purpose: "Stores and bins.", icon: "warehouse", section: "tools" },
  { href: "/stock/units", title: "Units", purpose: "Units of measure.", icon: "straighten", section: "tools" },
  { href: "/stock/categories", title: "Categories", purpose: "Stock categories.", icon: "category", section: "tools" },
  { href: "/stock/phase2/forecasting", title: "Forecasting", purpose: "Demand forecast for replenishment.", icon: "trending_up", section: "tools" },
];
