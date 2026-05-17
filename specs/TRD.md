# TRD — AtomicPulse

## Stack (locked)
- **Runtime**: Node.js 22 LTS
- **Framework**: Next.js 15 (App Router, Server Components, Server Actions)
- **Language**: TypeScript 5.6+ (strict)
- **Styling**: Tailwind v4 + shadcn/ui (New York) + CSS variables for tokens
- **Animation**: Framer Motion 12
- **Forms**: react-hook-form + Zod
- **State**: React Server Components + `useOptimistic` + Zustand for ephemeral client state (command palette, copilot panel)
- **Data fetching**: Server Actions + `use cache` directive; AI streaming via AI SDK over Route Handlers
- **DB**: Postgres (Neon serverless in cloud, optional local SQLite for offline demo)
- **ORM**: Drizzle ORM + Drizzle Kit migrations
- **Vector**: pgvector (Neon) for semantic search
- **AI**: Vercel AI Gateway → Azure OpenAI (`gpt-4o`, `gpt-4o-mini`, `text-embedding-3-large`); AI SDK v5
- **Auth**: `@azure/msal-react` + `@azure/msal-node` for Entra ID; in-process `DemoAuthAdapter` for Demo Mode; unified `Session` interface
- **Workflows**: Vercel Workflow DevKit + Vercel Cron
- **Notifications**: Microsoft Graph (mail), Teams Incoming Webhook + Adaptive Cards 1.5, in-app SSE
- **Hosting**: Vercel Pro (Fluid Compute, multi-region edge)
- **Testing**: Vitest (unit), Playwright (e2e), `@axe-core/playwright` (a11y)
- **Lint/Format**: ESLint flat config + Prettier + `prettier-plugin-tailwindcss`

## Non-Functional Requirements
| NFR | Target | Verification |
|---|---|---|
| TTFB (cached dashboard) | <150ms p75 | Vercel Speed Insights |
| TTFB (uncached) | <600ms p75 | Vercel Speed Insights |
| Lighthouse perf | ≥95 on `/dashboard`, `/goals`, `/analytics` | CI Lighthouse via `treosh/lighthouse-ci-action` |
| Accessibility | WCAG 2.2 AA | `@axe-core/playwright` zero violations on key pages |
| Browser support | Last 2 versions of Chrome, Edge, Firefox, Safari | `browserslist` config |
| Responsive | ≥360px mobile, ≥1024px desktop, ≥1920px wide | Manual + Playwright viewport matrix |
| Uptime | 99.9% (Vercel SLA) | Vercel platform |
| AI streaming TTFT | <1.5s p75 | AI Gateway dashboards |
| AI structured-output validity | 100% (Zod parsed) | `streamObject` + retry-on-parse |
| Audit log completeness | 100% post-lock mutations | DB-level revoke + smoke test |
| RBAC enforcement | Server-side on every action | Test matrix per role × action |
| Cold start | <500ms | Vercel Fluid Compute |

## Scoring Correctness (BRD Table 0)
The four UoM formulas — `min`, `max`, `timeline`, `zero` — are pure functions in `lib/domain/scoring.ts`. They are **the most important correctness surface** in the system. Tested with literal BRD examples in `lib/domain/scoring.test.ts`. CI fails on any regression.

## Validation Rules (BRD §2.1)
Implemented as a single Zod schema (`lib/validation/goal-sheet.ts`) used identically on client (form errors) and server (action guard):
- `goals.length >= 1 && goals.length <= 8`
- `goals.every(g => g.weightage >= 10)`
- `goals.reduce((s, g) => s + g.weightage, 0) === 100`
- All numeric fields are integers in **basis points** (1% = 100 bp) to avoid float drift.

## Time Handling
All timestamps stored as `timestamp with time zone` (UTC). Display in user's tz (browser-detected). Quarter window arithmetic uses `date-fns-tz` to avoid DST traps.

## Error Handling
Every server action returns `{ ok: true, data } | { ok: false, error: { code, message, fields? } }`. UI uses an `ActionResult` discriminated union — never throws into render. Toast surface (`sonner`) for transient errors; inline field errors via react-hook-form.

## Build & Bundle
- Turbopack for dev + build (Next 16 default).
- RSC-first: client components only when interactive.
- Per-route bundle budget: <120KB JS gzipped on `/dashboard`.

## Observability
- Vercel Logs (structured JSON via `pino`).
- Vercel Analytics + Speed Insights enabled.
- AI Gateway dashboards for prompt latency / cost / failure.
- OpenTelemetry traces optionally exported to Azure Monitor when `AZURE_MONITOR_CONN_STRING` set.

## Browser-only Constraints
- Submission BRD: "must be accessible via web browser — no desktop-only applications". Met by default.
- Demo URL must be publicly accessible without VPN. Vercel preview URL satisfies this.

## Scoring conventions

### `SCORE_CAP_AT_100` (default `true`)

The four BRD scoring formulas (`min`/`max` × numeric/percent) bound each goal's achievement at **100% (10 000 bp)** by default. We chose this default for two reasons:

1. **Composite score is a weighted average.** When one goal overshoots target, an uncapped raw ratio can pull the sheet's `Composite_Score` past 100%, which is misleading and unfair to non-overshooting peers.
2. **BRD examples in Table 0 implicitly cap at 100% in the manager-friendly summary.** Returning >100% in tracking dashboards leaks an internal ratio that managers usually do not want to display.

When `SCORE_CAP_AT_100=false`, `computeScore` returns the raw bp ratio (still bounded ≥0) so analytics dashboards can surface "true" overshoot for performance discussions. `timeline` and `zero` UoMs are unaffected — they always return discrete bp values that can never exceed 10 000 by design.

Tested in `lib/domain/scoring.test.ts` under `describe("score cap flag")` with explicit `beforeEach`/`afterEach` env mutation and four cases (min_num + max_num × cap on/off).

### Canonical check-in schedule (BRD §2.2)

| Quarter | Window opens (canonical BRD) | Demo seed window |
|---------|-------------------------------|------------------|
| Q1      | 1 May → 31 May               | seeded; one is the active demo window |
| Q2      | 1 Jul → 31 Jul               | (varies — see `scripts/seed.ts`) |
| Q3      | 1 Oct → 31 Oct               | (varies) |
| Q4      | 1 Mar → 30 Apr (final)       | (varies) |

`scripts/seed.ts` deliberately keeps **one window open** at all times so the demo's check-in flow is interactive; a code comment near the seed inserts records the canonical schedule for production runs.

## Shared-goal invariants (BRD §2.1.4)

Goals with `goal.source === "shared"` are projections of a primary goal owned by the manager. They are **server-enforced read-only on every field except `weightageBp` and `position`**:

- `saveGoalSheetDraft` (in `app/actions/goals.ts`) looks up the existing row before applying any update. If `source === "shared"`, fields other than `weightageBp` / `position` are silently dropped and an `audit_event { action: "shared_field_blocked", afterJson: { droppedFields: [...] } }` is recorded. Server never throws — the legitimate weight change still saves.
- Achievement-side propagation runs in the other direction: when a primary goal's `currentActual` / `actualCompletionDate` / `status` changes (via `saveGoalSheetDraft` or via `upsertCheckIn` on submit), `syncSharedAchievement(primaryGoalId)` mirrors the new values onto every linked goal in the same `shared_goal` link group and emits a `shared_sync` audit per fan-out.

UI affordances mirror the server contract: shared goals render their inputs as `disabled` and the goal sheet shows a `Shared` badge so users understand the constraint, but the source of truth is the server action — never trust the client `disabled` attribute alone.

## AI provider modes — `AI_MODE`

Tri-mode dispatcher in `lib/ai/gateway.ts`:

| Mode      | Provider                       | Required env                                                                                                  |
|-----------|--------------------------------|---------------------------------------------------------------------------------------------------------------|
| `stub`    | Deterministic in-process stubs | none                                                                                                          |
| `gateway` | Vercel AI Gateway              | `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, `AI_MODEL_DEFAULT`, `AI_MODEL_FAST` (legacy `live` aliases here) |
| `azure`   | Direct Azure OpenAI            | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`        |

Every non-stub call is wrapped in `lib/ai/live-with-fallback.ts`:

- `AI_CALL_TIMEOUT_MS = 8000` — `AbortSignal.timeout(8s)` passed into `generateObject` / `streamText`.
- On timeout / error / schema mismatch, the route logs a content-free `[ai.fallback] { phase, skill, mode, reason, code }` line and falls back to the deterministic stub. The HTTP response stays `200` with `{ ok: true, data, fallback: true }` so the UX never breaks.
- The chat route falls back to `stubStream(messages)`; the skill route falls back to `runStub(skill, input, userId, orgId)`.

This is exercised by `npm run ai:eval`'s 8th case, which synthesizes an `AbortError` and asserts the classifier returns `reason: "timeout"`.

## E2E test policy

`playwright.config.ts` runs three projects (desktop-chromium, mobile-chromium @ Pixel 7 / 412×915, desktop-firefox) against `npm run dev` with `AI_MODE=stub`. Important constraints:

- `workers: 1` and `fullyParallel: false` because the local SQLite file does not tolerate concurrent `resetDb()` calls (`SQLITE_BUSY`). Lift to per-test schemas when migrating to Turso cloud.
- Tests assert against `page.locator("main")` rather than the page root so off-screen mobile-drawer duplicates do not shadow visible content.
- Mobile-only specs use `test.skip(({ isMobile }) => !isMobile)` so the same files run safely under all three projects.
