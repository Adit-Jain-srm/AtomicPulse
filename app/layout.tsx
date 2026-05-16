import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "AtomicPulse — AI-First Goal Setting",
  description:
    "AtomicPulse turns enterprise goal setting into a fluid, AI-native workspace. Build, align, track and report — beautifully.",
  applicationName: "AtomicPulse",
  authors: [{ name: "Team AtomicPulse" }],
  metadataBase: new URL(process.env.APP_BASE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
          <Toaster
            position="bottom-right"
            theme="system"
            toastOptions={{
              classNames: {
                toast:
                  "bg-[hsl(var(--surface-1))] border border-[hsl(var(--border-subtle))] text-[hsl(var(--fg-primary))] shadow-lg",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
