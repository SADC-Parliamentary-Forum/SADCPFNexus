import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-width module canvas. Pages should fill the AppShell main column
 * (timesheets is the reference) rather than a centred max-width column
 * that jumps left/right between routes.
 */
export function ContentCanvas({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("w-full min-w-0 space-y-6", className)}>{children}</div>;
}
