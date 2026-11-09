import { readFileSync } from "node:fs";
import { catalogFor } from "./i18n/messages.ts";

/**
 * Static UI tests were written against literal English in page source. Translated
 * screens now read that copy from the i18n catalogs through t("key"). This helper
 * puts the English back where each key is used, so a test keeps asserting the
 * copy a user actually sees in English instead of the key name:
 *
 *   aria-label={t("k")}  ->  aria-label="English"
 *   {t("k")}             ->  English            (JSX text)
 *   t("k")               ->  "English"
 *   "k" (any literal)    ->  "English"           (label maps, label="k" props)
 *
 * Only strings that are real catalog keys are replaced.
 */
const en = catalogFor("en");

function lookup(key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(en, key) ? en[key] : undefined;
}

const KEY = String.raw`([A-Za-z][\w-]*(?:\.[\w-]+)+)`;

export function englishSource(source: string): string {
  const swap = (pattern: RegExp, render: (english: string) => string) => {
    source = source.replace(pattern, (whole: string, quote: string, key: string) => {
      const english = lookup(key);
      return english === undefined ? whole : render(english);
    });
  };
  swap(new RegExp(String.raw`=\{\s*t\((["'\`])${KEY}\1\)\s*\}`, "g"), (s) => `="${s}"`);
  swap(new RegExp(String.raw`\{\s*t\((["'\`])${KEY}\1\)\s*\}`, "g"), (s) => s);
  swap(new RegExp(String.raw`\bt\((["'\`])${KEY}\1\)`, "g"), (s) => `"${s}"`);
  swap(new RegExp(String.raw`(["'\`])${KEY}\1`, "g"), (s) => `"${s}"`);
  return source;
}

export function readEnglishSource(path: string): string {
  return englishSource(readFileSync(path, "utf8"));
}
