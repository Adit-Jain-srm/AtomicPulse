# DevOps & Deployment — AtomicPulse

## Environments
| Env | Branch | DB | Auth Mode | AI Mode |
|---|---|---|---|---|
| Production | `main` | Neon `main` branch | `both` (Entra + Demo) | live |
| Preview | every PR | Neon branch DB (auto-created) | `demo` | live (gated by AI key) or `stub` |
| Local | dev branch | local Postgres or SQLite fallback | `demo` | `stub` by default |

## Vercel Project
- Project name: `atomic-pulse`.
- Framework preset: Next.js.
- Region: `iad1` primary; AI streaming uses Edge in regions where supported.
- Fluid Compute enabled for Functions.
- Cache Components enabled (Next 16 default).
- Cron jobs configured in `vercel.json` (cycle reminders + escalation tick).

## Environment variables (production)
```
DATABASE_URL=postgres://...
DATABASE_URL_UNPOOLED=postgres://...
SESSION_SECRET=...
SESSION_SECRET_PREVIOUS=...
AUTH_MODE=both                       # demo | entra | both
DEMO_MODE_ENABLED=true
APP_BASE_URL=https://atomic-pulse.vercel.app

AI_GATEWAY_API_KEY=...
AI_MODEL_DEFAULT=azure/gpt-4o
AI_MODEL_FALLBACK=azure/gpt-4o-mini
AI_MODE=live                         # live | stub

AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_TENANT_ID=...
AZURE_REDIRECT_URI=https://atomic-pulse.vercel.app/api/auth/callback

TEAMS_WEBHOOK_SECRET=...
GRAPH_SYNC_ENABLED=true
MAIL_FROM_USER_ID=...
```

## CI/CD (GitHub Actions)
- `.github/workflows/ci.yml`:
  - Triggers: `push` to `main`, every PR.
  - Steps:
    1. Checkout + Node 22 + npm install (cached).
    2. `npm run lint` (ESLint + Prettier check).
    3. `npm run typecheck` (`tsc --noEmit`).
    4. `npm run test` (Vitest).
    5. `npm run db:generate` then `drizzle-kit check` against schema (no drift).
    6. `npm run ai:eval` (only if `AI_GATEWAY_API_KEY_TEST` secret present; soft pass otherwise).
    7. `npm run build`.
    8. Upload Playwright + Lighthouse artifacts on PR.
- Vercel deploys on PR (preview) and on merge to main (production).
- Vercel Agent installed for AI PR review.

## Migrations
- `npm run db:generate` produces SQL under `drizzle/`.
- Production migrations gated:
  - PRs that touch `lib/db/schema/` require label `migration-reviewed`.
  - On `main`: GH Action runs `drizzle-kit migrate` against the prod Neon branch *before* the Vercel deploy completes (uses Neon's "wait for branch" advisory pattern).

## Local dev
- `npm install`
- `cp .env.example .env.local` + fill (or accept defaults: `AUTH_MODE=demo`, `AI_MODE=stub`, `DATABASE_URL=file:./dev.db` for SQLite fallback).
- `npm run db:push` (push schema to local).
- `npm run db:seed`.
- `npm run dev` → http://localhost:3000.
- `npm run dev:teams-stub` (optional) starts a tiny webhook echo server.

## Observability
- Vercel Logs (default) → structured JSON via `pino`.
- Vercel Analytics + Speed Insights.
- AI Gateway dashboard.
- (Optional) Azure Monitor exporter when `AZURE_MONITOR_CONN_STRING` is set.

## Rollback
- Vercel "Promote to Production" with prior deployment, single click.
- DB rollback: Neon branch instant-restore.

## Backup
- Neon point-in-time recovery (7 days default).
- `audit_event` exported nightly to Azure Blob (admin-configurable) for 7-year retention.
