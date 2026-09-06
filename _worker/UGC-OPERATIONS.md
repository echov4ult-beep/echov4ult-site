# EchoVault UGC intake operations

## Simple operating flow

1. A prospect submits `/ugc/inquiry/`. The gateway stores one `NEW_INQUIRY`, creates a safe audit event, and queues Hermes plus notification intents.
2. A human reviews the inquiry, records qualification notes, and moves it through the approved Hermes lifecycle. Nothing contacts or rejects the prospect automatically.
3. After a proposal is accepted, an authorized operator creates a project link with the accepted scope snapshot. The random link token is shown once; only its hash is stored.
4. The client can save a private draft and submit it for review. Submission queues `PRIVATE_INTAKE_COMPLETED` with `productionBlocked: true`.
5. VANTAGE/Hermes consumes the outbox idempotently, compares the brief with the accepted scope, and prepares its work for human approval. Production stays blocked until payment, information, claims, assets, availability, deadline, compliance, and scope are cleared.

## Status path

`NEW_INQUIRY → QUALIFICATION → RESPONSE_DRAFTED → AWAITING_APPROVAL → CONTACTED → DISCOVERY → PROPOSAL_SENT → WON → INTAKE_SENT → INTAKE_RECEIVED → BRIEF_REVIEW → READY_FOR_PRODUCTION`

`READY_FOR_PRODUCTION` is an explicit human-controlled status. Completing a form never sets it.

## Failure and retry rules

- Public retries with the same idempotency key return the original inquiry.
- Hermes reads only `PENDING` outbox events and acknowledges them only after its local commit.
- Notification intents remain `PREVIEW` until a transactional provider and templates are approved. Failed delivery must increment `attempt_count`, record a non-sensitive error, and remain retryable.
- A lost private link cannot be recovered because the raw token is not stored. Revoke it and issue a replacement.
- Archive linked records; hard deletion is blocked while a project link exists.
- Approved hard deletion removes correlated notification, integration, audit, and status records before the inquiry so personal data is not left in an outbox or event trail.

## Current limits

- No production D1 database or secrets have been provisioned.
- No real email is sent.
- No direct file uploads are accepted. Clients use access-controlled asset links and confirm ownership.
- The outbox adapter is ready, but a live Hermes synchronization cannot be claimed until credentials are configured and the consumer passes an end-to-end test.
