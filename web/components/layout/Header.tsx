"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  authApi,
  clearAuthCookie,
  clearMustResetCookie,
  clearSetupCompleteCookie,
  userNotificationsApi,
  type UserNotification,
} from "@/lib/api";
import { clearStoredUser, readStoredUser } from "@/lib/session";
import { useTheme } from "@/components/providers/ThemeProvider";
import { GlobalSearch } from "./GlobalSearch";

interface StoredUser {
  name: string;
  email: string;
  roles?: string[];
  classification?: string;
}

interface HeaderProps {
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
}

export function Header({ onMenuClick, sidebarOpen }: HeaderProps = {}) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const storedUser = readStoredUser();
    if (storedUser) setUser(storedUser);
  }, []);

  // Unread count for bell badge — polls every 15s when tab is active, pauses when hidden
  const { data: countData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => userNotificationsApi.unreadCount().then((r) => r.data.count),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Recent notifications for dropdown — fetched when panel opens
  const { data: notifPage, isLoading: notifLoading } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => userNotificationsApi.list({ per_page: 10 }).then((r) => r.data),
    enabled: showNotifications,
    staleTime: 20_000,
  });

  const unreadCount = countData ?? 0;
  const notifItems: UserNotification[] = notifPage?.data ?? [];

  const handleMarkRead = async (id: string) => {
    try {
      await userNotificationsApi.markRead(id);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await userNotificationsApi.markAllRead();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch { /* ignore */ }
  };

  // Close notifications panel on outside click
  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifications]);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const roleLabel = user?.roles?.[0]
    ? user.roles[0].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : user?.classification ?? "Staff";

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearStoredUser();
    clearAuthCookie();
    clearMustResetCookie();
    clearSetupCompleteCookie();
    router.push("/login");
  };

  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 md:px-6 py-3 shadow-sm z-50 flex-shrink-0">
      {/* Left: Menu toggle + Brand */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex md:hidden p-2 -ml-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <span className="material-symbols-outlined text-[24px]">
              {sidebarOpen ? "menu_open" : "menu"}
            </span>
          </button>
        )}
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="hidden md:flex p-2 -ml-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <span className="material-symbols-outlined text-[22px]">
              {sidebarOpen ? "chevron_left" : "chevron_right"}
            </span>
          </button>
        )}
      <Link href="/dashboard" className="flex items-center gap-3 text-neutral-900 dark:text-neutral-100">
        <span className="relative inline-block h-8 w-8 flex-shrink-0">
          <Image
            src="/sadcpf-logo.png"
            alt="SADC Parliamentary Forum"
            fill
            className="object-contain"
            sizes="32px"
            priority
          />
        </span>
        <div className="hidden md:block">
          <h2 className="text-lg font-bold leading-tight tracking-tight text-neutral-900 dark:text-neutral-100">SADC PF Nexus</h2>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 leading-none">Institutional Operations Platform</p>
        </div>
      </Link>
      </div>

      {/* Center: Global search with autocomplete */}
      <GlobalSearch />

      {/* Right: Actions + User */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex size-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span className="material-symbols-outlined text-[20px]">
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative flex size-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-neutral-900">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-neutral-500">notifications</span>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Notifications</h3>
                  {unreadCount > 0 && <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5">{unreadCount}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} className="text-[11px] font-semibold text-primary hover:underline">
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotifications(false)} className="text-neutral-400 hover:text-neutral-600">
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-neutral-50 dark:divide-neutral-700/50">
                {notifLoading ? (
                  <div className="px-4 py-6 space-y-3 animate-pulse">
                    {[1,2,3].map(i => <div key={i} className="h-10 bg-neutral-100 rounded-lg" />)}
                  </div>
                ) : notifItems.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <span className="material-symbols-outlined text-3xl text-neutral-200 dark:text-neutral-600">check_circle</span>
                    <p className="text-sm text-neutral-400 mt-2">You&apos;re all caught up!</p>
                  </div>
                ) : notifItems.map((n) => {
                  const isUnread = !n.read_at;
                  const moduleIconMap: Record<string, { icon: string; color: string; bg: string }> = {
                    travel:      { icon: "flight_takeoff",         color: "text-primary",     bg: "bg-primary/10" },
                    leave:       { icon: "event_available",        color: "text-green-600",   bg: "bg-green-50" },
                    imprest:     { icon: "account_balance_wallet", color: "text-amber-600",   bg: "bg-amber-50" },
                    procurement: { icon: "shopping_cart",          color: "text-purple-600",  bg: "bg-purple-50" },
                    assignment:  { icon: "task_alt",               color: "text-blue-600",    bg: "bg-blue-50" },
                    finance:     { icon: "payments",               color: "text-emerald-600", bg: "bg-emerald-50" },
                  };
                  const mod = n.meta?.module ?? "";
                  const ic = moduleIconMap[mod] ?? { icon: "notifications", color: "text-neutral-500", bg: "bg-neutral-100" };
                  return (
                    <div
                      key={n.id}
                      onClick={() => { if (isUnread) handleMarkRead(n.id); if (n.meta?.url) router.push(n.meta.url); setShowNotifications(false); }}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors ${isUnread ? "bg-primary/5" : ""}`}
                    >
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${ic.bg}`}>
                        <span className={`material-symbols-outlined text-[16px] ${ic.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{ic.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <p className={`text-xs leading-tight ${isUnread ? "font-semibold text-neutral-900 dark:text-neutral-100" : "font-medium text-neutral-700 dark:text-neutral-300"}`}>{n.subject}</p>
                          {isUnread && <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />}
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          {new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-neutral-100 dark:border-neutral-700 px-4 py-2.5">
                <Link href="/notifications" onClick={() => setShowNotifications(false)} className="text-xs font-semibold text-primary hover:underline">
                  View all notifications →
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="h-7 w-px bg-neutral-200 dark:bg-neutral-700" />

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">{user?.name ?? "User"}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-none">{String(roleLabel)}</p>
            </div>
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-primary text-white text-xs font-bold flex-shrink-0 shadow-sm">
              {initials}
            </div>
            <span className="material-symbols-outlined text-neutral-400 text-[16px]">expand_more</span>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl z-50 overflow-hidden">
                {/* User info */}
                <div className="px-4 py-3.5 border-b border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{user?.name ?? "User"}</p>
                      <p className="text-xs text-neutral-400 truncate">{user?.email ?? ""}</p>
                    </div>
                  </div>
                </div>
                {/* Menu items */}
                <div className="py-1.5">
                  <Link
                    href="/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-neutral-400">person</span>
                    My Profile
                  </Link>
                  <Link
                    href="/profile/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-neutral-400">tune</span>
                    Preferences & Settings
                  </Link>
                  <Link
                    href="/profile/security"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-neutral-400">lock</span>
                    Security & Password
                  </Link>
                </div>
                <div className="border-t border-neutral-100 dark:border-neutral-700 py-1.5">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
