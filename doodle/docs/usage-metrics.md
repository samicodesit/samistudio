# Usage counts

From the Doodle directory, read the last seven days with:

```sh
npm run metrics
```

Use `npm run metrics -- 1` for today. The command reads the existing Redis environment in `.env.local`. It does not modify balances, counters or settings. Dates use Europe/Amsterdam, including daylight saving.

Collection begins with this backend deployment. There is no historical backfill. These are observed events, not unique people, installs, first-drawing conversion, revenue or profit. Missing days have zero recorded events; they do not prove zero actual activity before collection started.

- Drawings: a generated image returned with HTTP 200, including an image delivered with an uncertain balance. Rejected or failed requests are excluded. This does not prove the client received or saved the image.
- Purchases: a newly granted ten-credit pack. Ledger replay does not count again. Google test purchases, Stripe test mode and zero-cost Stripe promotions are excluded. A granted pack still counts if Play consumption needs retrying. Refunds do not subtract from this gross pack count; the existing refund job remains separate.
- QA: the owner and dedicated reviewer emails are excluded. Verified QA events register a hash of the existing account or trial identity in `doodle:metrics:qa`, so subsequent events without an email are also excluded. Existing known QA account hashes are seeded before release. Anonymous testing cannot be identified from an email; register its trial hash before a live QA session. Do not claim unknown anonymous traffic is all customers.

Counts are separated by Android and web and retained for 366 days. Operation IDs are hashed for duplicate suppression; raw receipt tokens, account IDs, email, IP, prompts and image content are not stored in metrics. The QA exclusion set retains only hashes of known QA identities.

Production Vercel requests schedule counting after the response, with a 1.5-second storage deadline. Preview and local requests do not schedule counts. Storage or scheduling failures log a fixed warning without user data and do not change image delivery or payment fulfillment. Counts can under-report during an outage. This is operational analytics, not a financial ledger.

The implementation checks Google's `testPurchaseContext` rather than trusting a client test flag. Source verified 1 October 2026: [Google ProductPurchaseV2](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2). Stripe sessions use verified `livemode` and `amount_total`: [Stripe Checkout Session](https://docs.stripe.com/api/checkout/sessions/object).
