import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] shadow-[0_1px_2px_hsl(0_0%_0%/0.04),_0_8px_24px_-16px_hsl(0_0%_0%/0.16)]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("text-base font-semibold leading-tight tracking-tight", className)} {...props} />
);

export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("text-sm text-[hsl(var(--fg-muted))]", className)} {...props} />
);

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center justify-end gap-2 p-5 pt-3", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";
