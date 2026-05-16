"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[hsl(var(--accent))] text-white shadow-sm hover:bg-[hsl(var(--accent)/0.92)] hover:shadow-md",
        secondary:
          "border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-0))] text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-1))]",
        ghost:
          "text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-2))] hover:text-[hsl(var(--fg-primary))]",
        outline:
          "border border-[hsl(var(--border-subtle))] bg-transparent text-[hsl(var(--fg-primary))] hover:bg-[hsl(var(--surface-1))]",
        destructive:
          "bg-[hsl(var(--danger))] text-white hover:bg-[hsl(var(--danger)/0.92)]",
        ai: "ai-gradient text-white shadow-sm hover:shadow-md hover:brightness-105",
        link: "text-[hsl(var(--accent))] underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm max-md:min-h-11",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9 max-md:min-h-11 max-md:min-w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  }
);
Button.displayName = "Button";
export { buttonVariants };
