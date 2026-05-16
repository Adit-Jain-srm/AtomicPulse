# API Contract — AtomicPulse

Two surfaces:
1. **Server Actions** (preferred) — typed, called from RSC/Client components.
2. **Route Handlers** — only for AI streaming, webhooks, and download endpoints.

All inputs Zod-validated. All responses follow the discriminated union:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fields?: Record<string, string> } };

type ErrorCode =
  | 'unauthenticated' | 'forbidden' | 'not_found'
  | 'validation' | 'conflict' | 'rate_limited'
  | 'internal' | 'integration_failed' | 'window_closed';
```

## Server Actions (signatures)

### Goal Sheet
```ts
createGoalSheet({ cycleId }): ActionResult<{ sheetId }>
updateGoalSheet({ sheetId, goals: GoalDraft[] }): ActionResult<{ sheetId }>
submitGoalSheet({ sheetId }): ActionResult<{ sheetId, status:'submitted' }>

managerInlineEdit({ sheetId, goalId, patch }): ActionResult<{ goalId }>     // manager-only
returnGoalSheet({ sheetId, comment }): ActionResult<{ sheetId, status:'returned' }>
approveGoalSheet({ sheetId, comment? }): ActionResult<{ sheetId, status:'locked' }>
unlockGoalSheet({ sheetId, reason }): ActionResult<{ sheetId, status:'reopened' }> // admin-only
```

### Goals
```ts
upsertGoal({ sheetId, goal: GoalDraft }): ActionResult<{ goalId }>
deleteGoal({ goalId }): ActionResult<true>
reorderGoals({ sheetId, ids: string[] }): ActionResult<true>
```

### Shared Goals
```ts
pushSharedGoal({ primaryGoalId, recipientUserIds: string[], note? }): ActionResult<{ linkId }>
adjustSharedWeightage({ goalId, weightageBp }): ActionResult<{ goalId }>
```

### Check-ins
```ts
upsertCheckIn({
  goalId, period, status, actualValue?, completionDate?, employeeNote?
}): ActionResult<{ checkInId, computedScoreBp }>

managerAcknowledgeCheckIn({ checkInId, comment }): ActionResult<{ checkInId }>
```

### Cycles & Windows (admin)
```ts
createCycle({ fyLabel, opensAt, locksAt }): ActionResult<{ cycleId }>
configureWindow({ cycleId, period, opensAt, closesAt }): ActionResult<true>
openCycle({ cycleId }): ActionResult<true>
closeCycle({ cycleId }): ActionResult<true>
```

### Thrust Areas (admin)
```ts
createThrustArea({ name, description?, color? }): ActionResult<{ id }>
updateThrustArea({ id, patch }): ActionResult<true>
deactivateThrustArea({ id }): ActionResult<true>
```

### Escalation (admin)
```ts
createEscalationRule({ trigger, thresholdDays, chain }): ActionResult<{ id }>
updateEscalationRule({ id, patch }): ActionResult<true>
toggleEscalationRule({ id, isActive }): ActionResult<true>
```

### Org (admin)
```ts
syncOrgFromGraph(): ActionResult<{ usersUpserted: number }>
```

### Demo Mode
```ts
switchDemoRole({ userId }): ActionResult<{ session: PublicSession }>     // demo only; gated by env
```

## Route Handlers

### AI streaming
```
POST /api/copilot/chat            → AI SDK useChat protocol (text stream)
POST /api/copilot/skill           → { skill, input } → streamObject (Zod-typed)
GET  /api/copilot/search?q=...    → semantic search, JSON
```

### Exports
```
GET  /api/exports/achievement.csv?cycleId=...        → CSV stream
GET  /api/exports/achievement.xlsx?cycleId=...       → XLSX bytes (admin/manager)
GET  /api/exports/audit.csv?from=...&to=...          → CSV stream (admin)
```

### Notifications
```
GET  /api/notifications/stream    → text/event-stream (SSE)
POST /api/notifications/read      → mark-as-read
```

### Microsoft integrations
```
POST /api/integrations/teams/webhook   → Adaptive Card actions ("Approve", "Return", deep-link)
POST /api/integrations/graph/delta     → Graph delta query receiver (optional)
```

### Health
```
GET  /api/health                  → { ok, db, ai, version, commit }
```

## Idempotency
Mutating actions accept an optional `clientRequestId` (UUID); duplicates are ignored. Used for retry-safe submission and check-in flows.

## Pagination
List actions accept `{ cursor?, limit? (default 50, max 200) }` and return `{ items, nextCursor }`.

## Error envelope examples

```jsonc
{ "ok": false, "error": { "code": "validation", "message": "Weightage must total 100%.", "fields": { "goals": "weightage_sum:9700" } } }
{ "ok": false, "error": { "code": "forbidden", "message": "Only the assigned L1 manager can approve this sheet." } }
{ "ok": false, "error": { "code": "window_closed", "message": "Q1 check-in window closed on 2026-08-31." } }
```
