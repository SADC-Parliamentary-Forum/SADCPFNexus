import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "success" | "warning" | "danger" | "muted" | "info";
  className?: string;
}

const variants = {
  primary: "bg-primary/10 text-primary",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-800",
  danger:  "bg-red-100 text-red-700",
  muted:   "bg-neutral-100 text-neutral-600",
  info:    "bg-blue-50 text-blue-700",
};

export function Badge({ children, variant = "muted", className }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
