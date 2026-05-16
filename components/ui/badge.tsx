import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      tone: {
        neutral: "bg-[hsl(var(--surface-2))] text-[hsl(var(--fg-secondary))] ring-[hsl(var(--border-subtle))]",
        info: "bg-[hsl(var(--accent-soft))] text-[hsl(var(--accent))] ring-[hsl(var(--accent)/0.18)]",
        success: "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))] ring-[hsl(var(--success)/0.25)]",
        warn: "bg-[hsl(var(--warn)/0.15)] text-[hsl(var(--warn))] ring-[hsl(var(--warn)/0.3)]",
        danger: "bg-[hsl(var(--danger)/0.12)] text-[hsl(var(--danger))] ring-[hsl(var(--danger)/0.3)]",
        ai: "ai-gradient text-white ring-transparent",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
