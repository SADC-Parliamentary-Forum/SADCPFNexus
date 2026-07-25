"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LOCALE_LABELS,
  LOCALES,
  type Locale,
  readStoredLocale,
  storeLocale,
  translate,
} from "./messages";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  locales: typeof LOCALES;
  labels: typeof LOCALE_LABELS;
};

const I18nContext = createContext<I18nValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    setLocaleState(readStoredLocale());
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    storeLocale(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: (key: string) => translate(locale, key),
      locales: LOCALES,
      labels: LOCALE_LABELS,
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "en",
      setLocale: () => undefined,
      t: (key: string) => translate("en", key),
      locales: LOCALES,
      labels: LOCALE_LABELS,
    };
  }
  return ctx;
}

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, locales, labels } = useI18n();
  return (
    <label className={`inline-flex items-center gap-2 text-xs text-neutral-500 ${className}`}>
      <span className="sr-only">Language</span>
      <select
        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label="Language"
      >
        {locales.map((code) => (
          <option key={code} value={code}>
            {labels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
