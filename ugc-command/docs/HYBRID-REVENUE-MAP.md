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

- `src/db.ts`: migration v2 for offers/add-ons, leads, communications, approvals, clients/projects, intake, production items, and financial entries.
- `src/revenue.ts`: validated lifecycle transitions, duplicate detection, lead qualification, pitch approval gate, client conversion, pricing snapshots, and immutable audit events.
- `src/policies.ts`: outreach, cold-start publishing, business-type separation, paid-rights defaults, emergency pause, and output-sanitizer rules.
- `src/dashboard.ts` + `src/server.ts`: command overview, sales pipeline, approval center, client intake, and production board with real form actions and explicit empty states.
- `tests/revenue.test.ts`: full lead → approved pitch → won project path plus all critical hard gates.

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
3. Emergency stop or the relevant pause blocks new outreach, publishing, generation, delivery, and agent work.
4. Unwatermarked final delivery requires final approval and satisfied payment, unless a separate approved `PAYMENT_OVERRIDE` exists.
5. User-facing agent output is rejected when it contains internal routing, hidden-prompt, scratchpad, chain-of-thought, or raw-tool language.
6. Revenue, expenses, goals, and conversion fields always carry a business type. Views and predicted scores never enter revenue totals.
7. Seeded service packages are configuration, not transactions or claimed sales.

## Manual integrations for the first release

- Outreach: UGC Command produces an approved pitch record; the human sends it and records the timestamp/message ID.
- Agreement: record signed status and rights from the executed agreement; generated language is operational data, not legal advice.
- Payment: record an invoice and manual payment confirmation; a future provider implements the same adapter.
- Production: attach outputs from the existing Higgsfield/video workflow; no replacement generator is added.
- Delivery: record a watermarked draft or permitted final file reference; the app never exposes file bytes publicly.

## First-release acceptance path

One integration test will prove:

```text
lead → qualified → pitch draft → human approval → sent → won
→ package/pricing snapshot → complete intake → agreement/rights
→ invoice + payment → production → watermarked draft → revision
→ client approval → unwatermarked delivery → testimonial/repeat prompt
```

The same test will verify audit coverage and financial separation. Negative tests prove outreach, unsupported claims, cold-start publishing, included paid-ad rights, unpaid final delivery, internal-reasoning leakage, emergency-stop bypass, and duplicate external actions are blocked.
