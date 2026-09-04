import type { HubCard } from "@/components/ui/ModuleHubCards";

export const PROCUREMENT_SIDEBAR_CHILDREN = [
  { label: "Requests", href: "/procurement", icon: "bar_chart_4_bars" },
  { label: "From invoice / quote", href: "/procurement/from-document", icon: "upload_file" },
  { label: "New Request", href: "/procurement/create", icon: "add_shopping_cart" },
  { label: "Vendors", href: "/procurement/vendors", icon: "store" },
  { label: "Register", href: "/procurement/register", icon: "menu_book" },
  { label: "Settings", href: "/procurement/settings", icon: "settings" },
] as const;

export const PROCUREMENT_HUB_CARDS: HubCard[] = [
  { href: "/procurement/from-document", title: "Create from Invoice / Quote", purpose: "Upload a supplier document and generate a controlled LPO.", icon: "upload_file", section: "queues" },
  { href: "/procurement/inbox", title: "Procurement Inbox", purpose: "Email invoices forwarded to the procurement mailbox.", icon: "inbox", section: "queues" },
  { href: "/procurement/create", title: "New request", purpose: "Raise a requisition for goods, services, or works.", icon: "add_shopping_cart", section: "queues" },
  { href: "/procurement/intake", title: "Intake", purpose: "New requisitions awaiting routing.", icon: "inbox", section: "queues" },
  { href: "/procurement/budget", title: "Budget confirmation", purpose: "Funds confirmation before award.", icon: "account_balance", section: "queues" },
  { href: "/procurement/rfq", title: "Quotations (RFQ)", purpose: "Requests for quotation in flight.", icon: "request_quote", section: "queues" },
  { href: "/procurement/evaluations", title: "Evaluations", purpose: "Committee scoring of quotes and bids.", icon: "fact_check", section: "queues" },
  { href: "/procurement/bid-submissions", title: "Bid submissions", purpose: "Received tender bids.", icon: "inbox_customize", section: "queues" },
  { href: "/procurement/analytics", title: "Dashboard", purpose: "Spend and pipeline counts.", icon: "analytics", section: "views" },
  { href: "/procurement/tenders", title: "Tenders", purpose: "Open and closed tender processes.", icon: "gavel", section: "views" },
  { href: "/procurement/notices", title: "Notice board", purpose: "Public procurement notices.", icon: "campaign", section: "views" },
  { href: "/procurement/tender-committee", title: "Tender committee", purpose: "Committee membership and sittings.", icon: "groups", section: "views" },
  { href: "/procurement/planning", title: "Planning", purpose: "Annual procurement plan.", icon: "calendar_month", section: "views" },
  { href: "/procurement/catalogue", title: "Catalogue", purpose: "Approved items and specifications.", icon: "menu_book", section: "views" },
  { href: "/procurement/vendors", title: "Vendors", purpose: "Supplier register and onboarding.", icon: "store", section: "views" },
  { href: "/procurement/purchase-orders", title: "LPO register", purpose: "Consecutive local purchase orders.", icon: "receipt_long", section: "views" },
  { href: "/procurement/exceptions", title: "Exceptions", purpose: "Retrospective, sole-source and void register.", icon: "report", section: "views" },
  { href: "/procurement/receipts", title: "Receipts", purpose: "Goods received notes.", icon: "inventory_2", section: "views" },
  { href: "/procurement/invoices", title: "Invoices", purpose: "Supplier invoices against POs.", icon: "request_quote", section: "views" },
  { href: "/procurement/contracts", title: "Contracts", purpose: "Awarded contracts and milestones.", icon: "description", section: "views" },
  { href: "/procurement/register", title: "Register", purpose: "Institutional procurement register.", icon: "menu_book", section: "views" },
  { href: "/procurement/settings", title: "Settings", purpose: "Thresholds and policy profiles.", icon: "settings", section: "tools" },
];
