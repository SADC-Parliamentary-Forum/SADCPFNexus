"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthContext } from "@/lib/auth";
import { authApi, type AuthUser } from "@/lib/api";
import { clearStoredUser, readStoredUser, writeStoredUser } from "@/lib/session";

const SKIP_REFRESH_PATHS = ["/login", "/reset-password", "/setup", "/approval"];

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
