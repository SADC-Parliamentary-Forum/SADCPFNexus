import { cn } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variants = {
  primary:   "bg-primary text-white hover:bg-primary-600 focus:ring-primary",
  secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:ring-gray-300",
  ghost:     "text-gray-600 hover:bg-gray-100 focus:ring-gray-300",
  danger:    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);
Button.displayName = "Button";
