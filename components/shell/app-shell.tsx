"use client";
import * as React from "react";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { CopilotPanel } from "@/components/copilot/copilot-panel";
import { Sheet } from "@/components/ui/sheet";
import type { Session } from "@/lib/auth/session";

export function AppShell({ session, children }: { session: Session; children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [copilotOpen, setCopilotOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setCopilotOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex min-h-dvh bg-[hsl(var(--surface-1))]">
      <AppSidebar session={session} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          session={session}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenCopilot={() => setCopilotOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
      <Sheet
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        side="left"
        ariaLabel="Navigation"
      >
        <AppSidebar session={session} mobile onNavigate={() => setMobileNavOpen(false)} />
      </Sheet>
      <CommandPalette session={session} open={paletteOpen} onOpenChange={setPaletteOpen} />
      <CopilotPanel session={session} open={copilotOpen} onOpenChange={setCopilotOpen} />
    </div>
  );
}
