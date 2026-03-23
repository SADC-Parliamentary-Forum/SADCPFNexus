"use client";

import { useState, useEffect, type ReactNode } from "react";
import { AuthContext } from "@/lib/auth";
import { setToken as setApiToken, type AuthUser } from "@/lib/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("sadcpf_token");
    const savedUser = localStorage.getItem("sadcpf_user");
    if (savedToken && savedUser) {
      setApiToken(savedToken); // warm the in-memory cache
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = (newToken: string, newUser: AuthUser) => {
    setApiToken(newToken);
    localStorage.setItem("sadcpf_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    setApiToken(null);
    localStorage.removeItem("sadcpf_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, isAuthenticated: !!token }}
    >
      {children}
    </AuthContext.Provider>
  );
}
