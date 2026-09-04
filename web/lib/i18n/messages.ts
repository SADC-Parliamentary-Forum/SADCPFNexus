import { keyEn, keyFr, keyPt, type Dict } from "./keys.ts";
import { phraseEn, phraseFr, phrasePt } from "./phrases.ts";

export type Locale = "en" | "fr" | "pt";
export type TranslateVars = Record<string, string | number>;

export const LOCALES: Locale[] = ["en", "fr", "pt"];
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  pt: "Português",
};

const BCP47: Record<Locale, string> = {
  en: "en-GB",
  fr: "fr-FR",
  pt: "pt-PT",
};

function mergeCatalog(dottedLocalized: Dict, phrases: Dict): Dict {
  const table: Dict = { ...phrases, ...dottedLocalized };
  for (const [key, english] of Object.entries(keyEn)) {
    if (!english) continue;
    if (!(english in table)) {
      table[english] = dottedLocalized[key] ?? phrases[english] ?? english;
    }
  }
  return table;
}

const TABLES: Record<Locale, Dict> = {
  en: mergeCatalog(keyEn, phraseEn),
  fr: mergeCatalog(keyFr, phraseFr),
  pt: mergeCatalog(keyPt, phrasePt),
};

export function catalogFor(locale: Locale): Dict {
  return TABLES[locale];
}

export function catalogKeys(): string[] {
  return Object.keys(TABLES.en).sort();
}

export function localeBcp47(locale: Locale): string {
  return BCP47[locale];
}

export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? match : String(value);
  });
}

export function translate(locale: Locale, key: string, vars?: TranslateVars): string {
  if (!key) return key;
  const found = TABLES[locale][key] ?? TABLES.en[key] ?? key;
  return interpolate(found, vars);
}

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const raw = window.localStorage.getItem("sadcpf_locale");
  if (raw === "fr" || raw === "pt" || raw === "en") return raw;
  return "en";
}

export function storeLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("sadcpf_locale", locale);
}
