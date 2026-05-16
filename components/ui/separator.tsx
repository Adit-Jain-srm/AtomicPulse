import * as React from "react";
import { cn } from "@/lib/utils";

export function Separator({
  orientation = "horizontal",
  className,
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <div
      role="separator"
      className={cn(
        "bg-[hsl(var(--border-subtle))]",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
    />
  );
}
