"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function WeightageRing({
  totalBp,
  size = 120,
  stroke = 10,
  className,
  showLabel = true,
  responsive = false,
}: {
  totalBp: number;
  size?: number;
  stroke?: number;
  className?: string;
  showLabel?: boolean;
  responsive?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(2, totalBp / 10000));
  const dash = c * Math.min(1, pct);

  let tone: "ok" | "under" | "over" = "under";
  if (totalBp === 10000) tone = "ok";
  else if (totalBp > 10000) tone = "over";

  const stroke1 =
    tone === "ok"
      ? "stroke-[hsl(var(--success))]"
      : tone === "over"
      ? "stroke-[hsl(var(--danger))]"
      : "stroke-[hsl(var(--accent))]";

  const label =
    tone === "ok" ? "Allocated" : tone === "over" ? "Over 100%" : "Allocated";

  const wrapperStyle: React.CSSProperties = responsive
    ? { width: `min(${size}px, 60vw)`, aspectRatio: "1 / 1" }
    : { width: size, height: size };

  return (
    <div
      className={cn("relative inline-flex flex-col items-center", className)}
      style={wrapperStyle}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="100%"
        className="-rotate-90"
        preserveAspectRatio="xMidYMid meet"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-[hsl(var(--surface-2))]"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={cn("transition-colors", stroke1)}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - dash }}
          transition={{ type: "spring", stiffness: 180, damping: 28 }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-semibold tabular-nums leading-none">
            {(totalBp / 100).toFixed(totalBp % 100 === 0 ? 0 : 1)}%
          </div>
          <div className={cn(
            "mt-0.5 text-[10px] font-medium uppercase tracking-wider",
            tone === "ok" && "text-[hsl(var(--success))]",
            tone === "under" && "text-[hsl(var(--fg-muted))]",
            tone === "over" && "text-[hsl(var(--danger))]"
          )}>
            {label}
          </div>
        </div>
      )}
    </div>
  );
}
