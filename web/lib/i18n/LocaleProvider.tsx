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

/** Compact language control for the app header — icon opens EN/FR/PT menu. */
export function LocaleIconSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, locales, labels } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
        aria-label={`Language: ${labels[locale]}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={labels[locale]}
      >
        <span className="material-symbols-outlined text-[22px]">language</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            aria-label="Choose language"
            className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl z-50 overflow-hidden py-1"
          >
            {locales.map((code) => (
              <li key={code} role="option" aria-selected={locale === code}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors ${
                    locale === code
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                  }`}
                  onClick={() => {
                    setLocale(code);
                    setOpen(false);
                  }}
                >
                  <span>{labels[code]}</span>
                  <span className="text-[10px] uppercase tracking-wide opacity-70">{code}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
