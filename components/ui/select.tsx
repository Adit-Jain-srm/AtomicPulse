import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "h-9 w-full appearance-none rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] pl-3 pr-9 text-sm text-[hsl(var(--fg-primary))] focus-ring hover:border-[hsl(var(--border-strong))] disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--fg-muted))]" />
  </div>
));
NativeSelect.displayName = "NativeSelect";
