export default function AppLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--accent))] border-t-transparent" />
        <p className="text-sm text-[hsl(var(--fg-muted))]">Loading…</p>
      </div>
    </div>
  );
}
