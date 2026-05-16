# Microsoft Ecosystem Integration — AtomicPulse

## Entra ID (Azure AD) SSO
- Library: `@azure/msal-node` (server) + `@azure/msal-browser` (client).
- Flow: Authorization Code + PKCE; server exchanges the code, validates `id_token` against Entra JWKS, mints AtomicPulse session cookie.
- App registration:
  - Redirect URIs: `https://<host>/api/auth/callback`, `http://localhost:3000/api/auth/callback`.
  - Scopes: `openid profile email User.Read User.Read.All Directory.Read.All Mail.Send Group.Read.All`.
  - Group → role mapping table in `org` config; default to `employee` if no group match.
- Sign-out: clears local cookie + redirects to Entra `end_session_endpoint`.

## Org Hierarchy Sync (Microsoft Graph)
- Endpoint: `GET /v1.0/users?$select=id,displayName,mail,department,manager&$expand=manager($select=id)`.
- Job: admin-triggered (`Sync now` button) and scheduled WDK workflow (daily 02:00 UTC).
- Upserts `user(entra_oid, email, display_name, manager_id, department)`. Group memberships → role.
- Delta query optional: subscribe to `/users/delta` and persist delta token; cuts payload size 10×.

## Teams Adaptive Cards
- Library: build cards as JSON 1.5 (no extra dep needed); send via incoming webhook URL configured per org / team channel.
- Use cases:
  - Goal submitted → manager DM card with `Approve`, `Return`, `Open in Portal` actions.
  - Goal approved → employee DM "Sheet locked. Good luck this quarter."
  - Check-in reminder → DM card with `Update now` deep-link.
  - Escalation → manager + skip-level + HR (per chain).
- Inbound: `POST /api/integrations/teams/webhook` validates HMAC signature against `TEAMS_WEBHOOK_SECRET`, dispatches to the appropriate server action by `payload.kind`.
- Deep links: signed URLs (`?token=...&exp=...`) so clicking from Teams lands directly on the goal (or reviewer drawer) without a re-auth round trip.

## Outlook (transactional email via Graph)
- Endpoint: `POST /v1.0/users/{from}/sendMail`.
- Templates in `lib/notifications/templates/`:
  - `cycle-open.html`
  - `goal-submitted.html`
  - `goal-approved.html`
  - `goal-returned.html`
  - `checkin-reminder.html`
  - `escalation.html`
- Each email has a "Reply not monitored" footer + a deep-link CTA.

## Optional: Power BI Embed
- Admin Analytics page reserves a slot for an embedded Power BI report. Toggle off if `POWERBI_WORKSPACE_ID` not set.
- Service principal auth for embed token.

## Optional: Azure Monitor / App Insights
- OpenTelemetry exporter to Azure Monitor when `AZURE_MONITOR_CONN_STRING` is set.
- Tracing `next` route handlers and AI calls.

## Configuration matrix

| Feature | Required env vars | Demo Mode behavior |
|---|---|---|
| Entra SSO | `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `AZURE_REDIRECT_URI` | Hidden if not set |
| Graph sync | `AZURE_*` admin consent + `GRAPH_SYNC_ENABLED=true` | Stub returns seeded org |
| Teams cards | `TEAMS_WEBHOOK_URL_DEFAULT` or per-team config | Stubs to in-app notification |
| Outlook mail | `MAIL_FROM_USER_ID` (delegated) or `MAIL_SHARED_MAILBOX` | Stubs to in-app notification |
| AI Gateway | `AI_GATEWAY_API_KEY` | Stubs to deterministic responses |
| Azure OpenAI | (via Gateway) | n/a |
| Power BI | `POWERBI_*` | Section hidden |

This makes the demo runnable with **zero Microsoft credentials**. With creds, every integration switches on automatically.
