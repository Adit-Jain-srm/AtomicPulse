# PRD — AtomicPulse

## Vision
An AI-first, enterprise-grade Goal Setting & Tracking Portal that replaces spreadsheet-and-email cycles with a fluid, intelligent, audit-ready workspace. Feels like Linear + Microsoft Loop + Notion + Workday + GitHub Projects with an AI copilot embedded everywhere goals live.

## Personas

### Employee — "Alex"
- Drafts goals at cycle open; aligns them to org thrust areas.
- Updates quarterly progress; needs clarity on what counts as a "good" goal.
- Wants the AI to draft SMART goals, suggest KPIs, and warn when a goal looks too vague or unrealistic.

### Manager (L1) — "Morgan"
- Approves direct-report goal sheets; conducts quarterly check-ins.
- Wants a single-pane team dashboard, AI-prepared check-in briefs, and risk badges before 1:1s.

### Admin / HR — "Priya"
- Configures cycles, thrust areas, and escalation rules.
- Owns audit, exports, completion dashboards, and unlocks of approved sheets.
- Needs trust signals: every change traceable, every export reproducible.

## Jobs To Be Done
- "When the cycle opens, help me write 5–8 strong, weighted goals in under 15 minutes."
- "Before my 1:1, give me a one-paragraph briefing on each report's quarter."
- "Show me which teams are off-track now, not next month."
- "When someone misses a deadline, escalate without me chasing."
- "At appraisal time, hand me a clean export — no spreadsheet stitching."

## Success Metrics
- 100% of BRD Phase 1 + Phase 2 requirements implemented and demonstrable.
- Goal-creation time-to-submit reduced ≥40% with AI assistance vs. blank-form baseline (measured via session telemetry).
- Quarterly check-in completion rate ≥90% before window close (real-time on completion dashboard).
- Audit log completeness: every post-lock mutation captured (SQL revoke on `UPDATE/DELETE` enforces this; verified by smoke test).
- Lighthouse ≥95 on the three role dashboards.
- Submission packet: hosted demo URL + repo + architecture diagram + 3 role logins.

## BRD Requirement Traceability

| BRD § | Requirement | Module | Phase |
|---|---|---|---|
| 2.1 | Goal sheet creation, Thrust Area, UoM, Targets, Weightage | `app/(app)/goals` + `lib/domain/goals` | 2 |
| 2.1 | Total weightage = 100%, min 10%, max 8 | `lib/validation/goal-sheet.ts` (Zod) | 2 |
| 2.1 | Manager L1 approval workflow + lock | `lib/domain/approval.ts` + Approval Drawer | 2 |
| 2.1 | Shared Goals (push + sync) | `shared_goal_link` table + `sharedGoalSyncWorkflow` | 2 |
| 2.2 | Quarterly Actual vs Planned input | `app/(app)/check-ins` | 3 |
| 2.2 | Status: Not Started / On Track / Completed | `goal.status` enum | 3 |
| 2.2 | Manager Check-in module + comment | `check_in.manager_comment` | 3 |
| 2.2 | Computed progress scores per UoM | `lib/domain/scoring.ts` (unit tested) | 3 |
| 2.3 | Quarterly window enforcement | `check_in_window` + window guards | 3 |
| 3 | Three roles, distinct capabilities | `lib/rbac/` | 1 + ongoing |
| 4 | CSV/Excel export | `lib/exports/` + `/api/exports` | 3 |
| 4 | Completion dashboard | `app/(app)/dashboard` (admin) | 3 |
| 4 | Audit trail (post-lock) | `audit_event` insert-only | 2 |
| 5.1 | Entra ID SSO + org sync + group→role | `lib/auth/msal` + `lib/graph` | 1 + 5 |
| 5.2 | Email + Teams notifications + deep-links | `lib/notifications` + WDK workflows | 5 |
| 5.3 | Rule-based escalation chain | `escalation_rule` + `escalationWorkflow` | 5 |
| 5.4 | QoQ trends, heatmaps, distribution, mgr effectiveness | `app/(app)/analytics` | 4 |

## Non-Goals (this hackathon scope)
- Multi-tenant onboarding flow (single seeded org is fine for demo).
- Mobile-native apps (responsive web only).
- Compensation / rating logic (BRD says explicitly tracking-only).
- Custom workflow designer (escalation rules are config-driven, not visual editor).

## UX North Star
Every screen should answer one of three questions instantly:
1. *What do I have to do?* (action queue front and center)
2. *Where am I off-track?* (risk badges + heatmap density)
3. *What does the AI think?* (Copilot is one keystroke — `⌘K` then `>` — never hidden in a menu)
