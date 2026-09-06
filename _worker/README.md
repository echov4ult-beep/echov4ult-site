# ViralLens TikTok Worker

This Cloudflare Worker handles the server-side TikTok OAuth exchange and read-only Display API calls for `https://echov4ult.com/virallens/`.

Required secrets:

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `SESSION_SECRET` (long random value)

The Worker route is `echov4ult.com/api/virallens/*`. TikTok's registered web redirect URI must be exactly:

`https://echov4ult.com/api/virallens/oauth/callback`

Deploy from this directory with Wrangler after authenticating to the Cloudflare account that controls `echov4ult.com`.

## UGC intake gateway

The same Worker contains the provider-neutral UGC intake gateway under `/api/ugc/*`. It is intentionally inactive until an owner creates and binds a Cloudflare D1 database as `UGC_DB`, applies `migrations/0001_ugc_intake.sql`, and configures these secrets:

- `UGC_CSRF_SECRET` — random value of at least 32 characters
- `UGC_ABUSE_SECRET` — separate random value used to hash rate-limit identifiers
- `UGC_SYNC_SECRET` — separate random value for private administrative and Hermes synchronization requests

The three UGC secrets must be different from one another and from `SESSION_SECRET`. `UGC_PUBLIC_SITE_URL` defines the production site origin and defaults to `https://echov4ult.com`.

`UGC_ALLOWED_ORIGINS` is an optional comma-separated list for explicitly approved non-production origins. Production already allows `UGC_PUBLIC_SITE_URL`; do not use a wildcard.

The edge database is the private ingress and retry queue. The local UGC Command remains the operational system of record after an authenticated consumer acknowledges each outbox event. The queue uses stable idempotency keys, so a consumer must upsert by `idempotency_key` and acknowledge only after its local transaction commits.

Notification records remain in `PREVIEW` state. No email provider is configured and this Worker never claims delivery. Direct file uploads are also disabled; the brief accepts access-controlled asset links until a private object-store and malware-scanning path is approved.

### Owner-approved activation

1. Create the D1 database in the EchoVault Cloudflare account.
2. Add the `[[d1_databases]]` binding with `binding = "UGC_DB"` and the returned database ID to `wrangler.toml`.
3. Apply the migration locally, verify tests, then apply it remotely.
4. Set all three secrets with Wrangler's secret command; never commit their values.
5. Run a local end-to-end submission and outbox-consumer test.
6. Review preview notification copy and approve an email provider, if desired.
7. Deploy only after the owner approves the production change.

Protected admin endpoints support inquiry search/filtering, owner assignment, qualification and approval records, lifecycle status history, secure project-link creation/revocation, submitted-brief export, preview notifications, archiving, and deletion when no project is linked. Raw project tokens are returned once and only their SHA-256 hashes are stored. The browser removes the token from the address bar and sends it in `X-UGC-Project-Token`, keeping it out of routine request URLs and access logs.

### UGC API reference

| Method and path | Authentication | Purpose |
|---|---|---|
| `GET /api/ugc/csrf` | Approved `Origin` | Issue the cookie-and-header CSRF token used by browser mutations. |
| `POST /api/ugc/inquiries` | Approved `Origin`, CSRF, `Idempotency-Key` | Validate and store one public inquiry. |
| `GET/PATCH /api/ugc/projects/current` | `X-UGC-Project-Token`; mutations also use CSRF | Read or save the private brief. A save includes `expectedRevision` from the latest read. |
| `POST /api/ugc/projects/current/complete` | Project token, CSRF | Submit the validated private brief using the latest `expectedRevision`. |
| `GET /api/ugc/admin/inquiries` | `Authorization: Bearer <UGC_SYNC_SECRET>` | Search up to 100 inquiries with optional `status`, `q`, and `owner` filters. |
| `GET/PATCH/DELETE /api/ugc/admin/inquiries/:id` | Admin bearer token | Inspect, update, archive, or delete an eligible inquiry. |
| `POST /api/ugc/admin/projects` | Admin bearer token, `Idempotency-Key` | Create a one-time private project link and accepted-scope snapshot. |
| `GET /api/ugc/admin/projects/:id/brief` | Admin bearer token | Read the submitted brief, conflicts, assets, and VANTAGE packet. |
| `POST /api/ugc/admin/projects/:id/revoke` | Admin bearer token | Revoke active project access. |
| `GET /api/ugc/admin/outbox` and `POST /api/ugc/admin/outbox/ack` | Admin bearer token | Consume at most 50 pending integration events and acknowledge committed IDs. |
| `GET /api/ugc/admin/notifications` | Admin bearer token | Inspect preview-only notification intents. |

All browser mutations use JSON and `X-UGC-CSRF`. See [UGC-OPERATIONS.md](UGC-OPERATIONS.md) for lifecycle, retry, deletion, and current-limit rules; the request/response examples in [`test/ugc.test.mjs`](test/ugc.test.mjs) are the executable contract.
