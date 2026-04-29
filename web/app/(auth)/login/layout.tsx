import type { ReactNode } from "react";

/**
 * Prevent static stale HTML/chunk mismatches against the SPA shell — helps avoid React hydration errors (#418).
 */
export const dynamic = "force-dynamic";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
