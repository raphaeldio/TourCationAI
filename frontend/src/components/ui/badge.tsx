import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "border-brand-sage/40 bg-brand-sage/15 text-brand-forest",
        success: "border-emerald-600/30 bg-emerald-600/10 text-emerald-700",
        outline: "border-ink/15 bg-ink/5 text-ink-soft",
        /* Ujung sand diringankan ke /70: pada sand penuh, forest hanya
           4.14:1 — kurang untuk teks 0.65rem. Di /70 naik ke 5.60:1,
           dan ujung amber-nya sudah 7.35:1. */
        gradient:
          "border-transparent bg-gradient-to-r from-brand-amber to-brand-sand/70 text-on-amber shadow-md shadow-brand-amber/25",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
