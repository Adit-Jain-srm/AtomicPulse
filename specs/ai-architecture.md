# AI Architecture — AtomicPulse

## Goal
AI is **first-class everywhere goals live**, never a separate "AI tab". Suggestions are inline. Risk is a badge. Quarterly summaries write themselves. Copilot is one keystroke.

## Routing & Providers — tri-mode `AI_MODE`

```mermaid
flowchart LR
  caller[Server Action / Route Handler]
  caller --> mode{AI_MODE?}
  mode -- stub --> stub[runStub / stubStream<br/>lib/ai/stub.ts]
  mode -- gateway --> gw[Vercel AI Gateway<br/>aiGateway()(MODELS[kind])]
  mode -- azure --> az[createAzure(resourceName, apiKey, apiVersion)<br/>azureProvider()(AZURE_OPENAI_DEPLOYMENT)]
  gw --> wrap[live-with-fallback<br/>AbortSignal.timeout(8s)]
  az --> wrap
  wrap -- ok --> ret[200 { ok, data }]
  wrap -- timeout/error --> log[logAiFallback { phase, skill, mode, reason, code }]
  log --> stub
  stub --> ret2[200 { ok, data, fallback: true }]
```

| Mode      | Provider                       | Required env                                                                                                  |
|-----------|--------------------------------|---------------------------------------------------------------------------------------------------------------|
| `stub`    | Deterministic in-process stubs | none                                                                                                          |
| `gateway` | Vercel AI Gateway              | `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL`, `AI_MODEL_DEFAULT`, `AI_MODEL_FAST` (legacy `live` aliases here) |
| `azure`   | Direct Azure OpenAI            | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`        |

- **Primary**: `gateway` in production (gateway-side routing + cost dashboards), `azure` for direct BYO Azure OpenAI tenants.
- **Fallback** (always-on, non-stub modes): `live-with-fallback.ts` wraps every call in an 8 s `AbortSignal.timeout`. On timeout, error, or schema mismatch, the wrapper:
  1. emits a content-free `[ai.fallback] { phase, skill, mode, reason, code }` log line — no prompts, no user data, no keys;
  2. invokes the deterministic stub for the same skill (or `stubStream` for `/api/copilot/chat`);
  3. returns `200 { ok: true, data, fallback: true }` so the UX continues seamlessly.
- **Local-dev fallback**: `AI_MODE=stub` runs the entire stack offline — same skill catalog, same Zod schemas, no network.

All keys live in `.env.local` (or Vercel secrets); client code never touches model keys.

## Skill Registry (`lib/ai/skills/`)
Each skill is a typed object:

```ts
type Skill<I, O> = {
  name: string;
  description: string;
  model: 'gpt-4o' | 'gpt-4o-mini';
  temperature: number;
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  buildPrompt: (input: I, ctx: SkillContext) => { system: string; user: string };
  loadContext?: (input: I, session: Session) => Promise<unknown>; // RBAC-scoped
};
```

### Catalog

| Skill | Model | Output kind | Trigger |
|---|---|---|---|
| `generateSmartGoal` | gpt-4o | structured (`{ title, description, uomType, target, weightageBp, kpis[] }`) | "Generate" button on goal editor; `⌘K → Generate goal` |
| `improveGoalClarity` | gpt-4o-mini | structured (`{ rewrite, diff, rationale }`) | Inline "Improve clarity" affordance per goal |
| `suggestKpi` | gpt-4o-mini | structured (`{ kpis: { title, target, uom }[] }`) | Side panel suggestion |
| `summarizeQuarter` | gpt-4o | streaming text + structured highlights | Dashboard "Auto-summary" card |
| `predictCompletionRisk` | gpt-4o-mini | structured (`{ risk:'low'|'med'|'high', signals[], recommendation }`) | Background per goal; surfaces as `RiskBadge` |
| `managerCopilot` | gpt-4o | streaming text (RAG over reports) | Manager copilot panel before 1:1 |
| `goalAlignmentCheck` | gpt-4o-mini | structured (`{ aligned: boolean, gaps[], suggestions[] }`) | On submit, advisory only |
| `semanticSearch` | embeddings + retrieve | array of refs | Command palette `>` mode |

## Streaming
- Free-form text → AI SDK `streamText` over `/api/copilot/chat`, consumed via `useChat`.
- Structured output → AI SDK `streamObject` with the skill's `outputSchema`. Live-renders into the editor as fields populate (the user sees the title appear, then UoM, then target, animated).

## Context Loading (RAG)
`loadContext` queries Postgres with the **same RBAC guards** the UI uses:
- `managerCopilot`: loads each direct report's current sheet + last two check-ins + risk signals.
- `summarizeQuarter`: loads the user's check-ins for the requested period.
- `goalAlignmentCheck`: loads org thrust areas + parent (manager) goals if available.

Top-K vector retrieval via pgvector for `semanticSearch`; `query_embedding ↔ embedding.vector` cosine, `WHERE entity_id IN (rbac_visible_ids)`.

## Embedding pipeline
- On `goal.upsert` and `check_in.upsert`, schedule an embedding job (in-process when small, WDK for batches).
- `content = title + " " + description + " thrust:" + thrustArea.name + " status:" + status + " uom:" + uomType`.
- Skip if `content_hash` matches.

## Prompt hygiene
- System prompts live in `lib/ai/prompts/*.md` (single source) — diff-tracked in PRs.
- All system prompts include role instruction: *"You are an enterprise goal-setting assistant. Be concise, be specific, prefer measurable language. Never invent data outside the provided context."*
- Inputs containing user free-text are wrapped between sentinel markers (`<<USER_INPUT>>...<</USER_INPUT>>`) and the system prompt is told to treat them as data, not instructions.

## Eval Harness
`scripts/ai-eval.ts` runs each skill against a fixture set in `specs/ai-fixtures/`:
- Functional: did the structured output validate against the schema?
- Behavioral: regex / semantic checks per skill (e.g. `generateSmartGoal` output must contain a verb + a measurable noun).
- Cost: tokens-per-skill budget.

CI gate: `npm run ai:eval` must pass before deploy.

## Observability
- AI Gateway dashboard for per-skill latency, error rate, cost.
- Each call tagged with `skill`, `userId` (hashed), `orgId`, `model` for filtering.

## Cost guardrails
- Embedding only on save (debounced 1s on the editor).
- `improveGoalClarity` and `suggestKpi` use `gpt-4o-mini` (default).
- `summarizeQuarter` cached for 1h via Runtime Cache keyed by `(userId, period, lastCheckInUpdatedAt)`.
- Per-user rate limit: 30 AI calls / minute, 500 / day (Runtime Cache counter).

## Privacy & Security
- AI Gateway logs are pseudonymous (user IDs hashed).
- Data sent to AOAI is scoped to the requester's RBAC view — no cross-user data exfil.
- Optional: Azure OpenAI deployment with content filter + abuse monitoring disabled for enterprise privacy (configurable per tenant).
