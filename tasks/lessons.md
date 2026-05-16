# AtomicPulse — Self-Improvement Log

Format per entry:

```
## YYYY-MM-DD — short title
**Trigger:** What the user said / what went wrong.
**Pattern:** The mistake or anti-pattern.
**Rule:** What I will do differently next time.
**Verification:** How I'll detect a regression.
```

---

## 2026-05-16 — Plan-mode discipline
**Trigger:** Plan-mode active at session start.
**Pattern:** Tendency to start coding immediately on multi-step requests.
**Rule:** For 3+ step / architectural tasks, always draft a plan + ask 1–2 forking questions before any tool use beyond reads.
**Verification:** Plan exists at `.cursor/plans/*.plan.md` before any write tool fires.

## 2026-05-16 — BRD scoring formulas are the highest-correctness surface
**Trigger:** BRD Table 0 defines four UoM scoring formulas; getting any wrong fails the "Adherence to BRD" judging criterion.
**Pattern:** Trusting domain logic without unit tests against the BRD's exact examples.
**Rule:** Every UoM formula has a Vitest case using the BRD's literal description; tests run in CI before any deploy.
**Verification:** `lib/domain/scoring.test.ts` covers `min`, `max`, `timeline`, `zero` with BRD-derived fixtures; `npm test` green.

## 2026-05-16 — `server-only` poisons offline scripts
**Trigger:** `npm run ai:eval` failed because `lib/ai/stub.ts` imported `server-only`, which throws when required from a non-RSC context (incl. tsx scripts).
**Pattern:** Defensively adding `import "server-only"` to every backend module, including pure helpers that have no secrets.
**Rule:** Reserve `server-only` for modules that touch secrets, env-bound clients, or database calls. Pure utility / stub modules stay agnostic so they can be unit-tested in tsx and reused by Workers.
**Verification:** `npm run ai:eval` and `npm test` both succeed without env shims.

## 2026-05-16 — Discriminated unions need explicit narrowing helpers
**Trigger:** `tsc` flagged `data.users` / `data.sheets` as possibly undefined inside the team page even after the `cycle` guard, because `loadDashboardData` returns `{ cycle: null }` plus three role-specific shapes.
**Pattern:** Relying on `redirect()` in a ternary to narrow a 4-way discriminated union — TS does not always carry that through.
**Rule:** When consuming a multi-shape union, narrow once at the top of the function (early return / `if (role === X) redirect`) AND alias the fields you need into local consts so the rest of the file is monomorphic.
**Verification:** `npm run typecheck` clean; future pages adding new role-specific data follow the same pattern.

## 2026-05-17 — Treat live AI calls as best-effort, never blocking
**Trigger:** PS demand for "rigorous testing and robust API fallbacks" plus the very real risk of an Azure quota / latency spike during the hackathon demo.
**Pattern:** Wrapping a single `generateObject` call in try/catch and rethrowing as a 500. One bad request takes the demo offline.
**Rule:** Every live AI call site must carry an `AbortSignal.timeout(8s)` AND fall back to the deterministic stub on any throw or abort, returning `{ ok: true, data, fallback: true }` (never 500). Log a content-free `[ai.fallback] {phase, skill, mode, reason, code}` line — no prompts, no user data, no keys.
**Verification:** `npm run ai:eval` exercises the synthetic-`AbortError` classifier path; manual test sets a bogus `AZURE_OPENAI_API_KEY` and confirms the copilot still streams via stub.

## 2026-05-17 — Shared-goal "read-only" is a server invariant, not a UI invariant
**Trigger:** PS / BRD requires non-owners not to mutate shared-goal title / target / UoM / dates. A subagent audit found the UI hid the inputs, but `saveGoalSheetDraft` would still accept those fields if posted directly.
**Pattern:** Trusting React `disabled` attributes (or hidden form fields) to enforce a domain invariant.
**Rule:** When the UI marks something read-only, the matching server action must look up the existing row, drop the disallowed fields silently, and emit a dedicated audit event (`shared_field_blocked`) so we have evidence of the attempt. Never throw — silent coercion keeps the legitimate edits flowing.
**Verification:** Server-side coercion is tested implicitly via `npm run typecheck` + the `e2e/shared-goals.spec.ts` (UI assertion) + a future post-hackathon unit test that POSTs the form action directly.

## 2026-05-17 — `getByText().first()` is unsafe with hidden mobile drawers
**Trigger:** Playwright `mobile-chromium` failures — every dashboard / analytics test that asserted `getByText(/.../).first()` was pinned to an off-screen sidebar duplicate inside the closed mobile drawer (rendered in DOM, transformed off-screen).
**Pattern:** Writing assertions against the page root when a hidden navigation drawer renders the same labels.
**Rule:** Always scope content assertions to `page.locator("main")` (or another visible-content container) when the layout includes a hidden drawer / off-screen sheet. Mobile-only specs use `test.skip(({ isMobile }) => !isMobile)`; everything else stays viewport-agnostic.
**Verification:** All three Playwright projects (desktop-chromium, mobile-chromium, desktop-firefox) run green; the same suite on a `375 × 812` and a `1280 × 800` shape passes without per-viewport branching.

## 2026-05-17 — SQLite e2e runs need `workers: 1`
**Trigger:** Initial Playwright run at `workers = N` died with `LibsqlError: SQLITE_BUSY` because three parallel specs all tried to `resetDb()` simultaneously.
**Pattern:** Defaulting to Playwright's auto-parallelism on a SQLite-backed app.
**Rule:** When the test DB is single-file SQLite, set `workers: 1` in `playwright.config.ts`. Within-file `test.describe.configure({ mode: "serial" })` is necessary but not sufficient — `fullyParallel: false` only stops parallelism within a file. (When migrating to Postgres, lift this constraint and rely on per-test schemas instead.)
**Verification:** Re-running the full 23-spec suite under `workers: 1` produced zero `SQLITE_BUSY` errors across all three projects.

## 2026-05-16 — Hand-roll shadcn primitives to skip CLI on a fresh repo
**Trigger:** `npx shadcn` requires a configured `components.json` and Tailwind path — fragile when scaffolding under Windows + a non-standard project name.
**Pattern:** Blocking on the CLI in early scaffolding when the components are small enough to inline.
**Rule:** For a hackathon, vendor in the small primitives (Button, Card, Badge, Input, Avatar, Progress, etc.) directly under `components/ui/` using `cva` + `tailwind-merge`. Add the CLI later when an upstream component is large.
**Verification:** Build is green and visual parity with shadcn is achieved without the CLI.
