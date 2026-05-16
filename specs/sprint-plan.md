# Sprint Plan — AtomicPulse

7 phases, gated by deliverable proof.

## Phase 0 — Specs (markdown only)
**Done when:** every `specs/*.md` reviewed; ER + flow diagrams in `docs/diagrams/`.

## Phase 1 — Foundation
- Scaffold Next.js 16, TS, Tailwind v4, shadcn, Framer Motion, ESLint/Prettier, Vitest, Playwright.
- Wire Drizzle + Postgres (Neon in cloud, local Postgres or SQLite fallback for dev).
- `lib/auth/` unified `Session` interface + `MsalAdapter` + `DemoAdapter`.
- Layout shell (sidebar, topbar, command palette stub, theme switch, role badge).
- Seed: 1 org, 8 thrust areas, 1 cycle, 12 demo users (3 distinguished by role for the switcher).
- Sign-in page with **two equal CTAs**: "Sign in with Microsoft" and "Demo Mode" (then role list).
- **Gate**: both paths land on a role-aware empty dashboard.

## Phase 2 — Goal Lifecycle (BRD §2.1)
- Thrust-area admin CRUD.
- Goal sheet model + state machine + Drizzle migrations.
- Goal editor with `WeightageRing`, `UoMPicker`, drag reorder, optimistic save.
- Validators (=100%, ≥10%, ≤8) — shared Zod between client/server.
- Submit → manager queue.
- Manager review: inline edit, return-for-rework, approve, lock.
- Shared Goals: push primary → multiple recipients; achievement sync.
- `audit_event` insert-only on every post-lock change.
- **Gate**: full employee→manager→approve flow demoable.

## Phase 3 — Check-ins + Reporting (BRD §2.2 + §4)
- Cycle + check-in window enforcement.
- Achievement input UI per UoM type.
- `lib/domain/scoring.ts` + Vitest tests with BRD-literal fixtures.
- Manager check-in module + structured comment.
- Completion dashboard (admin): % employees with check-in submitted; % managers acknowledged.
- Exports: CSV + XLSX for achievement; CSV for audit.
- Audit trail viewer.
- **Gate**: open Q1 → employee submits → manager checks in → export works.

## Phase 4 — AI Copilot + Analytics
- AI Gateway client + skill registry (8 skills).
- Inline `Generate / Improve / Suggest KPI` in goal editor (streamObject).
- Dashboard `summarizeQuarter` card (streamText).
- `predictCompletionRisk` background job + `RiskBadge`.
- `managerCopilot` panel.
- pgvector embeddings on save + `semanticSearch` palette mode.
- Analytics views: heatmap, QoQ trend, thrust/UoM distribution, manager-effectiveness grid.
- **Gate**: every skill streams; AI eval passes.

## Phase 5 — Microsoft + Workflows
- Graph org-hierarchy sync (manual + scheduled).
- Teams Adaptive Cards + inbound webhook.
- Outlook transactional email.
- Vercel Workflow DevKit: `cycleOpenWorkflow`, `reminderWorkflow`, `escalationWorkflow`, `sharedGoalSyncWorkflow`.
- In-app notifications SSE stream + bell.
- **Gate**: a no-action escalation fires end-to-end.

## Phase 6 — Polish + Submission
- Skeletons + error boundaries on every async surface.
- A11y pass: axe zero violations on key pages.
- Lighthouse ≥95.
- Playwright happy-path: employee submit, manager approve, employee check-in, manager ack, export.
- Demo seed: 12 employees, 3 quarters of history.
- README + 60-second setup.
- Architecture diagram exports.
- Deploy to Vercel production.
- **Gate**: hosted URL works; submission packet complete.

## Definition of Done (per phase)
1. All checklist items in `tasks/todo.md` ticked.
2. `npm run lint && npm run typecheck && npm test` pass.
3. Manual smoke documented in `tasks/artifacts/phase-N-smoke.md`.
4. PR opened with phase summary + screenshots/gif.
