"use client";
import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ShieldCheck, ArrowRight, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DemoIdentity } from "@/lib/auth/demo-adapter";
import { toast } from "sonner";

const roleLabel: Record<DemoIdentity["role"], string> = {
  admin: "Admin · HR",
  manager: "Manager",
  employee: "Employee",
};

const roleTone: Record<DemoIdentity["role"], "info" | "success" | "neutral"> = {
  admin: "info",
  manager: "success",
  employee: "neutral",
};

export function SignInClient({
  identities,
  showDemo,
  showEntra,
}: {
  identities: DemoIdentity[];
  showDemo: boolean;
  showEntra: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);
  const [view, setView] = React.useState<"hero" | "demo">(showDemo && !showEntra ? "demo" : "hero");

  const filtered = React.useMemo(() => {
    if (!query) return identities;
    const q = query.toLowerCase();
    return identities.filter(
      (i) =>
        i.displayName.toLowerCase().includes(q) ||
        i.email.toLowerCase().includes(q) ||
        i.role.includes(q) ||
        (i.department ?? "").toLowerCase().includes(q)
    );
  }, [identities, query]);

  async function signInDemo(userId: string) {
    setPending(userId);
    try {
      const res = await fetch("/api/demo/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? "Sign-in failed");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
      setPending(null);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[hsl(var(--surface-0))]">
      <BackgroundOrnament />

      <div className="relative z-10 flex min-h-dvh items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="grid w-full max-w-6xl grid-cols-1 gap-10 md:grid-cols-[1.05fr_1fr]"
        >
          {/* LEFT — brand + value prop */}
          <div className="flex flex-col justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5">
                <div className="grid size-9 place-items-center rounded-lg ai-gradient text-white shadow-lg">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <div className="text-base font-semibold tracking-tight">AtomicPulse</div>
                  <div className="text-xs text-[hsl(var(--fg-muted))]">
                    AI-first goal setting & tracking
                  </div>
                </div>
              </Link>

              <h1 className="mt-12 text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl">
                The performance OS that <span className="ai-text">writes itself</span>.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[hsl(var(--fg-secondary))]">
                Set, align, and track every goal across the organization — with an AI copilot
                that drafts SMART goals, summarises quarters, and flags risk before it bites.
              </p>

              <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FeatureBullet
                  title="Audit-ready by default"
                  body="Every change is captured. Locks honor approval. Exports are reproducible."
                />
                <FeatureBullet
                  title="Microsoft-native"
                  body="Entra ID SSO, Teams Adaptive Cards, Outlook reminders, Graph org sync."
                />
                <FeatureBullet
                  title="Goal Copilot"
                  body="Generate SMART goals, suggest KPIs, summarise quarterly performance."
                />
                <FeatureBullet
                  title="Built for clarity"
                  body="100% weightage validation, shared goals, quarterly check-ins — no chaos."
                />
              </div>
            </div>

            <div className="mt-12 flex items-center gap-2 text-xs text-[hsl(var(--fg-muted))]">
              <ShieldCheck className="size-4" />
              <span>Enterprise-grade · Audit logged · Role-based access</span>
            </div>
          </div>

          {/* RIGHT — sign-in panel */}
          <div className="relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
              className="card-elev relative overflow-hidden p-7"
            >
              <div className="absolute inset-x-0 top-0 h-1 ai-gradient" />

              {view === "hero" && (
                <>
                  <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
                  <p className="mt-1 text-sm text-[hsl(var(--fg-muted))]">
                    Sign in to your AtomicPulse workspace.
                  </p>

                  <div className="mt-6 flex flex-col gap-3">
                    {showEntra && (
                      <a
                        href="/api/auth/sign-in"
                        className="group inline-flex h-11 items-center justify-center gap-3 rounded-md border border-[hsl(var(--border-strong))] bg-[hsl(var(--surface-0))] px-4 text-sm font-medium transition-all hover:bg-[hsl(var(--surface-1))]"
                      >
                        <MicrosoftLogo />
                        <span>Sign in with Microsoft</span>
                        <ArrowRight className="size-4 opacity-0 transition-all -ml-1 group-hover:ml-0 group-hover:opacity-100" />
                      </a>
                    )}

                    {showDemo && (
                      <Button
                        variant={showEntra ? "ai" : "primary"}
                        size="lg"
                        className="h-11"
                        onClick={() => setView("demo")}
                      >
                        <Sparkles className="size-4" />
                        Try Demo Mode
                        <ChevronRight className="size-4" />
                      </Button>
                    )}

                    {!showDemo && !showEntra && (
                      <div className="rounded-md border border-[hsl(var(--warn)/0.4)] bg-[hsl(var(--warn)/0.08)] p-3 text-sm text-[hsl(var(--warn))]">
                        No sign-in method is configured. Set <code>AUTH_MODE</code> in <code>.env.local</code>.
                      </div>
                    )}
                  </div>

                  <div className="mt-7 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4 text-sm">
                    <div className="font-medium">Demo for judges & reviewers</div>
                    <div className="mt-1 text-[hsl(var(--fg-muted))]">
                      No tenant required. Pick a role from the seeded org of {identities.length}{" "}
                      users. Switch roles any time from the avatar menu.
                    </div>
                  </div>
                </>
              )}

              {view === "demo" && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">Choose a role</h2>
                      <p className="mt-1 text-sm text-[hsl(var(--fg-muted))]">
                        Sign in as any seeded user — your demo session lasts 8 hours.
                      </p>
                    </div>
                    {showEntra && (
                      <Button variant="ghost" size="sm" onClick={() => setView("hero")}>
                        Back
                      </Button>
                    )}
                  </div>

                  <div className="relative mt-5">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[hsl(var(--fg-muted))]" />
                    <Input
                      autoFocus
                      placeholder="Search by name, role, or department"
                      className="pl-9"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>

                  <div className="mt-4 max-h-[420px] overflow-y-auto rounded-md border border-[hsl(var(--border-subtle))]">
                    {filtered.length === 0 && (
                      <div className="p-8 text-center text-sm text-[hsl(var(--fg-muted))]">
                        No users match your search.
                      </div>
                    )}
                    {filtered.map((id) => (
                      <button
                        key={id.id}
                        disabled={!!pending}
                        onClick={() => signInDemo(id.id)}
                        className={cn(
                          "group flex w-full items-center gap-3 border-b border-[hsl(var(--border-subtle))] px-4 py-3 text-left transition-colors last:border-b-0",
                          pending === id.id
                            ? "bg-[hsl(var(--accent-soft))]"
                            : "hover:bg-[hsl(var(--surface-1))]"
                        )}
                      >
                        <Avatar name={id.displayName} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{id.displayName}</span>
                            <Badge tone={roleTone[id.role]}>{roleLabel[id.role]}</Badge>
                          </div>
                          <div className="truncate text-xs text-[hsl(var(--fg-muted))]">
                            {id.title ? `${id.title} · ` : ""}
                            {id.department ?? id.email}
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-[hsl(var(--fg-muted))] transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-4 px-2 text-center text-xs text-[hsl(var(--fg-muted))]"
            >
              Press{" "}
              <kbd className="rounded bg-[hsl(var(--surface-2))] px-1.5 py-0.5 font-mono text-[10px] text-[hsl(var(--fg-secondary))]">
                ⌘K
              </kbd>{" "}
              anywhere in the app to invoke the AI copilot.
            </motion.div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

function FeatureBullet({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1)/0.6)] p-4 backdrop-blur">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-[hsl(var(--fg-muted))] leading-relaxed">{body}</div>
    </div>
  );
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

function BackgroundOrnament() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -top-40 left-1/3 h-[600px] w-[600px] rounded-full bg-[hsl(var(--ai-from)/0.18)] blur-3xl" />
      <div className="absolute right-0 top-1/3 h-[500px] w-[500px] rounded-full bg-[hsl(var(--ai-to)/0.16)] blur-3xl" />
      <div className="absolute inset-0 [background-image:linear-gradient(to_right,hsl(var(--border-subtle)/0.4)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border-subtle)/0.4)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)] opacity-40" />
    </div>
  );
}
