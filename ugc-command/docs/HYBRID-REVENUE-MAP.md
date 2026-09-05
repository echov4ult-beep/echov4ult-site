# Hybrid UGC revenue implementation map

## Verified architecture — 2026-09-05

- `ugc-command/` is the existing Node.js + TypeScript operations module. It owns a durable SQLite database, migrations, a server-rendered control center, policy/scoring services, a bounded scheduler, provider interfaces, tests, and read-only agent CLI.
- VANTAGE and SCOUT are isolated permanent Hermes profiles. They can read UGC Command during canary but cannot publish, contact prospects, spend money, accept terms, or mutate production records.
- Hermes is the live orchestrator. It already provides a global `hermes pause`, supervised gateway, profile isolation, approvals policy, audit/logging, and durable kanban. Modifying upstream Hermes web code would create an update-conflict fork, so the UGC control center remains an owned module operated by Hermes profiles.
- Higgsfield is real in the owned EchoV4ult/VelvetOwl production workflows and interactive tooling. No stable credentialed Node API contract was found for UGC Command. Reuse stays behind the existing `HiggsfieldClient` boundary with a manual handoff until a verified runtime contract exists.
- TikTok publishing exists in other governed pipelines, but UGC Command has no approved Direct Post capability. Client outreach, publishing, payment, and delivery therefore use recorded manual actions with explicit approvals rather than fake automation.
- The worktree contains unrelated untracked files. They remain untouched.

## Existing pieces to preserve

| Capability | Existing owner | Extension |
|---|---|---|
| Product evidence, opportunity scoring | `products`, `product_evidence`, scoring service | Link products to affiliate or client work without duplicating product records |
| Creative ideas/candidates and QA | current pipeline and compliance checks | Associate work with a required business type and client project |
| Publishing safety | publishing mode, lifecycle, emergency stop | Add outreach, generation, agent, delivery, and global automation pauses |
| Experiments and findings | existing tables/services | Add success metric, observation period, outcome, and decision fields later without replacing records |
| Agent audit | `agent_activity` | Add a general immutable business audit log for human approvals, money, delivery, and communication |
| Public portfolio | `/ugc/` | Populate from permissioned portfolio records; keep current static studies until publishing sync is explicitly implemented |

## Milestone 1 — revenue foundation

Files:

- `src/db.ts`: migrations v2–v3 for offers/add-ons, leads, communications, approvals, clients/projects, intake, production, QA, versions, delivery receipts, follow-ups, and separated financial entries.
- `src/revenue.ts`: validated lifecycle transitions, duplicate detection, lead qualification, pitch approval gate, client conversion, pricing snapshots, and immutable audit events.
- `src/policies.ts`: outreach, cold-start publishing, business-type separation, paid-rights defaults, emergency pause, and output-sanitizer rules.
- `src/dashboard.ts` + `src/server.ts`: command overview, sales pipeline, approval center, client intake, and production board with real form actions and explicit empty states.
- `tests/revenue.test.ts` and `tests/server.test.ts`: full lead → approved pitch → won project → paid delivery → follow-up path, all critical hard gates, and CSRF-protected owner actions.

## Client operations

Extend the same migration/service rather than adding a second subsystem:

- agreement and usage-right snapshots; base packages never include paid ads, perpetual use, raw footage, or exclusivity;
- provider-neutral manual invoices/payments;
- watermarked draft, revisions, client approval, protected final delivery, download record, testimonial and repeat-order prompts;
- portfolio permission/public/featured/sort metadata;
- financial entries keyed by required `CLIENT_UGC | AFFILIATE | PORTFOLIO | EXPERIMENT` business type.

## Controls and truth boundaries

1. Every external action is idempotent and approval-backed.
2. `COLD_START` blocks publishing even when a candidate is approved.
3. Emergency stop or the relevant pause blocks new outreach, production, publishing, generation, delivery, and agent work.
4. Production requires complete intake, an accepted agreement, and the confirmed required deposit. Unwatermarked final delivery requires final approval, version-specific QA, and satisfied payment, unless a separate approved `PAYMENT_OVERRIDE` exists.
5. User-facing agent output is rejected when it contains internal routing, hidden-prompt, scratchpad, chain-of-thought, or raw-tool language.
6. Revenue, expenses, goals, and conversion fields always carry a business type. Clearly labeled test projects are excluded from real dashboard and agent revenue totals.
7. Seeded service packages are configuration, not transactions or claimed sales.

## Manual integrations for the first release

- Outreach: UGC Command produces an approved pitch record; the human sends it and records the timestamp/message ID.
- Agreement: record signed status and rights from the executed agreement; generated language is operational data, not legal advice.
- Payment: record an invoice and manual payment confirmation; a future provider implements the same adapter.
- Production: attach outputs from the existing Higgsfield/video workflow; no replacement generator is added.
- Delivery: record a watermarked draft or permitted final file reference; the app never exposes file bytes publicly.

## First-release acceptance path

The integration tests prove:

```text
lead → qualified → pitch draft → human approval → sent → won
→ package/pricing snapshot → complete intake → agreement/rights
→ invoice + payment → production → watermarked draft → revision
→ client approval → unwatermarked delivery → testimonial/repeat prompt
```

The suite verifies audit coverage and financial separation. Negative tests prove outreach, unsupported claims, cold-start publishing, included paid-ad rights, unpaid final delivery, internal-reasoning leakage, emergency-stop bypass, duplicate actions, paused generation, and cross-site form actions are blocked.

## Durable operation layer — 2026-09-05

- `src/work-queue.ts` claims one eligible item transactionally, leases it to one worker, skips approval-blocked work, honors dependency completion, and rejects stale completion tokens.
- `src/events.ts` records idempotent business events and creates only the necessary next tasks. A final-delivery event creates the eight required retention/case-study follow-ons exactly once.
- Migrations v4–v5 store business events, the 13-class work queue, autonomy policy evidence, executions, error tolerances, and owner-decided promotion requests.
- Selecting `AUTONOMOUS` in the dashboard cannot promote the system. External communication, publishing, delivery, and financial actions remain level 1; research/drafting are capped at level 2. Promotion requires a matching approved owner record plus every evidence gate.
- The dashboard now begins with Founder Attention and the durable queue, while the agent CLI exposes `queue`, `attention`, `events`, and `autonomy` as read-only views.
- Founder Attention consolidates pending decisions, sales replies, unsigned agreements, unpaid invoices, footage/client blockers, final deliverables, and critical queue work. Decisions are recorded in place and any item can be deferred for 24 hours with an audit event.
- Migration v6 adds test-data labeling, version-specific QA, revision scope warnings, production pause state, and attention deferrals.
