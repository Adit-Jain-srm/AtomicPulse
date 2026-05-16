# Architecture — AtomicPulse

## High-Level Diagram

```mermaid
flowchart LR
  subgraph Client[Browser]
    UI["Next.js 16 RSC + Cache Components<br/>Tailwind + shadcn + Framer Motion"]
  end

  subgraph Vercel[Vercel Fluid Compute]
    SA[Server Actions]
    RH[Route Handlers]
    WDK["Workflow DevKit<br/>(escalations + cycles)"]
    Cron[Vercel Cron]
    AIG[AI Gateway]
    RC[Runtime Cache]
  end

  subgraph Neon[Neon Postgres + pgvector]
    DB[("goals, check_ins,<br/>shared_goals, audit_log,<br/>cycles, users, orgs, embeddings")]
  end

  subgraph Microsoft[Microsoft Cloud]
    Entra["Entra ID / MSAL"]
    Graph["Microsoft Graph<br/>users + manager chain"]
    Teams["Teams Incoming Webhook<br/>Adaptive Cards"]
    Outlook["Outlook via Graph"]
    AOAI["Azure OpenAI<br/>gpt-4o + embeddings"]
  end

  UI -->|"RSC fetch"| SA
  UI -->|"streaming AI"| RH
  SA --> DB
  RH --> AIG --> AOAI
  WDK --> DB
  WDK --> Teams
  WDK --> Outlook
  Cron --> WDK
  SA --> Graph
  UI -->|"sign-in"| Entra
  SA --> RC
```

## Module Boundaries

```mermaid
flowchart TB
  subgraph App[app/]
    Auth["(auth)/sign-in"]
    Shell["(app)/layout"]
    Dash["(app)/dashboard"]
    Goals["(app)/goals"]
    Check["(app)/check-ins"]
    Team["(app)/team"]
    Shared["(app)/shared-goals"]
    Analytics["(app)/analytics"]
    Copilot["(app)/copilot"]
    Admin["(app)/admin"]
    Api["(app)/api/*"]
  end

  subgraph Lib[lib/]
    Db["db/ schema, queries, migrations"]
    AuthLib["auth/ msal + demo adapter"]
    Rbac["rbac/ guards + matrix"]
    Domain["domain/ scoring, validation, audit"]
    Ai["ai/ skills, prompts, schemas"]
    Notif["notifications/ email + teams + sse"]
    Wf["workflows/ WDK definitions"]
    GraphLib["graph/ Microsoft Graph"]
    Exports["exports/ csv + xlsx"]
    Cache["cache/ tags + lifecycles"]
    Validation["validation/ shared zod"]
  end

  Goals --> Domain
  Goals --> Validation
  Goals --> Db
  Check --> Domain
  Check --> Db
  Copilot --> Ai
  Admin --> Wf
  Admin --> Exports
  Shell --> AuthLib
  Shell --> Rbac
  Api --> Ai
  Api --> Notif
  Wf --> Notif
  Wf --> Db
  Notif --> GraphLib
```

## Request Flow — Goal Submission

```mermaid
sequenceDiagram
  participant U as Employee UI
  participant SA as Server Action
  participant V as Validation (Zod)
  participant D as Domain (state machine)
  participant DB as Postgres
  participant T as Tag Invalidator
  participant W as Workflow DevKit
  participant Mgr as Manager (Teams + Email)

  U->>SA: submitGoalSheet(sheetId)
  SA->>V: parse(input)
  SA->>D: assertCanSubmit(sheet)
  D->>DB: load sheet + goals
  D-->>SA: ok | reason
  SA->>DB: tx [update sheet.status=submitted, audit_event insert]
  SA->>T: updateTag('sheet:'+id), 'team:'+managerId
  SA->>W: trigger goalSubmittedWorkflow(sheetId)
  W->>Mgr: Adaptive Card via Teams + Outlook email
  SA-->>U: { ok:true, data:{ sheetId, status:'submitted' } }
```

## Request Flow — AI "Generate SMART Goal"

```mermaid
sequenceDiagram
  participant U as Goal Editor (client)
  participant RH as /api/copilot/skill
  participant G as Vercel AI Gateway
  participant A as Azure OpenAI
  participant DB as Postgres

  U->>RH: POST { skill:'generateSmartGoal', input:{ thrustAreaId, hint } }
  RH->>DB: load thrust area + role context (RBAC scoped)
  RH->>G: streamObject (model + schema + system prompt)
  G->>A: chat.completions
  A-->>G: token stream
  G-->>RH: parsed Zod object stream
  RH-->>U: SSE stream → live form updates
```

## State Machines

### Goal Sheet
`draft → submitted → in_review → (returned → draft) | (approved → locked) → (reopened → draft)`

Reopen / unlock paths are **admin-only** and always insert `audit_event`.

### Check-in
Per-quarter: `pending → in_progress → submitted_by_employee → acknowledged_by_manager`. After window close, transitions become read-only.

## Caching Strategy
- Reads use `use cache` with `cacheLife({ stale: 600, revalidate: 60 })` and `cacheTag` keyed by entity:
  - `org:<id>`, `user:<id>`, `sheet:<id>`, `team:<managerId>`, `cycle:<id>`, `analytics:<orgId>:<cycleId>`.
- Writes call `updateTag` for every affected key.
- AI Gateway prompt cache reuses for stable system prompts + frozen inputs (e.g. "improve clarity" templates).

## Failure Modes & Fallbacks
- **Neon outage** → 503 on writes, cached reads still serve dashboards.
- **Azure OpenAI rate limit** → AI Gateway routes to fallback model `gpt-4o-mini`; if exhausted, surfaces friendly Copilot toast.
- **Teams/Outlook outage** → workflow logs delivery failure; in-app notification still appears.
- **MSAL outage** → Demo Mode remains usable for any seeded user.

## Multi-Tenant Readiness
Every table that holds business data has `org_id`. Drizzle helpers wrap queries with `eq(table.orgId, session.orgId)`. Single seeded org for the hackathon, but the indexes + scoping make N-tenant trivial later.
