"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthContext, mergeEffectivePermissions } from "@/lib/auth";
import { accessApi, authApi, type AuthUser } from "@/lib/api";
import { clearStoredUser, readStoredUser, writeStoredUser } from "@/lib/session";

/** Paths where unauthenticated visitors are expected — do not call /auth/me. */
const SKIP_REFRESH_PATHS = [
  "/login",
  "/forgot-password",
  "/request-password",
  "/activate-account",
  "/reset-password",
  "/setup",
  "/approval",
  "/supplier",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const cachedUser = readStoredUser();
    if (cachedUser) setUser(cachedUser);

    if (SKIP_REFRESH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;

    authApi.me()
      .then(({ data }) => {
        writeStoredUser(data);
        setUser(data);
        return accessApi.effective()
          .then(({ data: access }) => {
            const merged = mergeEffectivePermissions(data, access.data) ?? data;
            writeStoredUser(merged);
            setUser(merged);
          })
          .catch(() => {
            // Keep /auth/me as the minimum viable session refresh if access metadata is unavailable.
          });
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        // Only evict session on explicit auth rejection; preserve cached user if backend is unreachable
        if (status === 401 || status === 403) {
          clearStoredUser();
          setUser(null);
        }
      });
  }, [pathname]);

  const login = (newUser: AuthUser) => {
    writeStoredUser(newUser);
    setUser(newUser);
  };

  const logout = () => {
    clearStoredUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token: null, login, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
}
