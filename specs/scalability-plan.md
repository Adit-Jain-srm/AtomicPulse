# Scalability Plan — AtomicPulse

## Profile of load
Goal-management SaaS load is **bursty around cycle events**:
- Cycle open: spike for 1–3 days as everyone drafts.
- Quarter open / close: spike for 1–2 weeks.
- Daily background: low — mostly notifications, dashboards, occasional check-ins.

Architecture targets these spikes without paying for them between events.

## Compute
- **Vercel Fluid Compute** Functions auto-scale to zero between events.
- **Cache Components** + `cacheTag` invalidation means dashboards are read from edge cache; cycle-open spike is mostly cache hits + stale-while-revalidate.
- **AI streaming** is per-user and naturally bounded by per-user rate limits.

## Data
- **Turso libsql** auto-scales at edge; storage grows with cycles + audit log.
- **Read replicas** available if/when needed; current load fits single-primary.
- **Indexes** sized to common query paths:
  - Manager team dashboard: `goal_sheet(manager_id, cycle_id)` index hits.
  - Audit drilldown: `audit_event(entity_id, occurred_at desc)`.
  - Semantic search: pgvector `ivfflat` index.

## Background work
- **Vercel Workflow DevKit** for durable workflows (escalation chains, cycle-open fan-outs, daily reminders). Resumable across deploys; idempotent.
- **Vercel Cron** triggers escalation workflow daily.
- For larger orgs (10k+ users), promote to a dedicated worker by exposing the WDK runtime on a separate Vercel project — code unchanged.

## Caching tiers
1. **Edge cache (Cache Components)**: `cacheLife({ stale: 600, revalidate: 60 })` for dashboards; tag-based invalidation.
2. **Runtime Cache**: rate limit counters, AI prompt cache, semantic-search top-K cache (5min TTL).
3. **In-memory** (per-Function lifetime): Drizzle prepared statements, MSAL token cache.

## Hot paths
- Employee dashboard: 1 RSC call → 1 DB query (sheet + goals + last check-in). Cached. p75 < 150ms.
- Manager team view: 1 RSC call → 2 queries (sheets joined to goals, latest check-ins). Cached per manager. p75 < 200ms.
- Admin completion dashboard: pre-aggregated via materialized view `mv_completion_by_period` refreshed nightly + on cycle close.
- AI streaming: per-user, no shared state, scales linearly.

## Limits we plan for
- Up to **5k users / org**: works on the proposed schema and indexes.
- Up to **50k goals / cycle / org**: works; analytics views materialized.
- Up to **500k audit events / yr**: indexed; cold-store after 1 year via Blob export.

## Beyond hackathon
- Multi-region read replicas (Neon).
- Sharded org partitions (Postgres native partitioning by `org_id`) when single-primary tops out.
- Promote materialized views to a streaming pipeline (Microsoft Fabric event streams) at very large scale.
