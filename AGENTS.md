## Learned User Preferences

- Execute attached implementation plans without editing the plan file itself.
- Use pre-created todos in `tasks/todo.md`; mark items in progress and completed; do not recreate plan todos.
- Do not run git commit unless explicitly asked; when asked, write meaningful commit messages focused on why.
- Keep all imports at the top of each module (no trailing or inline imports).
- Auth UX: support both Microsoft Entra sign-in and Demo Mode role switcher as equal first-class paths.

## Learned Workspace Facts

- AtomicPulse stack: Next.js 15 on Vercel, TypeScript strict, Tailwind v4, Drizzle ORM, App Router + Server Actions.
- Local database: libsql/SQLite via `DATABASE_URL=file:./dev.db`; production on Turso edge DB (Mumbai `aws-ap-south-1`); `drizzle.config.ts` uses `dialect: "turso"` for remote URLs.
- Auth env: `AUTH_MODE` is `demo`, `entra`, or `both`; demo identities via `DEMO_MODE_ENABLED` / demo sign-in API.
- MSAL: `@azure/msal-node` ConfidentialClientApplication for auth code flow + client credentials; `acquireGraphToken()` for Graph calls; listed in `next.config.ts` serverExternalPackages.
- Graph org sync: `syncOrgFromGraph` pages /v1.0/users, resolves manager chains, maps roles from `GRAPH_ADMIN_GROUP_ID` group membership; `@microsoft/microsoft-graph-client` installed.
- AI env: `AI_MODE` is `stub`, `gateway`, or `azure` (tri-mode in `lib/ai/gateway.ts`); `/api/copilot/insights` generates live insights from Azure OpenAI, falls back to data-driven stub.
- Azure OpenAI: pin `@ai-sdk/azure` v2.x with `ai@5` (v3 triggers `AI_UnsupportedModelVersionError`); use `useDeploymentBasedUrls: true` and `AZURE_OPENAI_API_VERSION=2024-10-21`; `streamText` is synchronous—never `await` it or streaming breaks.
- Notifications: Teams (`TEAMS_WEBHOOK_URL_DEFAULT`, Adaptive Card 1.5 with deep links) + Outlook email (`GRAPH_MAIL_ENABLED=true`, `MAIL_FROM_USER_ID`, Graph sendMail); all events fire both channels; stubs gracefully when not configured.
- Server Components must not pass Lucide icons to client `StatCard`; use serializable `iconName` keys from `STAT_ICON_MAP`.
- Cycle-scoped queries should use `getActiveCycle` (`status === "open"`), not `orgId` + `.limit(1)` without status.
- Escalation engine: 3 triggers (`no_submit`, `no_approve`, `no_checkin`) with chain escalation, dedup, and overlap prevention via `globalThis` lock; cron daily (`0 8 * * *`) — Vercel Hobby limits cron to once/day.
- Caching: `unstable_cache` on escalation queries (60s TTL), analytics queries (300s TTL), session user (60s TTL); invalidated via `revalidateTag` on mutations.
- SSE notifications: `/api/notifications/stream` polls every 8s and sends delta events; topbar Bell uses `EventSource` for live unread badge.
- Playwright E2E runs `npm run dev` with `AI_MODE=stub` and `DEMO_AUTH_ENABLED=true`; `workers: 1` for SQLite; 150 unit tests (Vitest) + 20+ e2e tests (desktop-chromium).
- Vercel: `vercel.json` with `bom1` region, immutable cache headers for `/_next/static/`; deploy via `npx vercel --prod --scope aj5 --yes`; production URL `atomic-pulse-aj5.vercel.app`; `maxDuration = 30` on AI route handlers (Hobby default is 10s).
- CI: `drizzle-kit push --force` needed (no TTY); GitHub Actions uses `actions/checkout@v6` and `actions/setup-node@v6` (v4 tags no longer resolve).
- Seed script `clearAll` uses try/catch per table for first-run resilience when tables don't yet exist.
- Never store or repeat API keys, `.env.local` secrets, or credentials in docs or memory.
- PowerShell pipe adds trailing newlines to Vercel env vars; use Node `execSync` with `{input: value}` to set env values cleanly.
- AI timeout set to 25s (Azure OpenAI cold-start latency cross-region); route handlers need `maxDuration = 30` to avoid premature termination.
