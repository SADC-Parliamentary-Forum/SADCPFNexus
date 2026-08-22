import { createContext } from "react";
import type { AuthUser } from "@/lib/api";
import { readStoredUser } from "@/lib/session";

export * from "./authAccess";

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

/**
 * Parse stored user from localStorage (includes roles). Returns null if missing or invalid.
 */
export function getStoredUser(): AuthUser | null {
  return readStoredUser();
}
