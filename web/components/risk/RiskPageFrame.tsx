import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared width + centering for every Risk Register surface so navigating
 * between hub, create, detail and specialist pages does not jump alignment.
 */
export function RiskPageFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("mx-auto max-w-6xl space-y-6", className)}>{children}</div>;
}
