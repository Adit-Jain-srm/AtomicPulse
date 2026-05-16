import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-9 w-full rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] px-3 text-sm text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-muted))] focus-ring transition-shadow shadow-[inset_0_1px_0_hsl(0_0%_100%/0.04)] hover:border-[hsl(var(--border-strong))] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[64px] w-full rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] px-3 py-2 text-sm text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-muted))] focus-ring resize-y disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-xs font-medium text-[hsl(var(--fg-secondary))]", className)}
      {...props}
    />
  )
);
Label.displayName = "Label";
