# Google Play purchase integration

## Controlled internal-test state — September 7, 2026

Production alias `https://doodle.samistudio.nl` now runs deployment `C6wvJWTtzHVZaEPNp419ADGVhfDu` with `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `PLAY_ACCOUNT_LINK_SECRET` and `PLAY_BILLING_ENABLED=true`, deployed by the coordinating agent for the owner-only internal license test. The owner is configured as a Play license tester; public Play distribution is not enabled. This supersedes historical disabled-configuration notes below; successful purchase delivery remains unverified.

Direct Publisher lookup at `2026-09-07T18:09:49.301Z` confirmed `doodle_credits_10` / `ten-doodles` ACTIVE, Netherlands EUR 4.99 and United States USD 5.99, both AVAILABLE. The local private environment parses successfully through the actual `getPlayBillingConfig()` implementation, including credential JSON and account-link-secret validation. This local check does not independently prove the deployed secret values; an authenticated configuration response is still required.

Unauthenticated production probes at `2026-09-07T18:11:58.389574Z` (`GET /api/play/config`) and `18:11:58.735493Z` (`POST /api/play/verify`, valid same-origin header, synthetic token) both returned HTTP 401 `unauthorized` with `Cache-Control: no-store`. No purchase or credit grant occurred.

### Minimal real license-test sequence

1. Install through the owner-only Play internal-test link using the configured license-tester Google account. Open the installed app, sign into Doodle, record the actual starting credit balance, and confirm the authenticated configuration/catalog load.
2. Tap the pack purchase button from a fresh user gesture. Check the actual catalog price and that the Google sheet offers a test payment instrument. Cancel if it instead proposes a real card charge. Complete one license-test purchase using Google's approving test instrument.
3. Verify the server-confirmed result increases the recorded balance by exactly ten and that the UI refreshes. Preserve the real purchase token only in private diagnostic storage if needed; never place it in logs, docs, screenshots or chat.
4. Replay that same actual token once through the authenticated verify endpoint: expect `already_granted` and the unchanged balance, not another ten credits. Restart the app and confirm the balance persists; opening purchase recovery must not duplicate the grant.
5. For genuine unfinished-purchase recovery, a separate controlled test must interrupt connectivity before server verification, then reopen the app online and verify that recovery adds ten exactly once. Do not represent a normal restart after a consumed purchase as proof of interrupted-purchase recovery.
6. Cancel a purchase sheet and check the balance is unchanged. Perform a test refund with revocation and exercise the reconciliation tool before public rollout. Daily reconciliation and failure monitoring also remain required.

No fake credit allocation or real-card payment is part of this test plan.

## Current API access evidence — September 7, 2026

The prior HTTP 401 permission blocker has cleared without broadening the service account's app-scoped permissions. At `2026-09-07T18:05:53.113Z`, product lookup returned HTTP 200; at `18:05:53.620Z`, voided-purchases lookup returned HTTP 200. Purchase V2 and legacy lookups with an explicitly synthetic token returned HTTP 400 `invalid` at `18:05:53.790Z` and `18:05:53.939Z`, respectively. The cause of the earlier failure remains unproven. These read-only checks do not constitute a real payment, consumption, credit-delivery or refund test. See `docs/play-api-support-draft.md` for the historical support report.

The current backend has a global `PLAY_BILLING_ENABLED` switch, credential validation and authenticated account binding; it has no tester-account allowlist. Internal-only distribution and Google Play license-tester configuration must therefore be verified before enabling the switch for an internal purchase test. Select only Google's license-test payment instrument, with no real charge. Server credentials require `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` and the stable `PLAY_ACCOUNT_LINK_SECRET`, alongside existing session and KV configuration. Enabling the switch is not evidence that public payments are ready.

Implement the existing Android release plan using the existing ten-credit product model. The owner authorized building/publishing the Android app and prefers a small, fast implementation. Do not enable purchases or claim release readiness without real Play test transactions.

## Contract

Permission grant completed September 7 after owner explicitly said “I permit the access.” Invited the dedicated billing service account with Doodle-only View financial data, Manage orders and subscriptions, and the automatically required app/quality read permissions. Console shows the account Active, verified through accessibility state and rendered screenshot. No admin, publishing or other-app permissions granted. API connectivity verification follows separately.

Latest Console state, September 7: internal release v1 published at 18:45 local time; owner-only email list saved and track now Active. Opt-in URL: https://play.google.com/apps/internaltest/4701262981282017852 . This is not the closed test or public release. Product remains draft; all 33 displayed EUR region prices corrected to EUR 4.99 and Console confirmed changes saved. Non-EUR prices retain Google's conversion. Android Publisher API enabled in project doodle-506308; dedicated service account `doodle-play-billing@doodle-506308.iam.gserviceaccount.com` created with no project-wide roles. Its private local credentials are outside the repository. Play app-only permission form is prepared for financial/order access plus required read-only app permissions, awaiting explicit user approval. No grant or purchase test claimed yet.

Product draft created and visually verified in Console: `doodle_credits_10`, name **10 doodles**, description **Create 10 more AI doodles. A one-time credit pack, with no subscription.** Purchase option `ten-doodles`, Buy, backwards compatible, draft across 173 regions. Google's bulk EUR 4.99 conversion yielded Netherlands EUR 5.99; explicitly corrected Netherlands to EUR 4.99 and visually checked before saving. Other regions retain Google's generated prices (for example US USD 5.99); review euro-region consistency before activation. No product activation or real/test payment is claimed.

Console upload prerequisite completed September 7: uploaded the verified signed version-1 AAB (SHA-256 `f7addf03b0e51394312e7c30a9b4d586a55205ea37a080c929d7f563f09314f5`) to internal track `4701262981282017852`, release draft 1. Console accepted version 1 (0.1.0), API 23+, target 36; saved draft confirmed. No rollout yet. This unlocked the one-time product creation form.

- Fixed package `nl.samistudio.doodle`, consumable SKU `doodle_credits_10`, ten credits, quantity one.
- Web keeps Stripe. Android launches with an explicit Play runtime marker; Digital Goods and Payment Request provide catalog price and purchase UI. API/config failure in this runtime must not reveal Stripe checkout.
- `GET /api/play/config`: authenticated, no-store; returns enabled/productId/obfuscatedAccountId. Disabled or unconfigured returns 503. Server env: `PLAY_BILLING_ENABLED`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `PLAY_ACCOUNT_LINK_SECRET`, existing KV and session variables. No secrets in client responses.
- `POST /api/play/verify`: authenticated, same-origin, bounded JSON `{purchaseToken,productId}`. Google Publisher API verifies fixed package/SKU, PURCHASED state, quantity one and exact account binding. Pending/cancelled/foreign/unbound purchases grant nothing.
- Atomic token-hash ledger grants ten credits once to the current active account, preserving all Stripe keys. Consumed tokens require an existing matching ledger. Consume failure after grant is retryable without another grant.
- Responses: `granted`, `already_granted`, or `granted_consume_pending` with authoritative balance; pending purchase 409; invalid 400; unavailable 503. Client refreshes account, recovers unconsumed purchases and never interprets payment-sheet completion alone as credit delivery.
- Show the payment sheet from a fresh user click after authentication/config are ready. Do not auto-launch it after an asynchronous Google sign-in callback.

## Bounded parallel work

- Backend: `src/lib/billing/play-*`, `src/app/api/play/*`, security/idempotency tests. Existing account credit keys remain authoritative; no unneeded billing refactor.
- Web client: `src/lib/billing/play-client*`, purchase-dialog integration and tests. Wrapper runtime marker in existing Android resource/config files.
- Native adapter: stock AndroidBrowserHelper billing1.2.0 ignores obfuscated account IDs. Preserve its licensed source in a local billing module with a narrow parse/validation + BillingFlowParams forwarding patch. Replace the original AAR dependency to avoid duplicate classes. Build the debug artifact.
- Root: integration review, existing web regression checks, mobile/desktop purchase-state checks, and release evidence. No live charges during development.

## Before enabling real purchases

### Console progress — September 7, 2026

Identity gate cleared and app draft `4973301025063263916` was created for `nl.samistudio.doodle`. Console currently blocks monetization until a merchant account is set up. Prepared the existing Netherlands Individual payments profile with public name Sami Studio, website https://samistudio.nl, Computer Software category, support hello@samistudio.nl and statement descriptor SAMI STUDIO. Visually checked all populated fields. The owner explicitly approved the merchant agreements. Submitted successfully and verified the rendered Payments dashboard showing Google Play Apps, zero transactions and no primary payout method. Merchant setup is created; the product is not yet created. The 15% service-fee enrollment is offered but not completed. The ten-credit purchase is a required launch feature, not an optional follow-up.

Google must approve account identity; owner device/phone checks, app creation, Play catalog and merchant/API access must be complete. Configure stable account-link secret, signing and Digital Asset Links, then perform actual license-test purchase/recovery/cancellation on Android. The refund reconciliation tool below must be configured, exercised against real test refunds and run regularly before public release. The personal-account closed test also remains.

Sources: https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing and https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2 . Inspect the exact installed native adapter source as authoritative where older guide snippets differ.
## Integration evidence — 7 September 2026

The client uses Play catalog pricing and preserves a fresh purchase-button gesture. Browser checks cover 320px and 1440px, server verification before success, and unavailable-API behavior. All 22 browser checks pass. An isolated real Redis run verified concurrent duplicate grants, foreign-account rejection, account deletion and consumption retry. The local native adapter has two passing binding tests and builds with Billing Client 8.3.0 without duplicate classes. These are automated and local checks; no actual Play transaction or Android device installation has been performed. Play configuration remains disabled.

## Refund reconciliation

Run from the Doodle directory with a private, ignored environment file containing the Play service account, account-link secret and KV settings. The CLI requires PLAY_BILLING_ENABLED=true in that local environment; this does not enable the deployed app. Never commit credentials or print purchase tokens.

```bash
node --conditions=react-server --env-file=.env.play.local --import tsx scripts/reconcile-play-voids.mts
node --conditions=react-server --env-file=.env.play.local --import tsx scripts/reconcile-play-voids.mts --apply
node --conditions=react-server --env-file=.env.play.local --import tsx scripts/reconcile-play-voids.mts --review
```

The default is a read-only preview covering almost 30 days (one-minute API margin); `--days=7` narrows it. Apply reads Google's authoritative voided-purchases API and writes an idempotent token-hash tombstone. It reverses available credits up to the ten-credit pack, preserves active generation holds, and records any unrecovered amount for manual review. It never creates a negative balance or charges a future purchase for a shortfall. Unknown and deleted-account purchases receive a tombstone without recreating an account. Review lists up to 100 residual records without account IDs or raw tokens. No production credentials, actual refunds or scheduled execution are configured yet.

Before accepting real payments, configure a regular reconciliation run (at least daily with an overlapping window), monitor failures and inspect residual records. Google exposes only a 30-day window, so a longer outage needs investigation. The CLI is operator tooling, not an automatically running refund service. Keep Play purchases disabled until real purchase/refund tests and this operating process are verified.

Validation: 293 unit/integration tests passed with one intentional live-generation test skipped. Real isolated Redis checks covered concurrent grant/void, duplicate refunds, consumption races, unchanged dry-run data, active holds and deleted accounts. API query names were checked against Google's live Discovery document because the prose reference uses conflicting field labels. Official references: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.voidedpurchases/list and https://androidpublisher.googleapis.com/$discovery/rest?version=v3 .
