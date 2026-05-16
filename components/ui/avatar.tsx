import * as React from "react";
import { cn, initials } from "@/lib/utils";

const palette = [
  "from-violet-500 to-fuchsia-500",
  "from-blue-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-purple-500",
  "from-sky-500 to-blue-600",
  "from-lime-500 to-green-600",
];

function pickGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function Avatar({
  name,
  src,
  size = 32,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const grad = pickGradient(name);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white font-medium",
        "bg-gradient-to-br",
        grad,
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.42) }}
      aria-label={name}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}
