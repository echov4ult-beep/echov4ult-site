# UGC Command

Self-hosted UGC growth command center for echov4ult. It is a standalone localhost application and does not modify or serve the public GitHub Pages site.

## Run

Requires Node.js 24 or newer.

```bash
cd ugc-command
cp .env.example .env
npm install
npm run seed
npm run dev
```

Open `http://127.0.0.1:4310`. The default configuration is mock mode, `MANUAL_APPROVAL`, and `COLD_START`. `npm test` runs all unit and end-to-end mock tests. `npm run typecheck` checks strict TypeScript.

## Architecture

```text
localhost dashboard
       |
Node HTTP server + real action routes
       |
SCOUT concept selection -> VANTAGE gates/scoring/approval -> durable jobs
       |                                                    |
       +---------------- SQLite ----------------------------+
                                                            |
                              integration interfaces (mock / capability-blocked real)
```

One process owns the server and bounded scheduler. SQLite runs in WAL mode with foreign keys. Every decision stores a concise summary and evidence; raw chain-of-thought is never requested or stored.

## Environment variable names

- `PORT`, `UGC_DATABASE_PATH`, `UGC_MOCK_MODE`, `UGC_SCHEDULER_INTERVAL_MS`
- `UGC_ENCRYPTION_KEY`
- `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`
- `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_BASE_URL`
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_REFRESH_TOKEN`
- `TIKTOK_PUBLISH_ENABLED`, `TIKTOK_ANALYTICS_ENABLED`

Never commit `.env`. Secrets are neither rendered nor logged.

## What is real

- Durable schema/migrations and idempotent seed data.
- Editable settings, product/evidence records, visible 17-dimension opportunity score, experiments, bounded information-value concept selection, and 17-dimension candidate scoring.
- Experience-claim firewall, factual evidence mapping, affiliate/disclosure hard gate, AI-slop penalties, skip reasons, human approval, lifecycle caps, publishing modes, and an emergency stop that disables pending jobs without deleting data.
- Server-rendered mission-control dashboard with working Generate, Preview, Approve, Reject, Hold, Publish Now, publishing-mode, and emergency-stop actions.
- Job runner, activity audit trail, explicit unavailable metrics, experiment tags, pattern-memory schema/dispositions, money status separation, and affiliate routing validation.
- Mock adapters are deterministic and labeled as mock. They exercise the same pipeline without claiming any external action occurred.

## What is mocked or capability-blocked

- **Higgsfield:** no stable approved HTTP API contract or credentials were supplied. Required: base URL, auth scheme, image/brief request schema, job/status schema, output URL and usage rights. Non-mock mode fails explicitly.
- **TikTok publishing:** the existing `_worker` only uses OAuth and the read-only Display API. Direct Post needs an approved Content Posting API application, `video.publish`, current creator-info and consent UX, public-post eligibility, token refresh/storage, upload/init and status endpoints, and a verified TikTok audit decision. Keys alone do not unlock it; non-mock mode fails closed. Until approval, the safe live workflow is a human-reviewed posting package and manual upload.
- **Analytics:** the existing Display API can supply video view/like/comment/share counts after a real account connection. Saves, watch time/completion, profile visits, clicks, conversions, revenue, RPM, and follower gain need other verified sources and remain `null` with an availability reason.
- **LLM:** mock reasoning is deterministic. A live provider needs its key, model, structured-output endpoint, and an approved retention policy.
- **Commerce:** routing/validation is real. Program clicks, orders, revenue, and commission require APIs or imports. `ESTIMATED`, `PENDING`, and `CONFIRMED` remain separate. The system never enrolls, signs agreements, or buys products.
- **Trending audio:** the schema can retain selected sound metadata, but no source or licensing workflow was supplied. Nothing is auto-attached.

## Safety and compliance invariants

- An `UNVERIFIED` product cannot use experiential language. Every factual claim must reference a source row.
- Monetized captions begin with `#ad` or `(ad)`. When program rules require it, `#advertisement` must be in the first overlay. Amazon uses a raw tagged Amazon URL, never `/go/`.
- A skipped post beats a bad post. Hard-gate failures cannot be overridden by autonomous mode.
- Emergency stop is checked immediately before transport. It deletes nothing.
- Empty dashboard sections say “No data yet”; mock analytics never manufacture engagement.

See [`docs/PLAN.md`](docs/PLAN.md) for the audited implementation plan.
