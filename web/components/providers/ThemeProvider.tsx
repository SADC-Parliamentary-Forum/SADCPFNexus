"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "light", setTheme: () => {} });

const THEME_KEY = "sadcpf_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // Sync React state with the class already applied by the anti-flash script
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    const resolved: Theme = stored === "dark" ? "dark" : "light";
    setThemeState(resolved);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(THEME_KEY, t);
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
