"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { PREFS_KEY } from "@/lib/constants";

interface AppPrefs {
  dateFormat: string;
  timezone: string;
  currency: string;
  language: string;
}

const DEFAULTS: AppPrefs = {
  dateFormat: "DD/MM/YYYY",
  timezone: "Africa/Windhoek",
  currency: "NAD",
  language: "en",
};

const PrefsContext = createContext<AppPrefs>(DEFAULTS);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppPrefs>(DEFAULTS);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) setPrefs((p) => ({ ...p, ...JSON.parse(raw) }));
      } catch { /* ignore */ }
    };
    load();
    // Cross-tab sync
    window.addEventListener("storage", load);
    // Same-tab sync (dispatched by settings page on save)
    window.addEventListener("sadcpf:prefs-updated", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("sadcpf:prefs-updated", load);
    };
  }, []);

  return <PrefsContext.Provider value={prefs}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): AppPrefs {
  return useContext(PrefsContext);
}
