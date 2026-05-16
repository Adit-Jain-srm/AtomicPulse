"use client";
import * as React from "react";
import type { UomType } from "@/lib/domain/scoring";
import { cn } from "@/lib/utils";

const OPTIONS: { value: UomType; label: string; sub: string; tone: string }[] = [
  { value: "min_num", label: "Min", sub: "#", tone: "blue" },
  { value: "min_pct", label: "Min", sub: "%", tone: "blue" },
  { value: "max_num", label: "Max", sub: "#", tone: "amber" },
  { value: "max_pct", label: "Max", sub: "%", tone: "amber" },
  { value: "timeline", label: "Time", sub: "📅", tone: "violet" },
  { value: "zero", label: "Zero", sub: "0", tone: "rose" },
];

export function UomPicker({
  value,
  onChange,
  disabled,
}: {
  value: UomType;
  onChange: (v: UomType) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn(
      "flex h-9 items-stretch overflow-hidden rounded-md border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] text-xs",
      disabled && "opacity-60"
    )}>
      {OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            title={`${o.label} ${o.sub}`}
            className={cn(
              "flex flex-col items-center justify-center px-2 transition-colors",
              active
                ? "bg-[hsl(var(--accent))] text-white"
                : "text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-1))]"
            )}
          >
            <span className="text-[10px] font-medium leading-none">{o.label}</span>
            <span className={cn("text-[9px] leading-none", active ? "opacity-90" : "text-[hsl(var(--fg-muted))]")}>
              {o.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}
