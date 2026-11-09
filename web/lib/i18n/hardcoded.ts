/**
 * Finds user-facing English left in a screen's source, so translated screens stay translated.
 * Heuristic by design: a line that is a false positive can carry an `i18n-ignore` comment.
 */
export type HardcodedHit = { line: number; text: string };

const COPY_PROPS =
  "title|subtitle|placeholder|aria-label|label|description|hint|message|confirmText|cancelText|confirmLabel|cancelLabel|caption|alt|emptyMessage|emptyText|helperText|tooltip|heading|actionLabel|submitLabel|loadingText";

// A catalog key such as `assets.kits.title`, which components translate themselves.
const DOTTED_KEY = "[a-z]\\w*(?:\\.\\w+)+";

const PATTERNS: RegExp[] = [
  // JSX text alone on its line, e.g. `            Save draft`
  /^\s+[A-Z][A-Za-z’']*(?: [A-Za-z’'…]+)*[.…]?\s*$/,
  // JSX text alone on its line with punctuation, e.g. `  No records found. Try again.`
  /^\s+[A-Z][\w’'-]*(?:[ ,:;.!?–—/&’'-]+[\w’'-]+)+[.…!?:]?\s*$/,
  // JSX text between tags on one line, e.g. `<p>No records</p>` or `<span>Status: {x}`
  /<(?:[A-Za-z][\w.]*(?:\s[^<>|]*?[^=|])?|\/[\w.]+)>\s*[^<>{}\s(),;:=|&\][][^<>{}]*[A-Za-z]{2}[^<>{}]*?(?=<|\{|$)/,
  // copy-bearing props given a string literal
  new RegExp(`\\b(?:${COPY_PROPS})=["'](?!${DOTTED_KEY}["'])[A-Za-z][^"']*[a-z]{2}`),
  // copy-bearing props given a literal in braces
  new RegExp(`\\b(?:${COPY_PROPS})=\\{\\s*["'\`](?!${DOTTED_KEY}["'\`])[A-Za-z][^"'\`]*[a-z]{2}`),
  // toast, error and confirm text passed as a literal
  /\b(?:toast(?:\.\w+)?|toastError|showToast|set\w*(?:Error|Message|Success|Notice|Warning|Status)|confirm|alert)\(\s*["'`][A-Z][^"'`]*[a-z]{2}/,
];

export function findHardcodedCopy(source: string): HardcodedHit[] {
  const hits: HardcodedHit[] = [];
  let inImport = false;
  let inBlockComment = false;
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (inBlockComment) {
      if (trimmed.includes("*/")) inBlockComment = false;
      return;
    }
    if (trimmed.startsWith("/*") || trimmed.startsWith("{/*")) {
      if (!trimmed.includes("*/")) inBlockComment = true;
      return;
    }
    if (inImport) {
      if (/[}]\s*from\s/.test(trimmed) || trimmed.endsWith(";")) inImport = false;
      return;
    }
    if (/^(import|export)\s.*\{[^}]*$/.test(trimmed)) {
      inImport = true;
      return;
    }
    if (trimmed === "" || trimmed.startsWith("//") || trimmed.startsWith("*") || line.includes("i18n-ignore")) return;
    // Icon ligatures such as `<span className="material-symbols-outlined">download` are not copy.
    if (/material-(symbols|icons)/.test(line)) return;
    if (/^(import|export \* from|"use client")/.test(trimmed)) return;
    for (const pattern of PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        hits.push({ line: index + 1, text: match[0].trim().slice(0, 120) });
        break;
      }
    }
  });
  return hits;
}

/** Dotted keys passed to t("…") in a source file. */
export function usedKeys(source: string): string[] {
  return [...source.matchAll(/\bt\(\s*["'`]([a-z][\w]*(?:\.[\w]+)+)["'`]/g)].map((m) => m[1]);
}
