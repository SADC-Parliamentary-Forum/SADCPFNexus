"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Search index: all navigable areas + record types ────────────────────────
interface SearchResult {
  id: string;
  label: string;
  description?: string;
  href: string;
  category: string;
  icon: string;
  keywords?: string;
}

const SEARCH_INDEX: SearchResult[] = [
  // ── Modules / Pages ─────────────────────────────────────────────────────
  { id: "m-dashboard",   label: "Dashboard",                 description: "Overview & KPI summary",                href: "/dashboard",           category: "Modules",     icon: "dashboard"              },
  { id: "m-alerts",      label: "Alerts & Notifications",    description: "Who's away, missions, deadlines, inbox",href: "/notifications",       category: "Modules",     icon: "notifications_active"   },
  { id: "m-travel",      label: "Travel Requests",           description: "Submit and track travel authorisations",href: "/travel",              category: "Modules",     icon: "flight_takeoff"         },
  { id: "m-travel-new",  label: "New Travel Request",        description: "Submit a new travel request",           href: "/travel/create",       category: "Actions",     icon: "add_circle"             },
  { id: "m-leave",       label: "Leave Management",          description: "Leave requests and balances",           href: "/leave",               category: "Modules",     icon: "event_available"        },
  { id: "m-leave-new",   label: "Apply for Leave",           description: "Submit a new leave application",        href: "/leave/create",        category: "Actions",     icon: "add_circle"             },
  { id: "m-finance",     label: "Finance",                   description: "Budget, payments, and financial reports",href: "/finance",            category: "Modules",     icon: "payments"               },
  { id: "m-imprest",     label: "Imprest / Cash Advances",   description: "Request and retire cash advances",      href: "/imprest",             category: "Modules",     icon: "account_balance_wallet" },
  { id: "m-imprest-new", label: "New Imprest Request",       description: "Submit a new imprest request",          href: "/imprest/create",      category: "Actions",     icon: "add_circle"             },
  { id: "m-pif",         label: "Programmes (PIF)",          description: "Programme Implementation Framework",    href: "/pif",                 category: "Modules",     icon: "account_tree"           },
  { id: "m-pif-new",     label: "New Programme",             description: "Register a new funded programme",       href: "/pif/create",          category: "Actions",     icon: "add_circle"             },
  { id: "m-workplan",    label: "Master Workplan",           description: "Institutional calendar of events",      href: "/workplan",            category: "Modules",     icon: "calendar_month"         },
  { id: "m-hr",          label: "HR",                        description: "Staff records, leave, payroll",         href: "/hr",                  category: "Modules",     icon: "people"                 },
  { id: "m-timesheets",  label: "Timesheets",                description: "Weekly time logging",                   href: "/hr/timesheets",       category: "Modules",     icon: "schedule"               },
  { id: "m-reports",     label: "Reports",                   description: "Financial and operational reports",     href: "/reports",             category: "Modules",     icon: "assessment"             },
  { id: "m-assets",      label: "Asset Register",            description: "IT, vehicles, furniture tracking",      href: "/assets",              category: "Modules",     icon: "inventory_2"            },
  { id: "m-governance",  label: "Governance",                description: "Meetings, resolutions, compliance",     href: "/governance",          category: "Modules",     icon: "policy"                 },
  // ── Admin pages ─────────────────────────────────────────────────────────
  { id: "a-users",       label: "User Management",           description: "Create and manage user accounts",       href: "/admin/users",         category: "Admin",       icon: "people"                 },
  { id: "a-users-new",   label: "Create User",               description: "Add a new user account",               href: "/admin/users/create",  category: "Actions",     icon: "person_add"             },
  { id: "a-roles",       label: "Roles & Permissions",       description: "Configure system roles",               href: "/admin/roles",         category: "Admin",       icon: "admin_panel_settings"   },
  { id: "a-depts",       label: "Departments",               description: "Organisational structure",             href: "/admin/departments",   category: "Admin",       icon: "corporate_fare"         },
  { id: "a-payslips",    label: "Payslip Upload",            description: "Bulk upload employee payslips",        href: "/admin/payslips",      category: "Admin",       icon: "receipt_long"           },
  { id: "a-settings",    label: "System Settings",           description: "Organisation, fiscal year, timezone",  href: "/admin/settings",      category: "Admin",       icon: "settings"               },
  { id: "a-workflows",   label: "Approval Workflows",        description: "Configure approval chains",            href: "/admin/workflows",     category: "Admin",       icon: "account_tree"           },
  { id: "a-notifs",      label: "Notification Templates",    description: "Email and system notification content",href: "/admin/notifications", category: "Admin",       icon: "notifications"          },
  { id: "a-audit",       label: "Audit Logs",                description: "System activity trail",                href: "/admin/audit",         category: "Admin",       icon: "manage_search"          },
  // ── Profile ─────────────────────────────────────────────────────────────
  { id: "p-profile",     label: "My Profile",                description: "Edit your personal details",           href: "/profile",             category: "Account",     icon: "person"                 },
  { id: "p-settings",    label: "My Settings",               description: "Notifications, theme, preferences",    href: "/profile/settings",    category: "Account",     icon: "settings"               },
  // ── Help entries ─────────────────────────────────────────────────────────
  { id: "h-dsa",         label: "DSA / Per Diem Policy",     description: "Daily subsistence allowance rules",    href: "/governance",          category: "Help",        icon: "help_outline",          keywords: "per diem allowance travel subsistence" },
  { id: "h-imprest",     label: "Imprest Retirement Rules",  description: "How to retire an imprest advance",     href: "/governance",          category: "Help",        icon: "help_outline",          keywords: "retirement cash advance receipts" },
  { id: "h-leave-types", label: "Leave Types & Entitlements",description: "Annual, sick, maternity leave rules",  href: "/hr",                  category: "Help",        icon: "help_outline",          keywords: "annual sick maternity paternity leave entitlement balance" },
];

const CATEGORY_ORDER = ["Actions", "Modules", "Admin", "Account", "Help"];
const CATEGORY_COLOR: Record<string, string> = {
  Actions: "text-primary", Modules: "text-neutral-600", Admin: "text-purple-600",
  Account: "text-teal-600", Help: "text-amber-600",
};

function scoreResult(result: SearchResult, query: string): number {
  const q = query.toLowerCase();
  const label = result.label.toLowerCase();
  const desc = (result.description ?? "").toLowerCase();
  const kw = (result.keywords ?? "").toLowerCase();
  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.includes(q)) return 60;
  if (desc.includes(q)) return 40;
  if (kw.includes(q)) return 20;
  return 0;
}

const MAX_RESULTS = 8;
const RECENT_KEY = "sadcpf_recent_searches";

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, 5); } catch { return []; }
}
function addRecent(term: string) {
  const prev = getRecent().filter((t) => t !== term);
  localStorage.setItem(RECENT_KEY, JSON.stringify([term, ...prev].slice(0, 5)));
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce query so scoring only runs 150ms after the user stops typing
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(id);
  }, [query]);

  // Results — only recomputed when debounced query changes
  const results: SearchResult[] = useMemo(() => {
    const q = debouncedQuery.trim();
    if (q.length < 1) return [];
    return SEARCH_INDEX
      .map((r) => ({ r, score: scoreResult(r, q) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((x) => x.r);
  }, [debouncedQuery]);

  // Group by category (preserving order)
  const grouped: { category: string; items: SearchResult[] }[] = useMemo(() => {
    const out: { category: string; items: SearchResult[] }[] = [];
    for (const cat of CATEGORY_ORDER) {
      const items = results.filter((r) => r.category === cat);
      if (items.length > 0) out.push({ category: cat, items });
    }
    return out;
  }, [results]);

  // Flat list for keyboard nav
  const flatResults = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  const openSearch = useCallback(() => {
    setOpen(true);
    setRecent(getRecent());
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  const navigate = useCallback((href: string, label: string) => {
    addRecent(label);
    closeSearch();
    router.push(href);
  }, [closeSearch, router]);

  // Keyboard shortcut Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) closeSearch(); else openSearch();
      }
      if (e.key === "Escape" && open) closeSearch();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, openSearch, closeSearch]);

  // Arrow key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, flatResults.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && flatResults[cursor]) navigate(flatResults[cursor].href, flatResults[cursor].label);
  };

  // Click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) closeSearch();
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, closeSearch]);

  // Highlight matching text
  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-primary/20 text-primary rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div ref={containerRef} className="flex flex-1 items-center justify-center px-8">
      {/* Trigger bar */}
      <button
        type="button"
        onClick={openSearch}
        className="flex w-full max-w-md items-center gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5 text-sm text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-text group"
      >
        <span className="material-symbols-outlined text-neutral-400 text-[20px] flex-shrink-0">search</span>
        <span className="flex-1 text-left text-neutral-400">Search anywhere…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400 shadow-sm">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeSearch} />

          {/* Search panel */}
          <div className="relative w-full max-w-xl bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700 z-10">
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-100 dark:border-neutral-700">
              <span className="material-symbols-outlined text-primary text-[22px] flex-shrink-0">search</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Search modules, records, people, policies…"
                className="flex-1 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 bg-transparent border-none outline-none"
                autoComplete="off"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
              <kbd className="hidden sm:inline-flex rounded-md border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[420px] overflow-y-auto">
              {query.trim() === "" ? (
                // Show recent searches & quick actions
                <div>
                  {recent.length > 0 && (
                    <div className="px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Recent Searches</p>
                      <div className="space-y-0.5">
                        {recent.map((term) => (
                          <button key={term} type="button"
                            onClick={() => setQuery(term)}
                            className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors text-left">
                            <span className="material-symbols-outlined text-neutral-300 text-[16px]">history</span>
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="px-4 py-3 border-t border-neutral-50 dark:border-neutral-700/50">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Quick Actions</p>
                    <div className="space-y-0.5">
                      {SEARCH_INDEX.filter((r) => r.category === "Actions").map((r) => (
                        <button key={r.id} type="button"
                          onClick={() => navigate(r.href, r.label)}
                          className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-primary/5 hover:text-primary transition-colors text-left">
                          <span className="material-symbols-outlined text-primary text-[16px]">{r.icon}</span>
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : flatResults.length === 0 ? (
                <div className="py-10 text-center">
                  <span className="material-symbols-outlined text-4xl text-neutral-200">search_off</span>
                  <p className="mt-2 text-sm font-medium text-neutral-500">No results for &ldquo;{query}&rdquo;</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Try a module name, action, or keyword</p>
                </div>
              ) : (
                <div className="py-2">
                  {grouped.map(({ category, items }) => {
                    return (
                      <div key={category}>
                        <p className={`px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest ${CATEGORY_COLOR[category] ?? "text-neutral-400"}`}>
                          {category}
                        </p>
                        {items.map((r) => {
                          const flatIdx = flatResults.indexOf(r);
                          const isActive = flatIdx === cursor;
                          return (
                            <button key={r.id} type="button"
                              onMouseEnter={() => setCursor(flatIdx)}
                              onClick={() => navigate(r.href, r.label)}
                              className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${isActive ? "bg-primary/5" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                              <div className={`flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 ${isActive ? "bg-primary/10" : "bg-neutral-100 dark:bg-neutral-700"}`}>
                                <span className={`material-symbols-outlined text-[17px] ${isActive ? "text-primary" : "text-neutral-500 dark:text-neutral-400"}`}
                                  style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                                  {r.icon}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-neutral-900 dark:text-neutral-100"}`}>
                                  {highlight(r.label)}
                                </p>
                                {r.description && (
                                  <p className="text-xs text-neutral-400 truncate">{r.description}</p>
                                )}
                              </div>
                              {isActive && (
                                <span className="material-symbols-outlined text-primary text-[16px] flex-shrink-0">arrow_forward</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-4 border-t border-neutral-100 dark:border-neutral-700 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                <kbd className="rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-1 py-0.5 font-mono">↑↓</kbd> Navigate
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                <kbd className="rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-1 py-0.5 font-mono">↵</kbd> Open
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                <kbd className="rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-1 py-0.5 font-mono">ESC</kbd> Close
              </div>
              <span className="ml-auto text-[10px] text-neutral-400">{flatResults.length} result{flatResults.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
