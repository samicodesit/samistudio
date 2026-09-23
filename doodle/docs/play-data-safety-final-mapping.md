# Play Data safety final mapping

Prepared 8 September 2026 from the current source, deployed privacy policy, the
internal Play payment QA record, and the current official Google/provider
documentation. This is a Console entry worksheet. The top-level Console
answers are already saved as `Yes` for collecting or sharing data, `Yes` for encryption
in transit, and `Yes` for a deletion request mechanism; the data types have not
been entered and this document has not been submitted.

Independent review provenance: a fresh LunaMax `play_disclosure_acceptance`
review returned **APPROVE**, and root accepted that the existing eight aggregate
categories suffice, on 8 September 2026. This review adds no Play data
category.

Google's [Data safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
require data sent off the device by the controlled webview and by libraries or
SDKs to be considered, including pseudonymous identifiers. They define
`Shared` as a transfer to a third party, with a service-provider exception only
when the recipient processes the data on the developer's behalf and under the
developer's instructions. A transfer can still be collected even when it is
not disclosed as shared. Ephemeral processing must also be included in the form,
but is hidden from the public section only when data remains in memory and is
kept no longer than needed for the real-time request.

## Data types to select

Select these eight types. The `Shared` column is intentionally a separate
provider check because Play has no `unknown` option; do not turn a conditional
answer into a submitted answer without the check described below.

| Play category / data type | Collected | Ephemeral? | Required or optional | Purpose(s) to select | Shared field |
| --- | --- | --- | --- | --- | --- |
| App activity / Other user-generated content | Yes | No | Required | App functionality | `No` for the standard OpenAI API, Upstash customer-data storage, and Vercel Pro Customer Data hosting under the DPA. |
| Personal info / Email address | Yes | No | Optional | App functionality; Account management | `No` for Vercel Pro Customer Data hosting under the DPA; no app-to-Google transfer of the email is evidenced in the app path. |
| Personal info / User IDs | Yes | No | Optional | App functionality; Account management; Fraud prevention, security, and compliance | `No` for the user-initiated Google Identity/Play paths, Upstash storage, and Vercel Pro Customer Data hosting under the DPA. The separate web Stripe path is nonblocking for Android. |
| Financial info / Purchase history | Yes | No | Optional | App functionality; Fraud prevention, security, and compliance | `No` for the user-initiated Play purchase and Upstash ledger; hold only for the separate web Stripe path, which is nonblocking for Android. |
| App activity / App interactions | Yes | No | Required | Analytics | `Yes` for Vercel Analytics; sharing purpose `Analytics`. |
| Device or other IDs / Device or other IDs | Yes | No | Required | App functionality; Analytics; Fraud prevention, security, and compliance | `Yes` for Vercel Analytics and observed BotID security signals; sharing purposes `Analytics` and `Fraud prevention, security, and compliance`. |
| Location / Approximate location | Yes | No | Required | Analytics | `Yes` for Vercel Analytics; sharing purpose `Analytics`. |
| App info and performance / Diagnostics | Yes | No | Optional | App functionality; Analytics | `Yes` with Google CCT/Firebase Logging for automatic Play Billing telemetry; no service-provider or user-action exemption assumed. |

### Evidence for the rows

- **Other user-generated content.** The entered scene is normalized and sent in
  the OpenAI image-generation request (`../src/lib/generation/generate-doodle.ts:69`);
  a report can store the reason/details and, only after the explicit checkbox,
  the scene and generated JPEG (`../src/lib/reports/report-schema.ts:18`,
  `../src/components/report-dialog.tsx:49`). Reports have a 30-day Redis TTL
  (`../src/lib/reports/report-store.ts:8`, `../src/lib/reports/report-store.ts:39`).
  The app does not intentionally put ordinary generation prompts or results in
  its account database, but that does not make the OpenAI request ephemeral.
  OpenAI's [current API data-controls page](https://developers.openai.com/api/docs/guides/your-data)
  says image-generation requests have abuse-monitoring retention of up to 30
  days by default. `Other user-generated content` covers the prompt, report
  details, and the generated doodle attachment; the current app does not read a
  user's photo library.
- **Email address and User IDs.** Google credential verification accepts the
  verified `sub` and email (`../src/lib/auth/google.ts:8`), creates a protected
  identity mapping (`../src/lib/auth/accounts.ts:23`), and puts the email and
  internal identifiers into a signed 30-day session (`../src/lib/auth/session.ts:9`,
  `../src/lib/auth/session.ts:27`). Sign-in is optional because the anonymous
  two-doodle path remains usable without an account. The paid account and Play
  purchase binding make the identifiers necessary after sign-in.
- **Purchase history.** The Play path passes an opaque account binding and
  purchase token to the payment service/backend (`../src/lib/billing/play-client.ts:23`,
  `../src/lib/billing/play-client.ts:47`), verifies the fixed product and
  purchase state (`../src/lib/billing/play-purchase.ts:44`), and stores a
  SHA-256 purchase-token hash in the ledger (`../src/lib/billing/play-credits.ts:95`).
  The web path stores a Stripe checkout-session/payment-intent reference
  (`../src/lib/billing/checkout.ts:23`, `../src/lib/billing/checkout.ts:48`).
  The 7 September internal license test delivered exactly ten credits; see
  `docs/play-payment-qa.md`. Doodle does not receive a complete card number, so
  select `Purchase history`, not `User payment info`.
- **Device or other IDs.** The anonymous signed trial cookie can persist for one
  year (`../src/lib/generation/free-allowance.ts:4`, `../src/lib/generation/free-allowance.ts:134`),
  and the rate-limit path stores an HMAC derived from the request IP for about
  two days (`../src/lib/generation/generation-limit.ts:3`,
  `../src/lib/generation/generation-limit.ts:26`). These are pseudonymous
  identifiers used for trial enforcement and security. Vercel Web Analytics
  also identifies visitors with a request hash and discards the visitor session
  after 24 hours; its [official data-point documentation](https://vercel.com/docs/analytics/privacy-policy)
  lists device OS/version, browser/version, device type and geolocation.
  The bounded BotID Basic runtime inventory in
  [`docs/play-data-safety-runtime-evidence.md`](play-data-safety-runtime-evidence.md)
  positively evidences anti-bot, browser, and device security signals in the
  provider challenge assets. Keep these signals within this existing Device or
  other IDs row; no new Play category is needed.
- **App interactions.** Analytics is mounted in the root document
  (`../src/app/root-document.tsx:29`) and the deployed component uses Vercel's
  page-view/event SDK (`../src/components/doodle-analytics.tsx:3`,
  `../src/components/doodle-analytics.tsx:16`). Generation, share, link-copy,
  and download events are emitted by the client (`../src/components/doodle-client.tsx:264`,
  `../src/components/result-actions.tsx:65`). The `beforeSend` hook removes
  query and fragment values (`../src/components/doodle-analytics.tsx:5`), but
  page views and aggregate analytics remain collection. There is no in-app
  analytics opt-out, so `Required` is the defensible user-control answer.
- **Approximate location.** Vercel's official analytics page lists geolocation
  such as country, region, and city in its data points, and Google's [current
  Android data-use guidance](https://developer.android.com/privacy-and-security/declare-data-use)
  says inferred location must be considered. Doodle does not request GPS or
  Android location: the web policy disables geolocation
  (`../next.config.ts:15`) and the manifest declares no location permission.
  The category is therefore approximate location from analytics metadata, not
  precise location from a device permission.

- **Diagnostics.** The shipped Billing 8.3.0 runtime directly builds and sends
  `PLAY_BILLING_LIBRARY` events through CCT. The inspected event builders include
  Billing response/debug/error values, operation results, timings, app/library
  versions, and Android/device/network metadata. The default endpoint is
  `https://firebaselogging.googleapis.com/v0cc/log/batch?format=json_proto3`.
  See the bounded bytecode/AAB inventory in
  [`docs/play-data-safety-runtime-evidence.md`](play-data-safety-runtime-evidence.md).
  This is a concrete automatic transfer to Google, so enter `Collected = Yes`
  and `Shared = Yes`; do not apply the user-initiated purchase exception to
  this automatic telemetry. The app's production Billing calls are reached
  only from the optional authenticated Play purchase/recovery flow:
  `PurchaseDialog` gates `preparePlayPurchase` and `recoverPlayPurchases` on
  Play runtime, an open purchase dialog, and authentication
  (`../src/components/purchase-dialog.tsx:32-59`); `PaymentRequest.show()` and
  the native `PaymentActivity` flow run only after the purchase control is
  selected (`../src/lib/billing/play-client.ts:46-61`,
  `../android/billing/src/main/java/com/google/androidbrowserhelper/playbilling/provider/PaymentActivity.java:86-124`).
  `DelegationService` constructs the wrapper at service startup
  (`../android/app/src/main/java/nl/samistudio/doodle/DelegationService.java:10-14`),
  but no event is sent by that construction alone. `Optional` is therefore the
  app-level required/optional answer. The CCT runtime persists queued events in
  `SQLiteEventStore` and schedules upload work, so this row is `Ephemeral = No`.
  `App functionality` is directly supported by the Billing operation/error
  instrumentation; selecting `Analytics` describes the aggregate diagnostic
  event stream and is an explicit purpose inference from those fields.

All eight rows are **not ephemeral**. Account mappings and balances remain until
deletion; the trial identifier lasts up to one year; reports and included
content last up to 30 days; the purchase ledger has transaction tombstones; and
Vercel/OpenAI retain analytics or abuse-monitoring data beyond the real-time
request. The current privacy policy records these boundaries at
`../src/app/(english)/privacy/page.tsx:20` and `../src/app/(english)/privacy/page.tsx:41`.
The Billing diagnostics queue is also persisted by the packaged transport
runtime before upload: cached `transport-runtime:3.1.8` bytecode shows
`SQLiteEventStore.persist` writing events and `TransportRuntime.send` scheduling
them for upload.

## Release artifact check

The preserved signed release bundle at
`/home/mests/.local/share/doodle-android-tools/releases/doodle-0.1.0-v1-upload-signed.aab`
was inspected as a ZIP. Its `base/manifest/AndroidManifest.xml` is 19,820
bytes. A raw binary/string scan found `android.permission.INTERNET`,
`android.permission.ACCESS_NETWORK_STATE`, and Play Billing declarations, but
no contiguous `com.google.android.gms.permission.AD_ID`,
`android.permission.ACCESS_FINE_LOCATION`, or
`android.permission.ACCESS_COARSE_LOCATION` string. This corroborates the
saved Advertising ID answer (`No`) and the no-GPS-permission conclusion. No
`aapt2`, `bundletool`, or `apkanalyzer` is available in this environment, so
this is supplementary artifact evidence rather than a complete decoded merged
manifest. The local inspected release bundle
`android/app/build/outputs/bundle/release/app-release.aab` and this preserved
uploaded signed bundle contain the same `base/dex/classes.dex`: 1,490,144 bytes,
SHA-256
`48ffd7ac29f82f60baa70d83bfb114e50defd79fba0a52d91a74520e6d8b2e05`.
Therefore the Billing runtime evidence applies to the preserved uploaded
artifact; signing metadata may differ without changing that member. See
[`docs/play-data-safety-runtime-evidence.md`](play-data-safety-runtime-evidence.md)
for the bytecode and transport evidence.
Stripe references elsewhere in this worksheet concern the separate web checkout
only; Stripe is not an Android release declaration blocker.

## Do not select these types on the current evidence

- `Photos`: No. The only image sent by the report flow is the Doodle-generated
  result; the app does not use a photo picker or photo-library permission.
  Treat that attachment as `Other user-generated content`. This is an
  interpretation of Google's `Photos` definition (a user's photos) and the
  actual report payload, not a claim that arbitrary future image uploads would
  be covered.
- `Financial info / User payment info`: No. Doodle receives a purchase token or
  provider transaction references, not a complete card number.
- `Location / Precise location`: No. No GPS or Android location permission is
  present.
- `Personal info / Name`, address, phone number, sensitive personal information;
  messages; videos/audio; calendar/contacts; installed apps; web-browsing
  history; and in-app search history: no collection is evidenced in the
  shipped app path.
The `mailto:` support link and the device share sheet are user-initiated
external actions. They are not in-app collection paths for this form. If a
future in-app support form or arbitrary media picker is added, reassess the
corresponding type.

## Sharing decision register (the Console has no "unknown" answer)

Google's service-provider exception is narrow: the recipient must process data
on behalf of the developer and under the developer's instructions. The current
standard terms resolve the OpenAI API and Upstash storage paths; an absent
repository acceptance record is not, by itself, a missing fact when the
published terms incorporate the DPA by use.

**OpenAI API - enter `Shared = No` for the prompt/result transfer.** The
[current OpenAI Services Agreement](https://openai.com/policies/services-agreement/)
applies to APIs, says that using the Services accepts the Agreement, and limits
Customer Content use to delivering the Services, legal compliance, policy
enforcement, and abuse prevention. Its [current DPA](https://openai.com/policies/data-processing-addendum/)
is incorporated into that Agreement and says OpenAI acts as a processor on the
customer's behalf and processes Customer Data only under documented customer
instructions. That meets Google's service-provider definition for the API
prompt transfer. The condition is concrete: this must be Doodle's ordinary API
organization under the standard Services Agreement; a separately negotiated
contract would supersede this published-term conclusion. The API call in
`../src/lib/generation/generate-doodle.ts:69` is evidence of the API path. The
OpenAI abuse-monitoring retention remains collection and non-ephemeral handling;
it does not change the `Shared` answer.

**Upstash Redis - enter `Shared = No` for Customer Data stored in Redis.** The
[current Upstash Terms](https://upstash.com/trust/terms.pdf) are accepted by
access or use and expressly incorporate the [Upstash DPA](https://upstash.com/trust/dpa.pdf)
and privacy policy. That DPA is binding as part of the Agreement, applies to
Customer Personal Data processed as a processor/service provider, and restricts
processing to the customer's instructions and provision of the service. The
app sends report payloads, account/credit records, and HMAC rate-limit records
to Redis (`../src/lib/redis.ts:7`, `../src/lib/reports/report-store.ts:44`), so
those storage transfers qualify for Google's service-provider exception. The
DPA expressly excludes Upstash's own account administration, service analytics,
and infrastructure-security processing; that separate metadata is not enough
evidence to change the app-payload rows here.

For the other paths, use the following exact checks before entering `Shared`:

1. **Vercel hosting, Analytics, and BotID Basic.** For server-side prompts,
reports, account data, and other Customer Data, enter `Shared = No` for the
Vercel Pro Customer Data hosting path. The current [Vercel DPA](https://vercel.com/legal/dpa)
describes Vercel's processor treatment for Pro Customer Data. The browser worker
observed the Vercel team Billing page showing Pro on 8 September 2026; this is
plan evidence only and does not infer any separately negotiated
contract terms. The service-generated data treatment remains separate.

The [Vercel Analytics documentation](https://vercel.com/docs/analytics/privacy-policy)
says that data
points can contain URL, referrer, filtered query parameters, geolocation, device
OS/version, browser/version, device type, and a request-hash visitor identity
that is discarded after 24 hours. The current [Vercel DPA](https://vercel.com/legal/dpa)
makes service-generated data Vercel-controlled data. Combined with the app's
always-mounted Analytics integration, this supports `Shared = Yes` for
`App interactions`, `Device or other IDs`, and `Approximate location`, with
sharing purpose `Analytics`. This is an inference from the documented transfer
and controller treatment; it does not rely on the anonymous-data exception.
The [BotID documentation](https://vercel.com/docs/botid)
confirms Basic rather than Deep Analysis, but does not provide a method-specific
Play data-type or retention declaration for Basic. The bounded runtime evidence
supports the observed security signals already included in the Device or other
IDs row, with `Shared = Yes` and sharing purpose `Fraud prevention, security,
and compliance`; it adds no new Play category. Exact retention and provider
role remain unknown and are a monitoring note only. This does not change the
current required, non-ephemeral aggregate answer.

2. **Google Identity Services and Google Play Billing.** The app renders the
standard GIS button and does not call the One Tap `prompt()` API
(`../src/components/google-sign-in-button.tsx:118`, `../src/components/google-sign-in-button.tsx:138`).
Google's [official GIS guidance](https://developers.google.com/identity/gsi/web/guides/offerings)
says the button flow must be triggered by a user gesture; its [button guide](https://developers.google.com/identity/gsi/web/guides/display-button)
says that, after the user selects an account and consents, Google shares the
profile JWT with the platform. The app then posts that credential to its own
`/api/auth/google` endpoint. The profile exchange is therefore user-initiated
and expected under Google's Data safety exception, and the direction of the
profile transfer is Google to Doodle. Enter `Shared = No` for the Google
Identity path on the Email address and User IDs rows. This does not suppress
any separately collected, uncharacterized telemetry from the Google script.
For Play, the app's purchase control calls `PaymentRequest.show()` only after
the user selects the purchase button (`../src/components/purchase-dialog.tsx:91`,
`../src/components/purchase-dialog.tsx:137`), passes the SKU and obfuscated
account binding, receives a purchase token, and sends it to the backend for
verification (`../src/lib/billing/play-client.ts:47`, `../src/lib/billing/play-client.ts:75`).
Current [Play Billing guidance](https://developer.android.com/google/play/billing/integrate)
describes launching the purchase flow for the user to accept, displaying the
Play purchase screen, and passing the token to a secure backend. The specific
Play transfer is consequently a user-initiated, expected purchase action under
the Data safety exception. Applying that exception to this flow is an inference
from the documented user action and expected Play purchase. Enter `Shared = No`
for the Play Billing path on User IDs and Purchase history. `listPurchases()`
can restore earlier purchases,
but that reads existing entitlements from Play and does not send Doodle-collected
data to a third party. This user-initiated exception applies to the purchase
token/account-binding transfer only. The Billing library's automatic Diagnostics
telemetry is a separate transfer to Google's CCT/Firebase Logging endpoint;
enter `Shared = Yes` for the Diagnostics row and do not apply an exemption to
that automatic telemetry.

3. **Stripe (web-only, nonblocking for Android).** Stripe's [current DPA](https://stripe.com/legal/dpa) describes
Stripe as both a processor and a controller depending on the processing purpose.
The web checkout sends the account ID and email and the backend receives
transaction references; the Play runtime routes purchases through Google Play.
Confirm the actual Stripe agreement/context before deciding the shared field for
the separate web checkout path. This does not block the Android declaration. The
Upstash Redis storage path is resolved above and is not a remaining blocker.

The immediately enterable shared answers are:

- `No`: the standard OpenAI API prompt/result transfer; Upstash Customer Data
  stored in Redis; the user-initiated Google Identity profile exchange; and the
  user-initiated Google Play purchase transfer.
- `Yes`: Vercel Analytics for `App interactions`, `Device or other IDs`, and
  `Approximate location`, with sharing purpose `Analytics`; observed BotID
  security signals in `Device or other IDs`, with sharing purpose `Fraud
  prevention, security, and compliance`; and Google CCT/Firebase Logging for
  `Diagnostics`, with no exemption assumed.
- `Monitoring`: BotID's exact retention and provider role remain unknown but do
  not change the current Device or other IDs answer. The web-only Stripe path
  remains a separately documented, nonblocking note.

If a provider is confirmed to meet Google's definition, enter `Collected` only
and leave `Shared` unchecked for that row. If a transfer is to an independent
third party, enter `Collected and shared` for the data types it receives. The
user-initiated result share itself is covered by Google's separate user-action
exception and does not turn the analytics event into sharing of the doodle.

## Bounded monitoring note

BotID Basic's exact retention and provider role remain unverified. Deep Analysis
is disabled; Deep Analysis's signal behavior must not be used as a proxy for
Basic. This bounded uncertainty does not block the current eight-row declaration
or alter its required, non-ephemeral Device or other IDs answer.

The separate web Stripe agreement/context remains a nonblocking note for Android;
the Play runtime routes purchases through Google Play. Support mailbox retention
is also not established, but it does not block the current in-app mapping because
support is a user-initiated `mailto:` action; reassess only if the product begins
collecting support messages in-app.

The required security answers remain supported: production requests use HTTPS,
and deletion is available at
`https://doodle.samistudio.nl/delete-account` as well as from the Account menu.
The current eight-row declaration is supported by the recorded evidence. The
Billing Diagnostics row is supported by
the runtime evidence and is no longer a blocker.
