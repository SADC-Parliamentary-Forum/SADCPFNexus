"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { canAccessRouteWithEffective, getStoredUser } from "@/lib/auth";
import { accessApi, type AccessEffectivePayload } from "@/lib/api";

const SIDEBAR_OPEN_KEY = "sadcpf_sidebar_open";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessReady, setAccessReady] = useState(false);
  const [accessLoadFailed, setAccessLoadFailed] = useState(false);
  const [effectiveAccess, setEffectiveAccess] = useState<AccessEffectivePayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    accessApi.effective()
      .then(({ data }) => {
        if (!cancelled) {
          setEffectiveAccess(data.data);
          setAccessReady(true);
          setAccessLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEffectiveAccess(null);
          setAccessReady(true);
          setAccessLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const user = getStoredUser();
    if (!user) {
      setAccessDenied(false);
      router.replace("/login");
      return;
    }
    const allowed = accessReady && !accessLoadFailed && canAccessRouteWithEffective(user, pathname, effectiveAccess);
    setAccessDenied(!allowed);
  }, [accessReady, accessLoadFailed, effectiveAccess, pathname, router]);

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[300] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Header onMenuClick={toggleSidebar} sidebarOpen={sidebarOpen} />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={closeSidebar}
          onOverlayClick={closeSidebar}
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6 min-w-0"
          onClick={closeSidebar}
        >
          {!accessReady || accessDenied ? (
            <AccessDenied
              path={pathname ?? undefined}
              reason={!accessReady
                ? "Access permissions are still being verified. Reload this page if the check does not complete."
                : accessLoadFailed
                  ? "Access permissions could not be verified. The page is unavailable until the authorization service responds."
                  : "Your account does not include permission for this route. Contact an administrator if you need access."}
            />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
