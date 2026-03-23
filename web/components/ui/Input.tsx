import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400",
            "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition",
            icon && "pl-10",
            error && "border-red-400 focus:border-red-400 focus:ring-red-400",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";
