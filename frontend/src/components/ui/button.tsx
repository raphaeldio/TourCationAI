import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sage/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-paper disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /* Dulu sage→amber dengan teks putih. Putih di ujung amber hanya
           1.70:1 — praktis tak terbaca, dan ini tombol aksi utama.
           Sekarang sage-ink→forest: putih 7.52:1 → 12.50:1, keduanya AA.
           Kebetulan juga membebaskan amber untuk jadi sorotan (Aturan 1). */
        default:
          "bg-gradient-to-r from-brand-sage-ink to-brand-forest text-on-sage-ink shadow-lg shadow-brand-forest/25 hover:shadow-brand-forest/40 hover:-translate-y-0.5",
        outline:
          "border border-ink/12 bg-ink/5 text-ink hover:border-brand-sage/45 hover:bg-ink/[0.07]",
        ghost: "text-ink-soft hover:bg-ink/5 hover:text-ink",
        secondary: "bg-ink/[0.07] text-ink hover:bg-ink/15",
        glass:
          "border border-ink/15 bg-white/95 text-ink shadow-lg shadow-black/25 hover:-translate-y-0.5 hover:bg-white",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-2xl px-8 text-base",
        xl: "h-[52px] rounded-full px-8 text-[0.95rem]",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = "Button";
