# UGC Command runbook

## Start and verify

1. `cd /Users/openclawsystem/echov4ult-site/ugc-command`
2. `npm install`
3. `npm run seed`
4. `npm start`
5. Open `http://127.0.0.1:4310/`; health is `http://127.0.0.1:4310/api/health`.

The app binds to localhost and uses `data/ugc-command.db`. VANTAGE and SCOUT-UGC read it through `npm run agent -- <command>`; they do not mutate it. Start their isolated Hermes sessions with `vantage chat` or `scout chat`. Verify Hermes with `hermes status`, `hermes cron list`, and `hermes cron doctor`.

## Pause and recover

- Use the dashboard emergency stop for UGC Command. It blocks new risky actions and blocks pending publishing jobs.
- Use the individual Outreach, Production, Generation, Publishing, Delivery, or All Agents controls for a narrow stop.
- Keep **All automation** paused for controlled launch.
- Run `hermes pause` as well when every Hermes gateway/cron action must stop. The two stops are separate.
- Recovery is manual: investigate the failed or claimed item, confirm no external action already happened, clear only the needed pause, and retry with the same idempotency receipt when safe.
- A stop never auto-resumes outreach, publishing, payment confirmation, or final delivery.

## Process a customer

1. Review the gateway inquiry using the authenticated admin route; copy the qualified facts into UGC Command.
2. Draft the pitch, approve it in Founder Attention, send it manually, and record a unique send receipt.
3. When won, create the project and record the signed agreement. Intake answers do not alter signed rights.
4. Create the deposit invoice and confirm payment manually. Unpause Production only after the deposit is visible in the payment account.
5. Create the production item, attach each version, then record CLAIM, DISCLOSURE, and QUALITY checks for that version.
6. Deliver only a watermarked review draft. Record revisions against the reviewed version.
7. Attach and QA the final version, approve final delivery, confirm all invoices paid, then record the unwatermarked delivery.
8. Prepare testimonial, permission, performance-data, and retainer messages for human review; nothing sends automatically.

## Private intake gateway

The public site is static. The Cloudflare Worker is the provider-neutral server boundary, but it is not production-ready until an owner provisions `UGC_DB`, runs `_worker/migrations/0001_ugc_intake.sql`, sets `UGC_CSRF_SECRET`, `UGC_ABUSE_SECRET`, and `UGC_SYNC_SECRET`, verifies `UGC_PUBLIC_SITE_URL`, and deploys. Use `UGC_ALLOWED_ORIGINS` only for explicitly approved non-production origins. Create private links only through the authenticated admin endpoint. Tokens are displayed once, stored as hashes, expire, and can be revoked. Direct uploads are disabled; accept only approved access-controlled HTTPS asset links.

## Backup and restore

Before every schema/config change, stop UGC Command and copy `data/ugc-command.db`, `data/ugc-command.db-wal`, and `data/ugc-command.db-shm` together into a dated, access-controlled backup folder. A safer online backup may use the SQLite CLI: `sqlite3 data/ugc-command.db ".backup 'backups/ugc-command-YYYYMMDD-HHMM.db'"`. Verify with `sqlite3 backups/<file> "PRAGMA integrity_check;"`; the result must be `ok`.

To restore: stop the app, preserve the current three database files in a dated rollback folder, place the verified backup at `data/ugc-command.db`, remove no evidence until recovery is confirmed, start the app, then check health, schema migrations, projects, payments, and audit events. Restoration has not passed a production drill yet, so backup confirmation remains an owner launch action.

## Credentials, failures, and duplicates

- Rotate Worker secrets with the deployment platform, then update the authorized Hermes consumer. Never put secrets in GitHub Pages JavaScript or ordinary logs.
- Failed work appears in Founder Attention and `npm run agent -- queue`. Worker integration and notification intents remain pending until acknowledged.
- Reuse an idempotency key only for a retry of the same action. Use a new key for a genuinely different send, payment, or delivery.
- Never confirm payment from an email alone. Never deliver private assets through a public URL.
