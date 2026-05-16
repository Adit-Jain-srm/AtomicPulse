# RBAC Matrix — AtomicPulse

## Roles
- **Employee** — owns own data only.
- **Manager (L1)** — reads + acts on direct reports' data; cannot escalate to skip-level reports without admin grant.
- **Admin / HR** — org-wide read/write; only role that can unlock or delete.

## Scope tokens
- `self` — `resource.ownerId === session.userId`
- `report` — `resource.ownerId IN reportsOf(session.userId)`
- `org` — `resource.orgId === session.orgId`

## Action matrix (✓ = allowed, ✗ = denied, scope listed)

| Action | Employee | Manager | Admin |
|---|---|---|---|
| `cycle.create` | ✗ | ✗ | ✓ org |
| `cycle.update` | ✗ | ✗ | ✓ org |
| `cycle.list` | ✓ org (read-only) | ✓ org | ✓ org |
| `thrustArea.crud` | ✗ | ✗ | ✓ org |
| `goalSheet.create` | ✓ self | ✗ | ✓ org |
| `goalSheet.read` | ✓ self | ✓ report + self | ✓ org |
| `goalSheet.update` (draft) | ✓ self | ✗ | ✓ org |
| `goalSheet.submit` | ✓ self | ✗ | ✗ |
| `goalSheet.review.edit` (in_review) | ✗ | ✓ report | ✓ org |
| `goalSheet.return` | ✗ | ✓ report | ✓ org |
| `goalSheet.approve` | ✗ | ✓ report | ✓ org |
| `goalSheet.unlock` | ✗ | ✗ | ✓ org |
| `goalSheet.reopen` | ✗ | ✗ | ✓ org |
| `sharedGoal.push` | ✗ | ✓ report (only to own reports) | ✓ org |
| `sharedGoal.subscribe` | ✓ self | ✓ report | ✓ org |
| `checkIn.submit` | ✓ self | ✗ | ✗ |
| `checkIn.manager.acknowledge` | ✗ | ✓ report | ✓ org |
| `audit.read` | ✓ self (own entity) | ✓ report | ✓ org |
| `export.generate` | ✓ self | ✓ report | ✓ org |
| `analytics.read` | ✓ self | ✓ report | ✓ org |
| `escalationRule.crud` | ✗ | ✗ | ✓ org |
| `notification.read` | ✓ self | ✓ self | ✓ self |
| `copilot.invoke` | ✓ self-scope context | ✓ report-scope | ✓ org-scope |
| `graph.sync` | ✗ | ✗ | ✓ org |

## Enforcement
- All server actions go through `lib/rbac/guards.ts → requirePermission(session, action, ref)`.
- `ref` is a typed object: `{ orgId, ownerId? sheetId? goalId? }`. Guard loads the ref's `ownerId`/`orgId` if not provided.
- Every guard failure returns `{ ok:false, error:{ code:'forbidden', message } }` — never throws into render.
- A test matrix in `lib/rbac/guards.test.ts` iterates roles × actions and asserts pass/fail.

## RBAC + AI
Copilot context is loaded via the **same** RBAC-scoped queries used by the UI. There is no privileged AI bypass — semantic search ranks across only the documents the user can read. This prevents prompt-injection from leaking other users' goals.
