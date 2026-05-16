"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}

export function Sheet({
  open,
  onClose,
  side = "left",
  children,
  ariaLabel,
  className,
}: SheetProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const fromX = side === "left" ? "-100%" : "100%";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            initial={{ x: fromX }}
            animate={{ x: 0 }}
            exit={{ x: fromX }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
            className={cn(
              "fixed top-0 z-50 flex h-dvh w-full max-w-[300px] flex-col",
              "border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-0))] shadow-2xl",
              side === "left" ? "left-0 border-r" : "right-0 border-l",
              className
            )}
          >
            <div className="flex h-full min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
