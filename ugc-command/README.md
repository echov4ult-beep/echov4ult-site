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

Permanent Hermes agents are available through `vantage chat` and `scout chat`. Their current canary authority is read-only. Both inspect this application's live database through `npm run agent -- <status|mission|products|candidates|evidence|experiments|findings|activity|money|leads|approvals|projects|production|audit>`; only humans may operate dashboard write, delivery, or publishing controls during the canary.

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

The SQLite backend is the single source of truth for both `CLIENT_UGC` and `AFFILIATE` work. They share research, production, QA, experiments, and reporting infrastructure, but every project and financial entry carries a required business type. A mismatched ledger entry fails closed. Hermes remains the owner-facing approval and pause shell; Echo Vault HQ is not a second copy of the business domain.

## Owner workflow

1. Add a researched prospect, qualify it, and draft a personalized pitch.
2. Approve the pitch in Approval Center. Sending remains manual; record the real send receipt only after outreach and global pauses are cleared.
3. Move the lead through reply, discovery, proposal, and won; then choose a package and create the client project.
4. Complete intake. Missing and contradictory claims block production.
5. Record the agreement, separately quote any non-base usage rights, and create an invoice. Agreement fields are operational records, not legal advice.
6. Confirm a real payment manually using its bank/provider receipt. No payment is inferred from Gumroad or seeded data.
7. Add the production item, attach versions, and record claim, disclosure, and quality checks. Higgsfield remains the generation path, but its current session/MCP workflow is a manual handoff because no approved stable Node API contract is available.
8. Deliver a watermarked draft, record revisions, request final-delivery approval, and release the unwatermarked version only after payment and QA gates pass.
9. Record production minutes and direct costs. The dashboard calculates actual revenue per production hour without substituting views or predicted virality.
10. Prepare the testimonial or repeat-order follow-up and retain the audit and delivery receipt.

Cold start, outreach pause, Higgsfield-generation pause, and global automation pause are enabled by default. Clearing them does not create an external integration or send anything by itself.

## Environment variable names

- `PORT`, `UGC_DATABASE_PATH`, `UGC_MOCK_MODE`, `UGC_SCHEDULER_INTERVAL_MS`
- `UGC_ENCRYPTION_KEY`
- `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`
- `HIGGSFIELD_API_KEY`, `HIGGSFIELD_API_BASE_URL`
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_ACCESS_TOKEN`, `TIKTOK_REFRESH_TOKEN`
- `TIKTOK_PUBLISH_ENABLED`, `TIKTOK_ANALYTICS_ENABLED`

Never commit `.env`. Secrets are neither rendered nor logged.

The server binds to `127.0.0.1`, rejects cross-origin form posts, requires a per-process CSRF token, limits request size, disables browser caching, and sanitizes user-facing database text and errors. It is designed as a single-owner localhost tool; do not expose port 4310 to a network without adding authenticated users and role-based authorization.

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
- **Client payments:** the provider-neutral confirmation interface currently uses the manual adapter. Enter only a payment you verified independently and use the bank/provider receipt as the idempotency key. No invoice is sent and no payment is collected by this application.
- **Trending audio:** the schema can retain selected sound metadata, but no source or licensing workflow was supplied. Nothing is auto-attached.

## Safety and compliance invariants

- An `UNVERIFIED` product cannot use experiential language. Every factual claim must reference a source row.
- Monetized captions begin with `#ad` or `(ad)`. When program rules require it, `#advertisement` must be in the first overlay. Amazon uses a raw tagged Amazon URL, never `/go/`.
- A skipped post beats a bad post. Hard-gate failures cannot be overridden by autonomous mode.
- Emergency stop is checked immediately before transport. It deletes nothing.
- Empty dashboard sections say “No data yet”; mock analytics never manufacture engagement.
- Public portfolio records require either explicit permission or a `SELF_INITIATED` label before they can be made public.
- Unwatermarked final delivery requires owner approval, paid invoices (or a separately approved payment override), and passing claim, disclosure, and quality checks.

See [`docs/PLAN.md`](docs/PLAN.md) for the audited implementation plan.
