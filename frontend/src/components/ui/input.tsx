import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-xl border border-ink/10 bg-ink/[0.04] px-3 py-2 text-sm text-ink",
        "transition-colors placeholder:text-ink-faint hover:border-ink/20",
        "focus-visible:border-brand-sage/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sage/35",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";
