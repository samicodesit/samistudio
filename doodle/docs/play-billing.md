# Google Play purchase integration

Implement the existing Android release plan using the existing ten-credit product model. The owner authorized building/publishing the Android app and prefers a small, fast implementation. Do not enable purchases or claim release readiness without real Play test transactions.

## Contract

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

Google must approve account identity; owner device/phone checks, app creation, Play catalog and merchant/API access must be complete. Configure stable account-link secret, signing and Digital Asset Links, then perform actual license-test purchase/recovery/cancellation on Android. Refund/voided-purchase reconciliation remains required before public release; core purchase support alone does not complete that requirement. The personal-account closed test also remains.

Sources: https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing and https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2 . Inspect the exact installed native adapter source as authoritative where older guide snippets differ.
## Integration evidence — 7 September 2026

The client uses Play catalog pricing and preserves a fresh purchase-button gesture. Browser checks cover 320px and 1440px, server verification before success, and unavailable-API behavior. All 22 browser checks pass. An isolated real Redis run verified concurrent duplicate grants, foreign-account rejection, account deletion and consumption retry. The local native adapter has two passing binding tests and builds with Billing Client 8.3.0 without duplicate classes. These are automated and local checks; no actual Play transaction or Android device installation has been performed. Play configuration remains disabled.
