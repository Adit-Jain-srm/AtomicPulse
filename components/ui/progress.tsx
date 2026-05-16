"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  tone = "accent",
}: {
  value: number;
  className?: string;
  tone?: "accent" | "success" | "warn" | "danger" | "ai";
}) {
  const v = Math.max(0, Math.min(100, value));
  const fill =
    tone === "accent"
      ? "bg-[hsl(var(--accent))]"
      : tone === "success"
      ? "bg-[hsl(var(--success))]"
      : tone === "warn"
      ? "bg-[hsl(var(--warn))]"
      : tone === "danger"
      ? "bg-[hsl(var(--danger))]"
      : "ai-gradient";
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]", className)}>
      <motion.div
        className={cn("h-full rounded-full", fill)}
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ type: "spring", stiffness: 220, damping: 28 }}
      />
    </div>
  );
}
