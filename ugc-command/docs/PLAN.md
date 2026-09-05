# UGC Command implementation plan

> Current-state note — 2026-09-05: the original plan below describes the first build. Migrations v1–v5, the client-revenue workflow, and the durable event/work-queue layer now exist. The active runtime is Hermes (verified live); no OpenClaw executable is installed. Hermes gateway and cron are operational, but the three externally asserted UGC Work schedules are not visible in local Hermes/Codex schedule state, so no duplicates were installed. The remaining Milestone 1 gaps are five complete truthful portfolio formats, 50 verified qualified prospects, and their personalized pitch drafts. See `HYBRID-REVENUE-MAP.md` and `GROWTH-PLAN.md` for the current architecture and plain-English next actions.

## Audit findings

- The repository is a static GitHub Pages site. The new application will live entirely in `ugc-command/`; no public-site pages or assets will be changed.
- `_worker/src/index.js` is the only existing backend. It implements TikTok OAuth with state validation, an encrypted cookie session, and read-only Display API calls for user info and video metrics. UGC Command will reuse its endpoint/field knowledge but keep credentials and sessions in its own encrypted local store.
- There is no database, scheduler, dashboard framework, publishing implementation, or test harness to extend.
- `AFFILIATE.md` is binding. Monetized social captions must begin with `#ad` or `(ad)`, social video must carry `#advertisement` burned in from the start when required by the program, affiliate links must be sponsored, and Amazon links must remain raw tagged Amazon URLs rather than `/go/` redirects.

## Architecture

One Node.js + TypeScript process:

```text
Browser dashboard -> HTTP routes/actions -> application services -> SQLite
                                              |       |
                                              |       +-> scheduler loop
                                              +-> integration interfaces
                                                   (mock or explicitly enabled real adapter)
```

- `src/server`: server-rendered dashboard, JSON API, and action endpoints.
- `src/db`: SQLite connection, ordered migrations, repositories, and seed command.
- `src/domain`: enums, policy gates, scoring engines, skip logic, baseline classification, and experiment selection.
- `src/services`: SCOUT, VANTAGE, pipeline orchestration, scheduler, learning loop, and audit logging.
- `src/integrations`: interfaces and safe mock implementations. Real adapters are enabled only by explicit environment flags and fail closed when configuration is incomplete.
- `src/jobs`: bounded polling loop for due publishing and analytics jobs; no recursive or unbounded generation.
- `tests`: unit policy/score tests plus a temporary-database mock pipeline integration test.

## Data model

SQLite tables required by the brief:

- `products`, `affiliate_programs`, `product_evidence`
- `content_ideas`, `creative_candidates`, `published_posts`
- `performance_snapshots`, `experiments`, `agent_findings`
- `compliance_checks`, `publishing_jobs`, `agent_activity`, `settings`

Structured score dimensions, candidate attributes, decision evidence, and unavailable metric fields are stored as JSON alongside queryable status/total columns. Foreign keys, status checks, unique idempotency keys, and timestamps protect pipeline integrity. Schema migrations are versioned and transactional.

## Policy and execution order

1. Claim firewall validates every experiential phrase and every factual claim/evidence mapping.
2. Disclosure gate validates caption placement, burned-in disclosure, and affiliate routing.
3. Candidate scoring applies quality dimensions plus AI-slop, repetition, claim-risk, and ad-like penalties.
4. Skip logic prefers a recorded skip over a low-quality or noncompliant publish.
5. Publishing policy enforces mode, explicit approval, lifecycle caps, due time, and the global emergency stop immediately before adapter invocation.
6. TikTok publisher idempotency prevents duplicate submissions after retries.

## Real versus mocked

Works locally without external keys:

- SQLite persistence and migrations; seed data; opportunity/candidate scoring; claim, disclosure, skip, lifecycle, mode, and kill-switch gates; concept generation and information-value selection; scheduling; dashboard actions; findings/baselines; money aggregation; mock video generation, publishing, analytics, and affiliate-link validation.

Interfaces with honest mocks until credentials and approved APIs are supplied:

- Higgsfield generation: needs the vendor's approved API base URL, authentication scheme, image input contract, generation request fields, job polling fields, and output URL/license terms.
- TikTok publishing: needs a reviewed TikTok Content Posting API app, approved scopes, OAuth token storage/refresh, creator-info checks, upload/init fields, publish-status polling, and platform audit requirements. The existing Worker does not provide posting access.
- TikTok analytics: Display API metrics are implemented as an explicitly enabled read-only adapter contract; account-level watch time, saves, clicks, conversions, revenue, RPM, profile visits, and follower gain remain unavailable unless a verified source supplies them.
- LLM reasoning: deterministic local generator is the mock. A real provider requires an API key, model name, endpoint, structured-output contract, and a data-retention decision. Raw reasoning is never stored.
- Affiliate commerce data: link validation/routing works locally. Click/order/revenue/commission ingestion requires program exports or APIs; program enrollment and agreements stay human-only.

## Verification

- `npm test` runs policy/scoring tests and a full mock-mode pipeline against a temporary SQLite database.
- `npm run seed` is idempotent.
- `npm run dev` starts the dashboard and scheduler in one process.
- A final smoke test will start the server, exercise health/API/action routes, run one mock candidate through approval and publish, then confirm stored activity and metrics.
