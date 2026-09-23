# Play purchase API permission discrepancy — support draft

## Update: permission rejection cleared

Read-only rechecks on September 7, 2026 supersede the HTTP 401 blocker described below. Using the same service account and unchanged app-scoped permissions:

- `2026-09-07T18:05:53.113Z`: Doodle product catalog lookup returned HTTP 200.
- `2026-09-07T18:05:53.620Z`: `purchases.voidedpurchases.list` returned HTTP 200.
- `2026-09-07T18:05:53.790Z`: purchase V2 lookup with an explicitly synthetic non-purchase token returned HTTP 400 `invalid`.
- `2026-09-07T18:05:53.939Z`: legacy purchase lookup with the same synthetic token returned HTTP 400 `invalid`.

No credentials, permissions or production configuration were changed for these checks. The cause of the earlier rejection is not established. These results establish financial read access, not a successful real purchase, credit delivery or refund test. The submitted report below remains historical; no support follow-up was sent as part of this check.

Submitted 7 September 2026 after the owner explicitly approved sending. Play Console confirmed **Ticket submitted**, status **Pending**, case ID pending, created by samicodesit@gmail.com for Doodle. It says replies are sent by email, normally within two business days, with some cases taking longer. Visually inspected the saved case and its text. No additional access or spending requested.

The form allows 1,000 characters, so the report below was condensed to 881 characters while retaining the package/project/service account, scope, successful product lookup, rejected financial endpoints, exact saved permissions, draft-product/internal-release state and question. Topic: Monetization → Managing monetization → Other. No attachments or secrets were sent.

Google's initial automated recommendation claimed account-wide permissions were required. This conflicts with the app-scoped View financial data description that explicitly includes Purchases API access; it was not treated as verified documentation. Selected **No, create support ticket** to obtain clarification. Permissions remain unchanged.

## Subject

Android Publisher purchase APIs return permissionDenied despite active app-scoped billing permissions

## Message

Hello Google Play support,

Our service account can read our app's one-time product through the Android Publisher API, but purchase-related endpoints return HTTP 401 permissionDenied with the same credentials.

- Developer account: 5843530199260119810
- Package: nl.samistudio.doodle
- Google Cloud project: doodle-506308
- Service account: doodle-play-billing@doodle-506308.iam.gserviceaccount.com
- OAuth scope: https://www.googleapis.com/auth/androidpublisher
- Android Publisher API is enabled.
- Play Console shows the service account as Active, with Doodle-only View financial data and Manage orders and subscriptions, plus required read-only app permissions. We reopened the saved permissions to verify them.
- oneTimeProducts.get for doodle_credits_10 returns HTTP 200 and the expected product.
- purchases.voidedpurchases.list returns HTTP 401 permissionDenied.
- A read-only purchase verification probe using a clearly synthetic token also returns permissionDenied; no real purchase has been attempted.
- An internal test release has been published. The one-time product is currently a draft and production billing remains disabled.

Could you confirm why the purchase API permission check rejects this active app-scoped grant, and whether any additional account setup is required? We want to retain app-scoped permissions rather than grant unnecessary account-wide access.

Thank you,
Sami Studio

## Handling

Do not attach service-account JSON, access tokens, signing keys or environment files. The synthetic-token result establishes permission rejection, not successful verification or proof of purchase readiness. Official documentation checked during diagnosis does not establish a first-purchase prerequisite or a guaranteed propagation deadline.

References: https://developers.google.com/android-publisher/getting_started and https://support.google.com/googleplay/android-developer/answer/9844686?hl=en
