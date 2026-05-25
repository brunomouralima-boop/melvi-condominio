import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const variants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-brand-900 text-white border-transparent",
      secondary: "bg-slate-100 text-slate-800 border-transparent",
      success: "bg-emerald-100 text-emerald-800 border-transparent",
      warning: "bg-amber-100 text-amber-800 border-transparent",
      destructive: "bg-coral-100 text-coral-800 border-transparent",
      outline: "border-slate-300 text-slate-700",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof variants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(variants({ variant }), className)} {...props} />;
}
