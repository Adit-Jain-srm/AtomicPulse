# AtomicPulse

> **AI-first goal setting and tracking for the modern enterprise.**
> Built for the AtomQuest hackathon to feel like Microsoft Loop × Linear × Notion × Workday × an AI Copilot — fluid, opinionated, and audit-ready.

---

## TL;DR — 60-second setup

```bash
# 1. Install
npm install

# 2. Bootstrap the local SQLite database + seed
npm run db:push
npm run db:seed

# 3. Launch the demo (Demo Mode is on by default)
npm run dev
# → open http://localhost:3000  →  pick any of 12 personas (employee / manager / admin)
```

That's it. Every flow — goal authoring, manager review, quarterly check-ins, AI Copilot, analytics, escalations, exports — is fully demoable offline against the seeded org.

---

## What's inside

- **Next.js 15 App Router** + **TypeScript** + **TailwindCSS v4** + **shadcn/ui-style** primitives.
- **Drizzle ORM** over **libsql / SQLite** locally; schema modeled to migrate cleanly to **Neon Postgres** + `pgvector`.
- **Vercel AI Gateway** wiring (Azure OpenAI ready) with a **stub mode** for offline demos.
- **Vercel Workflow DevKit / Cron** stubbed for escalation sweeps every 6h.
- **Dual auth**: Demo persona switcher + Microsoft **Entra ID (MSAL)** adapter behind a feature flag.
- **Microsoft 365 hooks**: Graph (org sync), Teams (Adaptive Cards), Outlook (Graph mail) — all behind env flags.
- **RBAC** matrix enforced on every server action and API route.
- **Insert-only audit log** for every state-changing action.
- **CSV + XLSX exports** of achievement data and audit trail.

See `specs/` for full PRD, TRD, architecture, RBAC matrix, AI architecture, security model, MS integration plan, scalability + cost plans, and design system.

---

## Repo map

```
app/                      Next.js routes (auth, dashboard, goals, check-ins, team, shared, analytics, copilot, admin)
  api/                    Server routes: auth, demo, copilot/{chat,skill}, exports, notifications/stream, cron/escalations, teams/webhook
  actions/                Server Actions: goals, check-ins
components/               Hand-rolled UI primitives + feature components (goal sheet, dashboards, copilot)
lib/
  ai/                     Skill registry, gateway client, deterministic stubs
  auth/                   Sessions, demo adapter, MSAL adapter (stub)
  db/                     Drizzle schema, client, queries
  domain/                 Scoring formulas (BRD), state machine, audit, escalations, windows
  exports/                CSV / XLSX builders
  integrations/           Graph, Teams, Outlook (stubbed behind env flags)
  rbac/                   Matrix + guards
  validation/             Zod schemas
scripts/                  seed.ts, ai-eval.ts
specs/                    PRD, TRD, architecture, db, RBAC, API, AI, security, MS integration, devops, design system, sprint plan
docs/diagrams/            Mermaid sources
```

---

## NPM scripts

| Script               | Purpose |
|----------------------|---------|
| `npm run dev`        | Next dev server with Turbopack |
| `npm run build`      | Production build |
| `npm run typecheck`  | `tsc --noEmit` |
| `npm run lint`       | Next lint |
| `npm run test`       | Vitest unit tests (BRD scoring formulas + score-cap flag) — **22 tests** |
| `npm run ai:eval`    | Schema-checked eval for every AI skill + the live→stub fallback wrapper — **8 cases** |
| `npm run db:push`    | Drizzle Kit push (creates `dev.db`) |
| `npm run db:seed`    | Reseed demo org, users, goals, check-ins, escalations |
| `npm run e2e`        | Playwright e2e suite — chromium desktop, chromium mobile (Pixel 7), firefox desktop |
| `npm run e2e:ui`     | Same suite, opens Playwright UI runner |
| `npm run e2e:install`| `playwright install --with-deps chromium firefox` (run once) |

---

## Environment

Copy `.env.example` to `.env.local`. Demo mode is the default; everything else is opt-in.

### AI provider — three modes (`AI_MODE`)

| Mode      | Use case                              | Requires                                                                  |
|-----------|---------------------------------------|---------------------------------------------------------------------------|
| `stub`    | Offline demo, hackathon judges, CI    | nothing — deterministic outputs from `lib/ai/stub.ts`                     |
| `gateway` | Production via Vercel AI Gateway      | `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, `AI_MODEL_DEFAULT`, `AI_MODEL_FAST` |
| `azure`   | Direct Azure OpenAI (BYO resource)    | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` |

In every non-stub mode, calls run through `lib/ai/live-with-fallback.ts` with an **8-second `AbortSignal.timeout()`**; on any failure (timeout, error, schema mismatch) the route logs a content-free `[ai.fallback] {phase, skill, mode, reason, code}` line and falls back to the deterministic stub. Demos never break, even with a bad key or rate-limited tenant.

```env
APP_BASE_URL=http://localhost:3000
SESSION_SECRET=dev-secret-change-me-please-32-bytes-long-ok
AUTH_MODE=both
DEMO_AUTH_ENABLED=true
DATABASE_URL=file:./dev.db

# AI provider
AI_MODE=stub                                        # stub | gateway | azure

# Gateway mode
AI_GATEWAY_API_KEY=
AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1
AI_MODEL_DEFAULT=openai/gpt-4o
AI_MODEL_FAST=openai/gpt-4o-mini

# Azure OpenAI mode
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2025-01-01-preview

# Microsoft Entra (optional)
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
AZURE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Graph / Teams / Outlook (optional)
GRAPH_SYNC_ENABLED=false
TEAMS_WEBHOOK_URL=
TEAMS_WEBHOOK_INBOUND=false
GRAPH_MAIL_ENABLED=false

# Scoring policy
SCORE_CAP_AT_100=true                               # set "false" to return raw bp ratios (>100% allowed)

# Cron (production)
CRON_SECRET=
```

---

## Architecture in one diagram

```mermaid
flowchart LR
  user[User]
  user --> ui[Next.js App Router\nServer Components + Client Islands]
  ui --> sa[Server Actions / Route Handlers]
  sa --> db[(Drizzle ORM\nSQLite / Neon Postgres)]
  sa --> rbac[RBAC Guards]
  sa --> ai[AI Gateway → Azure OpenAI\nstub fallback]
  sa --> wf[Vercel Workflow DevKit\nCron]
  ui --> sse[Notifications SSE]
  wf --> teams[Teams Adaptive Cards]
  wf --> outlook[Outlook via Graph]
  graph[Microsoft Graph] --> db
```

---

## Demo personas

| Email                | Role     | Notes |
|----------------------|----------|-------|
| `riya@atomic.demo`   | admin    | Full org view, audit trail, exports |
| `karim@atomic.demo`  | manager  | 4 reports, pending approvals + check-in acks |
| `sara@atomic.demo`   | manager  | 4 reports, locked + draft sheets |
| `priya@atomic.demo`  | employee | Approved sheet with Q1 check-in submitted |
| `daniel@atomic.demo` | employee | Submitted sheet awaiting review |
| `lina@atomic.demo`   | employee | Returned sheet with manager comment |

Sign in with the persona switcher on `/sign-in`.

---

## Tests + verification

| Layer | Command | Coverage |
|-------|---------|----------|
| Types | `npm run typecheck` | strict TypeScript across app/lib/scripts/tests, zero errors |
| Unit  | `npm run test`      | 22 Vitest cases — BRD min/max/timeline/zero scoring + `SCORE_CAP_AT_100` flag |
| AI    | `npm run ai:eval`   | 8 cases — Zod schema conformance for 7 skills + live→stub fallback classifier |
| Build | `npm run build`     | Production build, 28 routes, ~102 kB shared JS |
| E2E   | `npm run e2e`       | 23 specs × 3 projects = 69 Playwright runs across desktop chromium, mobile chromium (Pixel 7 / 412×915), desktop firefox |

The Playwright suite covers auth (3 roles), employee goal lifecycle (load / validate / submit), manager review (queue / approve / return), shared goals, check-ins (open window / score / ack), admin (cycles / audit / CSV exports), analytics charts, copilot stub streaming, and a dedicated mobile-only responsive spec (sidebar drawer, no horizontal scroll, ≥44px touch targets). On a clean run: **60 pass, 9 properly skipped (mobile-only specs on desktop projects + a seed-dependent shared-goal UI assertion), 0 fail**.

### Manually tested viewports

| Viewport            | Coverage                                              |
|---------------------|-------------------------------------------------------|
| 375 × 812 (iPhone)  | Mobile drawer, hamburger, single-column goal rows    |
| 412 × 915 (Pixel 7) | Same as above, automated via Playwright `mobile-chromium` |
| 768 × 1024 (iPad)   | Sidebar still hidden until `lg` (1024px)             |
| 1280 × 800          | Desktop rail visible, 4-up stat grid                 |
| 1920 × 1080         | Wide layout, max-content-width 1400px                |

---

## Deploying to Vercel

1. Connect the repo and create a new project.
2. Set the env vars above. For real prod, swap `DATABASE_URL` to Neon (`postgres://…`) and run the Postgres migrations.
3. The `vercel.json` registers a 6-hourly cron for `/api/cron/escalations`. Provide `CRON_SECRET` for hardening.
4. `npm run build` is the build command.

---

## License

For evaluation as part of the AtomQuest hackathon submission.
