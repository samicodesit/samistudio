# Stripe webhook incident: September 21, 2026

## Cause and purchase review

Stripe reported 23 HTTP 500 responses beginning September 18 at 10:00:35 UTC for `https://doodle.samistudio.nl/api/stripe/webhook`.

Review identified four unrelated subscription checkout completion events on the shared Stripe account since September 18. All lacked Doodle's `pack` and `userId` metadata. The endpoint attempted Doodle fulfillment for every checkout completion, so these events deterministically failed the fixed credit-pack validation and returned 500.

The purchase review covered 291 checkout sessions from the preceding 30 days. The only paid Doodle checkout already had its fulfillment recorded in the credit ledger. This review found no unfulfilled paid Doodle purchase in that period.

## Fix

The webhook now dispatches checkout completion and asynchronous payment success events to fulfillment only when the verified event has `metadata.pack === "doodle_10"`. The change is a three-line condition applied after signature verification.

Unrelated checkouts receive HTTP 200 without Doodle fulfillment. Signature validation, fixed-pack validation, purchase idempotency, and HTTP 500 retries for actual Doodle fulfillment failures remain intact. No change was made to unpaid checkout handling.

Changed application files:

- `src/app/api/stripe/webhook/route.ts`
- `src/app/api/stripe/webhook/route.test.ts`

## Verification

- Five regression cases reproduced HTTP 500 before the fix and passed afterward.
- Targeted webhook, checkout, credit ledger, checkout confirmation, and Redis unit tests: 49 passed.
- TypeScript check: passed.
- Independent review verification: 26 tests passed.
- Full suite: 408 passed, one failed, seven skipped. The unrelated `src/lib/i18n.test.ts` failure expects three suggestions where the existing data contains 50. Two Redis integration suites could not start their local listeners because the sandbox returned `EPERM`; their setup hooks timed out (`account-deletion.redis.integration.test.ts` and `play-credits.redis.integration.test.ts`). The full suite is therefore not green.

## Production status

Deployment `dpl_iHkUo2iof2bJYzRxfy5fZ6bZHtbG` reached Ready on September 21, 2026, for [Doodle production](https://doodle.samistudio.nl).

The deployed webhook file hash, `300bc0e82f4859d9564afaa0991ddefd124a8110`, matches the local file. Comparing 177 source, public asset, and configuration entries with the previous release found changes only in the webhook route and its tests.

Live checks confirmed the production page returns HTTP 200. Webhook POST requests with a missing signature return HTTP 400 with `invalid_signature`; an invalid signature also returns HTTP 400.

Actual signed Stripe retry verification remains pending; no successful signed delivery has yet been observed. Automatic approval review blocked a secret-based replay, and explicit user approval is pending. Deployment readiness, unsigned live checks, and local tests do not establish successful live Stripe delivery.
