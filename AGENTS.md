## Learned User Preferences

- Execute attached implementation plans without editing the plan file itself.
- Use pre-created todos in `tasks/todo.md`; mark items in progress and completed; do not recreate plan todos.
- Do not run git commit unless explicitly asked; when asked, write meaningful commit messages focused on why.
- Keep all imports at the top of each module (no trailing or inline imports).
- Auth UX: support both Microsoft Entra sign-in and Demo Mode role switcher as equal first-class paths.

## Learned Workspace Facts

- AtomicPulse stack: Next.js 15 on Vercel, TypeScript strict, Tailwind v4, Drizzle ORM, App Router + Server Actions.
- Local database: libsql/SQLite via `DATABASE_URL=file:./dev.db`; schema is Neon Postgres–compatible for production.
- Auth env: `AUTH_MODE` is `demo`, `entra`, or `both`; demo identities via `DEMO_MODE_ENABLED` / demo sign-in API.
- AI env: `AI_MODE` is `stub`, `gateway`, or `azure` (tri-mode in `lib/ai/gateway.ts`); E2E defaults to `stub`.
- Azure OpenAI: pin `@ai-sdk/azure` v2.x with `ai@5` (v3 triggers `AI_UnsupportedModelVersionError`).
- Azure client: use `useDeploymentBasedUrls: true` and `AZURE_OPENAI_API_VERSION=2024-10-21` (avoid `2025-01-01-preview` on `/openai/v1/`).
- Server Components must not pass Lucide icons to client `StatCard`; use serializable `iconName` keys from `STAT_ICON_MAP`.
- Cycle-scoped queries should use `getActiveCycle` (`status === "open"`), not `orgId` + `.limit(1)` without status.
- Escalation engine: 3 triggers (`no_submit`, `no_approve`, `no_checkin`) with chain escalation, dedup, and overlap prevention via `globalThis` lock; cron every 6h in `vercel.json`.
- Caching: `unstable_cache` on escalation queries (60s TTL), analytics queries (300s TTL), session user (60s TTL); invalidated via `revalidateTag` on mutations.
- SSE notifications: `/api/notifications/stream` polls every 8s and sends delta events; topbar Bell uses `EventSource` for live unread badge.
- Playwright E2E runs `npm run dev` with `AI_MODE=stub` and `DEMO_AUTH_ENABLED=true`; `workers: 1` for SQLite; 150 unit tests (Vitest) + 20+ e2e tests (desktop-chromium).
- Vercel: `vercel.json` with `bom1` region, immutable cache headers for `/_next/static/`; production build ~33kB middleware, ~102kB shared JS.
- CI: `drizzle-kit push --force` needed (no TTY); GitHub Actions uses `actions/checkout@v6` and `actions/setup-node@v6` (v4 tags no longer resolve).
- Seed script `clearAll` uses try/catch per table for first-run resilience when tables don't yet exist.
- Never store or repeat API keys, `.env.local` secrets, or credentials in docs or memory.
