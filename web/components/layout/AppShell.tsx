"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { canAccessRoute, getStoredUser } from "@/lib/auth";

const SIDEBAR_OPEN_KEY = "sadcpf_sidebar_open";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!pathname) return;
    const user = getStoredUser();
    if (!canAccessRoute(user, pathname)) {
      router.replace("/dashboard");
    }
  }, [pathname, router]);

  // Responsive: on small screens start closed; persist preference on larger screens
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const stored = localStorage.getItem(SIDEBAR_OPEN_KEY);
    const preferOpen = stored === null ? true : stored === "1";
    if (mq.matches) {
      setSidebarOpen(preferOpen);
    } else {
      setSidebarOpen(false);
    }
    const handler = () => {
      if (mq.matches) setSidebarOpen((prev) => prev);
      else setSidebarOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_OPEN_KEY, next ? "1" : "0");
      }
      return next;
    });
  };

  const closeSidebar = () => {
    const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)") : null;
    if (mq?.matches) setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen flex-col bg-surface-muted dark:bg-neutral-900 overflow-hidden">
      <Header onMenuClick={toggleSidebar} sidebarOpen={sidebarOpen} />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={closeSidebar}
          onOverlayClick={closeSidebar}
        />
        <main
          className="flex-1 overflow-y-auto p-6 min-w-0"
          onClick={closeSidebar}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
