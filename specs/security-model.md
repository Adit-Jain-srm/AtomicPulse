# Security Model — AtomicPulse

## Threat Model (STRIDE)
- **Spoofing**: ensure session can't be forged → signed cookies + Entra-issued tokens validated server-side via JWKS.
- **Tampering**: every state-changing action validated by Zod + RBAC guard + DB constraint.
- **Repudiation**: insert-only `audit_event` with actor, before/after, occurred_at; DB role denies UPDATE/DELETE.
- **Info disclosure**: every query scoped by `org_id` + ownership; AI context loaders use the same guards.
- **DoS**: rate limiting on auth + AI; AI Gateway protects upstream; Vercel WAF.
- **Elevation**: role transitions only via admin; `requirePermission` is the single chokepoint.

## Authentication
- **Entra ID (production)**: MSAL Auth Code Flow + PKCE. ID + access tokens validated server-side; we never trust client claims. App registration scopes: `User.Read`, `User.Read.All` (admin consent), `Directory.Read.All` (admin consent), `Mail.Send` (delegated, optional).
- **Demo Mode**: signed session cookie with `userId` claim, issued by `/api/demo/sign-in` after the user picks a seeded role. Gated by `AUTH_MODE` env (`demo` always allowed in non-production; `both` enables both buttons in production preview).
- Sessions: HTTP-only, `SameSite=Lax`, `Secure` in prod, signed with `SESSION_SECRET` (HMAC-SHA-256). 8h sliding window. Demo cookies clearly labeled in UI.

## Authorization
- All server actions: `withAuth(action)` → `requirePermission(session, actionName, ref)` (see `rbac-matrix.md`).
- Drizzle helpers (`scopedDb(session)`) auto-inject `org_id` filter and ownership checks at the query layer; bypass requires explicit `unsafe()` flag (only in admin-only operations).

## Data protection
- All secrets in Vercel env vars, separated by environment (Development / Preview / Production).
- Nothing sensitive in client bundle. `NEXT_PUBLIC_*` prefix audited in CI.
- DB connection string is short-lived, rotated quarterly.
- Logs scrub PII (email → hash) except for the actor in `audit_event`.

## Audit guarantees
- DB grant for app role: `INSERT, SELECT` on `audit_event`. `UPDATE/DELETE` denied at role level (verified by smoke test).
- All approval / lock / unlock actions write a paired `approval_event` and `audit_event`.
- Audit viewer is read-only; export tagged with generation timestamp + actor.

## Input validation
- Zod schemas on every action input. Numeric fields use integer basis points where money-like math matters.
- File uploads (avatar): MIME sniff + size cap (1 MB) + scanned with [`file-type`] header check.
- AI inputs sanitized as data (sentinel-wrapped in prompt) to mitigate prompt-injection.

## Network
- HSTS preload (set via `next.config.ts` headers).
- CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' 'nonce-…'; connect-src 'self' login.microsoftonline.com graph.microsoft.com *.openai.azure.com *.vercel.app; frame-ancestors 'none';`.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal.
- All third-party scripts pinned with SRI.

## Rate limiting
- Auth: 10 attempts / 5 min / IP.
- AI: 30 calls / min / user, 500 / day / user.
- Mutations: 60 / min / user.
- Implemented via Vercel Runtime Cache atomic counters keyed by `${kind}:${userId}:${windowBucket}`.

## Secrets rotation
- `SESSION_SECRET` rotated on every release; gracefully accepts last value for 24h via `SESSION_SECRET_PREVIOUS`.
- Azure OpenAI keys behind AI Gateway; rotation does not require redeploy.

## Dependency hygiene
- `npm audit` in CI; PR blocked on high/critical.
- Dependabot enabled.
- Monthly review of MSAL + AI SDK + Drizzle versions.

## Compliance posture
Designed for SOC 2 / ISO 27001 readiness:
- Audit logs retained 7 years (Neon backup → cold storage).
- Access reviews supported by `audit.read` per-org.
- DSAR: per-user data export action available to admins.
