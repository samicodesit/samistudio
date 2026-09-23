# Play payment QA record

**Run:** 7 September 2026, 21:48-21:52 UTC (23:48-23:52 Europe/Amsterdam)
**Result:** Passed for one internal-test transaction; no production charge.

## Environment

- Package: `nl.samistudio.doodle`, internal-testing build `0.1.0` / version code 1.
- Device: Play image AVD `Doodle_Play_API_36`, `emulator-5556`.
- Play product: `doodle_credits_10` (10 doodles).

## Verified flow

1. The Play runtime completed Google sign-in. The successful run returned HTTP 204 from `POST /api/auth/google`, followed by HTTP 200 from `/api/account` and `/api/play/config`.
2. The Google Play sheet showed **"Test card, always approves"** and **"This is a test order, you will not be charged."** The product shown was **10 doodles**.
3. Google Play showed **"Payment successful."** Doodle then showed **"10 doodles added."**
4. `POST /api/play/verify` returned HTTP 200. The handoff recorded a pre-purchase balance of 7; a fresh authenticated `/api/account` read returned 17, confirming exactly 10 credits added.
5. A read-only `listPurchases()` check returned zero pending purchases and the account remained at 17. This confirms there was no outstanding purchase to recover; a duplicate-token replay was not performed in this run.

The first sign-in attempt displayed Google's generic `accounts.google.com` 400 malformed-request page after consent. A later attempt completed the same authorized flow successfully; no auth or payment source code was changed.

## Evidence

- Sanitized network record (URLs only, no tokens): `C:\Users\Sami\.codex\doodle-android-preview\oauth-network.log`.
- The record contains the successful `/api/auth/google` 204, `/api/play/config` 200, `/api/play/verify` 200, and subsequent `/api/account` 200 responses.

No app code, deployment, purchase retry, or additional doodle generation was performed for this record.

## Automated release-invariant check — 8 September 2026

The following targeted command passed at 09:11:37 UTC:

```text
npm test -- --run src/lib/billing/credits.test.ts src/lib/billing/play-credits.test.ts src/lib/billing/play-purchase.test.ts src/lib/billing/play-client.test.ts src/lib/billing/play-voids.test.ts src/app/api/play/verify/route.test.ts src/app/api/play/verify/route.integration.test.ts src/lib/billing/checkout.test.ts src/app/api/checkout/confirm/route.test.ts src/app/api/stripe/webhook/route.test.ts
```

Result: **10 test files passed, 84 tests passed**.

The added service test exercises a failed Play consumption followed by a retry and confirms the second attempt does not claim another pack. The added route integration test runs the real `POST` route, `processPlayPurchase`, and `play-credits` functions while mocking only the session, Play publisher, configuration and Redis command replies. It covers a replay returning `granted` then `already_granted`, two requests receiving one grant and one replay result, and a token ledger owned by another account being rejected without consumption. No raw purchase token is logged or included in asserted ledger commands.

The automated run does not execute Redis Lua scripts against a live Redis instance, so it does not independently prove true concurrent atomicity. The real license-test transaction above did not replay its token, interrupt verification for recovery, cancel a purchase, or perform a refund/revocation. Those Play, crash-recovery, refund/revocation and operator-reconciliation checks remain required before public release.

## Isolated Redis atomicity check — 8 September 2026

The following bounded check passed at 09:23:28 UTC:

```text
npm test -- --run src/lib/billing/play-credits.redis.integration.test.ts
```

Result: **1 test file passed, 4 tests passed**.

The harness starts a temporary `redis-server` bound to a dynamically selected loopback port, with a temporary data directory and persistence disabled. It runs the production Play credit Lua scripts through `redis-cli`, flushes only that isolated database between cases, and terminates only its child Redis process afterward. It verified eight concurrent same-token claims produce one grant and a balance of 10, a foreign account cannot claim the token or receive credits, a failed external consumption can be retried without a second grant, and duplicate void processing reverses the pack once without taking the balance below zero. No production Redis instance, purchase token, Play purchase, or refund was used.

This is direct local Redis execution of the ledger scripts and covers their atomic claim/void behavior. It does not verify a live Play refund/revocation event, a process crash between grant and external consumption, or production Redis/network failure behavior.
