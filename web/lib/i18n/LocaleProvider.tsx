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
    const stored = readStoredLocale();
    setLocaleState(stored);
    document.documentElement.lang = stored;
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
    <div className={`inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-sm ${className}`} role="group" aria-label="Language">
      <span className="material-symbols-outlined ml-1 mr-0.5 text-[17px] text-neutral-700" aria-hidden="true">language</span>
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          aria-label={`Use ${labels[code]}`}
          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
            locale === code ? "bg-blue-800 text-white shadow-sm" : "text-neutral-800 hover:bg-neutral-100"
          }`}
        >
          {code}
        </button>
      ))}
    </div>
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
