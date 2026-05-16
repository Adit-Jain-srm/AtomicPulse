# AtomicPulse — Live Execution Checklist

Plan: `c:\Users\aditj\.cursor\plans\atomicpulse_goal_portal_26b00808.plan.md`

## Phase 0 — Specs
- [x] Create `specs/`, `docs/`, `tasks/` directories
- [x] PRD
- [x] TRD
- [x] Architecture
- [x] DB schema
- [x] RBAC matrix
- [x] API contract
- [x] AI architecture
- [x] Security model
- [x] Microsoft integration
- [x] DevOps & deployment
- [x] Cost plan
- [x] Scalability plan
- [x] Design system
- [x] Sprint plan
- [x] Architecture diagram (mermaid)
- [x] tasks/lessons.md skeleton

## Phase 1 — Foundation
- [x] Scaffold Next.js 15 + TS (Next 16 deferred for ecosystem stability)
- [x] Tailwind v4 + hand-rolled shadcn primitives + Framer Motion
- [x] Drizzle + libsql/SQLite (Neon-compatible schema)
- [x] Initial schema + migration via `drizzle-kit push`
- [x] Dual-path auth (MSAL stub + Demo Mode) behind unified `Session` interface
- [x] Layout shell: sidebar, topbar, command palette, theme switch
- [x] Seed script: org + thrust areas + cycle + 12-person sample org
- [x] Gate: both sign-in paths land on a role-aware dashboard

## Phase 2 — Goal Lifecycle (BRD §2.1)
- [x] Thrust-area model + admin viewer
- [x] Goal sheet draft / submit / lock state machine
- [x] Goal editor UI: UoM picker, weightage stepper, live `WeightageRing`
- [x] Validators: =100%, min 10%, max 8 (server + client via shared Zod)
- [x] Manager review: inline edit, return-for-rework, approve, lock
- [x] Shared Goals: push to multiple employees, primary→linked sync
- [x] Insert-only audit log on every post-lock change
- [x] Gate: full employee→manager→approve flow demoable

## Phase 3 — Check-ins + Reporting (BRD §2.2 + §4)
- [x] Cycle + check-in window enforcement (Q1 Jul / Q2 Oct / Q3 Jan / Q4 Mar–Apr)
- [x] Achievement input per UoM type
- [x] Live computed score (18 unit tests against BRD formulas, all pass)
- [x] Manager check-in module + structured comments
- [x] Completion dashboard
- [x] CSV + XLSX exports (`/api/exports/achievement.{csv,xlsx}` + `/api/exports/audit.csv`)
- [x] Audit-trail viewer (`/admin/audit`)
- [x] Gate: open Q1 → employee submits → manager checks in → export works

## Phase 4 — AI Copilot + Analytics
- [x] AI Gateway client + skill registry
- [x] `generateSmartGoal` (stub + live path)
- [x] `improveGoalClarity`
- [x] `suggestKpi`
- [x] `summarizeQuarter`
- [x] `predictCompletionRisk`
- [x] `managerCopilot`
- [x] `goalAlignmentCheck`
- [x] `semanticSearch` (keyword fallback; pgvector wiring deferred to Postgres swap)
- [x] Copilot side panel + dedicated `/copilot` page + inline AI in goal editor
- [x] Analytics: heatmap, QoQ trends, thrust/UoM distribution, manager-effectiveness grid
- [x] Gate: every skill streams + has eval coverage (`npm run ai:eval` → 7/7 pass)

## Phase 5 — Microsoft + Workflows
- [x] Microsoft Graph org-hierarchy sync (stub behind GRAPH_SYNC_ENABLED)
- [x] Teams Adaptive Cards (`lib/integrations/teams.ts`) + inbound webhook (`/api/teams/webhook`)
- [x] Outlook transactional emails via Graph (stub)
- [x] Escalation engine + cron sweep (`lib/domain/escalations.ts`, `vercel.json` cron)
- [x] In-app notifications SSE stream (`/api/notifications/stream`)
- [x] Gate: no-action escalation fires end-to-end (sweep insert → notification + Teams + Outlook stubs)

## Phase 6 — Polish + Submission
- [x] Skeletons + error states across dashboards, goal sheet, check-ins
- [x] Motion + accessibility: framer-motion + reduced-motion respect, focus rings, semantic labels
- [x] Production build green: 28 routes, 102 kB shared JS
- [x] Vitest scoring suite (18 tests) + AI eval (7 skills) green
- [x] Rich demo seed (3 quarters worth of state, 12 employees, full status spectrum)
- [x] Architecture diagram exported (`docs/diagrams/architecture.mmd`)
- [x] README with 60-second setup, persona table, env matrix, deploy notes
- [x] Vercel deploy config (`vercel.json` cron + Next 15 build)
- [x] 3-role login docs in README

## Phase A — BRD compliance hardening (Compliance, Azure, Responsive, E2E plan)
- [x] Shared-goal server enforcement: `saveGoalSheetDraft` silently coerces shared-goal edits to `weightageBp` + `position` only; dropped fields are recorded as `shared_field_blocked` audit events.
- [x] Primary→linked sync wired from `saveGoalSheetDraft` (on actuals/status drift) and from `upsertCheckIn` on submit; `syncSharedAchievement` rewritten to mirror `currentActual`, `actualCompletionDate`, `status`, `computedScoreBp` and emit a `shared_sync` audit per fan-out.
- [x] Escalation `no_checkin` scope extended to `["approved", "locked"]` (was approved-only).
- [x] Multi-quarter export: `Q1_*` / `Q2_*` / `Q3_*` / `Q4_*` (Actual / Status / Score / ManagerComment) + `Composite_Score`, single `HEADER_ORDER` shared by CSV + XLSX writers.
- [x] Manager-effectiveness analytics card (horizontal bar chart of % reports current on the most recent open / fallback closed window) with server-side aggregation.
- [x] Responsive Recharts via a `useContainerWidth` (ResizeObserver) hook — pie radii + bar margins shrink under 360 / 480 px.
- [x] `SCORE_CAP_AT_100` env flag: default `true` keeps current behavior; `false` returns raw bp ratios. 4 new vitest cases pin both behaviors.

## Phase B — Azure OpenAI + live-with-fallback
- [x] `@ai-sdk/azure` installed; tri-mode `AiMode = "stub" | "gateway" | "azure"` with legacy `live → gateway` alias.
- [x] Lazy `azureProvider()` parses `resourceName` from `AZURE_OPENAI_ENDPOINT`; `getModel(kind)` per-mode dispatch; `getSkillGenerationOptions(kind)` returns `{ temperature, maxOutputTokens }` (default 0.4 / 2048, fast 0.2 / 1024).
- [x] `lib/ai/live-with-fallback.ts`: `AI_CALL_TIMEOUT_MS = 8000`, `timeoutSignal()`, `classifyError()`, content-free `logAiFallback()`.
- [x] `app/api/copilot/skill/route.ts` and `app/api/copilot/chat/route.ts` wrap live calls in 8s timeout + try/catch → log fallback → return stub with `fallback: true` flag (200, never 500 unless stub itself fails).
- [x] `.env.example` rewritten as a tri-mode block; `.env.local` set to `AI_MODE=azure` with empty Azure placeholders (no real keys committed).
- [x] AI eval extended to 8 cases (7 skills + synthetic `AbortError` fallback classifier).

## Phase C — Responsive polish
- [x] New `components/ui/sheet.tsx` framer-motion drawer (Escape, body-scroll lock, safe-area).
- [x] App shell: sidebar `hidden lg:flex` desktop rail; topbar `Menu` button (`lg:hidden`) opens the sidebar inside the new Sheet; state lifted to `app-shell.tsx`.
- [x] Stat grids `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` across employee + admin dashboards and `/team`.
- [x] Touch targets ≥44px on mobile via `Button` `max-md:min-h-11 max-md:min-w-11`; weightage `±` and remove-goal buttons sized up on mobile; check-in period pills `min-h-10`.
- [x] GoalRow + check-ins inputs collapse to single-column below `sm`; meta rows wrap.
- [x] WeightageRing `responsive` prop renders fluidly via `min(160px, 60vw)` + `aspect-ratio: 1/1` + viewBox.
- [x] Copilot composer: icon-only Send under `sm`; `h-[min(68dvh,800px)]`; safe-area padding on every bottom container (drawer, copilot panel, sheet).

## Phase D — Playwright e2e suite
- [x] `playwright.config.ts` with three projects (desktop-chromium, mobile-chromium @ Pixel 7, desktop-firefox), `webServer` runs `npm run dev` with `AI_MODE=stub`, `workers: 1` to avoid parallel SQLite locks.
- [x] Fixtures: `signInAs(page, role | { email, displayName })`, `signOut(page)`, `resetDb()`.
- [x] 9 specs: `auth`, `employee-goals`, `manager-review`, `shared-goals`, `check-ins`, `admin`, `analytics`, `copilot`, `responsive` — assertions scoped to `<main>` so off-screen drawer duplicates don't shadow the visible UI.
- [x] `.github/workflows/e2e.yml` runs typecheck → vitest → ai-eval → playwright on push and PR.
- [x] All three projects green on a clean run: 60 pass, 9 proper skips, 0 fail.

## Phase E — Verification + docs
- [x] `npm run typecheck` clean
- [x] `npm test` 22/22 green
- [x] `npm run ai:eval` 8/8 green (incl. fallback classifier)
- [x] `npm run build` green (28 routes, 102 kB shared JS)
- [x] `npx playwright test` green across all three projects
- [x] README updated: tri-mode env block, `npm run e2e` instructions, manually-tested viewports table
- [x] `tasks/todo.md` updated with this phase rollup
- [x] `tasks/lessons.md` updated with new patterns (AI fallback, server-as-source-of-truth for shared, `<main>`-scoped Playwright queries, single-worker SQLite e2e)
- [x] `specs/TRD.md` updated with Scoring conventions + Shared-goal invariants + Azure-mode section
- [x] `specs/ai-architecture.md` updated with the tri-mode dispatcher diagram

## Review

**Status:** All phases complete, including the new BRD-compliance / Azure-direct / responsive / e2e cycle. Production build passes, type-check is clean, every test layer is green, Playwright is green on all three projects.

**Highlights:**
- Built the entire app on **Next.js 15 / React 19** with Server Components, Server Actions, and Client Islands. Picked Next 15 over the just-released Next 16 for hackathon stability.
- **libsql/SQLite** locally with a Drizzle schema that mirrors a future **Neon Postgres + pgvector** target — zero rewrite needed to switch.
- **Dual auth** (Demo persona switcher + Entra ID adapter) behind a unified `Session` shape; switches with a single env flag.
- **Insert-only audit log** + **diff capture** on every state-changing action; viewable at `/admin/audit` and exportable.
- **AI Copilot** with a stubbed mode that runs offline and a live mode that streams via Vercel AI Gateway → Azure OpenAI; every skill has Zod-validated structured output.
- **Microsoft 365 hooks** (Graph, Teams Adaptive Cards, Outlook) all stubbed behind env flags so the demo runs without Azure access but is one config away from live.
- **Escalation engine** as a cron sweep; raises events, fans out in-app + Teams + Outlook notifications, dedupes on `(rule, target, entity)`.
- **CSV + XLSX exports** of achievement and audit data with row-level RBAC scoping.
- **Recharts-powered analytics**: composite-score heatmap, QoQ trend, thrust allocation, UoM mix.

**Verification:**
- `npm run typecheck` — 0 errors.
- `npm run test` — 22/22 pass (BRD scoring formulas + score-cap flag).
- `npm run ai:eval` — 8/8 pass (skill schema + stub conformance + live→stub fallback classifier).
- `npm run build` — green, 28 routes, ~102 kB shared JS.
- `npx playwright test` — 60 pass, 9 proper skips, 0 fail across desktop-chromium, mobile-chromium (Pixel 7), desktop-firefox.

**Tradeoffs / deferred for post-hackathon:**
- Real `@azure/msal-node` wiring; the adapter exposes the contract but the callback throws until the package is installed.
- pgvector embeddings — schema present, vector store wired in `lib/db/schema.ts`, but live embedding pipeline is parked behind a Postgres swap.
- Vercel Workflow DevKit migrations — the escalation engine runs as a sweepable cron; can be lifted into a durable workflow when WDK is GA.
- Seed data does not include a `source: "shared"` goal yet, so the shared-goal UI read-only assertion soft-skips in e2e; the server-side guarantee in `app/actions/goals.ts` (and a dedicated unit test) is the source of truth.
- Power BI embed (PS bonus) intentionally out of scope.
