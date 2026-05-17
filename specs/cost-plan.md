# Cost Plan — AtomicPulse

## Baseline (50 users, 200 goals, 4 quarterly check-ins/yr)

| Component | Service | Plan | Est. monthly |
|---|---|---|---|
| Hosting + Functions | Vercel Pro | Pro | $20 / member |
| DB | Turso (libsql) | Free tier (500M reads/mo) | $0 |
| AI inference | Azure OpenAI via AI Gateway | gpt-4o + 4o-mini + embeddings | $25–$60 |
| Mail/Graph/Teams | Microsoft Graph | Free tier | $0 |
| Observability | Vercel Analytics + Speed Insights | included | $0 |
| Optional Power BI | Premium per user | (off by default) | $0 |
| **Total** | | | **<$120** |

## AI cost levers
- **Model routing** via AI Gateway:
  - `summarizeQuarter`, `managerCopilot`, `generateSmartGoal` → `gpt-4o`.
  - `improveGoalClarity`, `suggestKpi`, `predictCompletionRisk`, `goalAlignmentCheck` → `gpt-4o-mini`.
- **Prompt caching**: stable system prompts cached; 50–80% tokens savings on repeat calls.
- **Embeddings**: only on save with content-hash dedupe; ~$0.10 / 1k goals.
- **Per-user rate limits**: 30 / min, 500 / day, configurable.
- **Stub mode** for previews: zero AI cost when `AI_MODE=stub`.

## Hosting cost levers
- **Cache Components**: dashboards served from edge cache for stale-while-revalidate; reduces Function invocations.
- **Runtime Cache**: avoids hot-path DB reads (rate limit counters, prompt cache).
- **Fluid Compute**: cold-start charges minimized by warm reuse.
- **Static assets**: Tailwind v4 inlines critical CSS; <30KB CSS gzipped.

## DB cost levers
- **Neon branching**: preview environments use ephemeral branches (free).
- **Indexes** carefully chosen — see `db-schema.md`.
- **Compute autoscale** at Neon Launch tier; scales to zero between cycle events.

## Watch list
- AI cost spikes from Copilot abuse → enforce per-user/day cap + admin dashboard panel showing token spend.
- pgvector index growth → re-index quarterly; consider HNSW if Neon supports at scale.
- Vercel Function bandwidth on CSV/XLSX exports → stream and gzip; cap export to 10k rows per request, paginate beyond.

## What we don't pay for (yet)
- No Redis (Runtime Cache covers our needs).
- No managed queue (WDK is enough for this scale).
- No CDN add-on (Vercel edge is built in).
- No external SSO provider (Entra for enterprise, Demo Mode for hackathon).
