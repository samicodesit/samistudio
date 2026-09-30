# Data safety preparation — 8 September 2026

Prepared from source inspection; **not submitted to Play Console**. Confirm provider/SDK details below before completing the declaration. A privacy-policy description is not proof of actual collection behavior.

## Proposed Play Console matrix (draft)

This matrix is a working proposal, **not submitted**. “Required” means the app needs the data for the described feature or currently mounted measurement; “optional” means collection depends on sign-in, purchase, or a user-selected action. Provider sharing and ephemeral handling still require confirmation.

| Data type | Collection | Ephemeral handling | Current purpose and evidence |
| --- | --- | --- | --- |
| User-generated content | Required for generation; report details are optional | Not established as ephemeral | Scene text is sent for generation; report text and selected attachments support safety review. Provider retention must be confirmed. |
| Email and user IDs | Optional | Not ephemeral while an account or purchase record remains | Google sign-in, account access, credit delivery and fraud prevention. |
| Purchase history | Optional | Not ephemeral; transaction tombstones may remain for legal, tax or fraud reasons | Purchase verification, balances and duplicate-delivery prevention. |
| Device or other IDs | Required | Not ephemeral across all uses | Trial enforcement, rate limiting, security and analytics visitor identity. Retention varies by mechanism. |
| App interactions | Required | Not established as ephemeral | Page views and generation, sharing and download events are currently measured by always-mounted analytics. |
| Approximate location | Required | Not established as ephemeral | Analytics provider metadata may include approximate city, region or country; the app does not request GPS access. |

The current security and deletion evidence is: app and API traffic use HTTPS, and an account-deletion mechanism exists. Account deletion does not automatically erase transaction or support records that may be retained for legal, tax or fraud purposes. The applicable processor relationship for Google’s “sharing” answers remains unconfirmed; do not select those answers from this draft alone.

| Data category | Current evidence and purposes |
| --- | --- |
| Other user-generated content | Scene text is required for generation; optional report text supports safety review. Ordinary generation content is not intentionally stored in the app account database. Report records expire after 30 days. Provider retention means generation should not be declared ephemeral without verified controls. |
| Email and user IDs | Optional Google sign-in supplies email and subject; app UUID and protected account binding support accounts, credit delivery and fraud prevention. Sessions last 30 days. Account mappings persist until deletion. |
| Purchase history | Optional purchase references, token hashes and ledger records support verification, balances and duplicate prevention. Transaction tombstones have no expiry in inspected code; account deletion is not equivalent to deleting every transaction record. Complete payment-card numbers are not received by Doodle. |
| Device or other IDs | Trial browser identity and IP-derived security hash; analytics uses a visitor hash. Purposes include trial enforcement, security and analytics. Trial data can last 365 days; rate-limit counters about two days; analytics visitor session 24 hours. |
| App interactions | Always-mounted analytics records page views and generation/share/download events. Custom events omit prompt, image, email and purchase token. |
| Approximate location | Vercel documents city/region/country metadata; no GPS permission is needed for this analytics-derived category. |
| Images | Optional report attachments upload a generated doodle for safety review, retained for up to 30 days. Downloading a generated image is not access to the user's photo library. |

Service-provider transfers and explicitly user-initiated sharing have specific exceptions under Google's definition of “sharing.” Verify the applicable processor relationship before selecting sharing answers; neither automatically declare every provider transfer shared nor assume all providers qualify.

Remaining evidence gaps: native SDK and BotID provider disclosures and diagnostics, provider agreements/settings, analytics query filtering and aggregate retention. Do not submit guessed answers for these. The user is completing Google sign-in on the test emulator; this audit is independent local work and must not inspect or interrupt that flow.

Sources checked:

- [Google Data safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Vercel Analytics data and retention](https://vercel.com/docs/analytics/privacy-policy)
- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)
- [OpenAI processing agreement](https://openai.com/policies/data-processing-addendum/)

The privacy page has a local clarification of analytics metadata and provider retention. Rendering/release verification is recorded separately when completed.

## Release evidence

- Production deployment `doodle-6hxktu1w1-ahmed-samis-projects-e6ef0336.vercel.app` (aliased to `doodle.samistudio.nl`) passed its Vercel build.
- The live favicon contains the Doodle mark in 16, 32 and 48 pixel frames. The production privacy page was rendered at 360px and 1440px; the consecutive-paragraph spacing rule is 16px in both renders.
- The production analytics `beforeSend` hook was invoked in an isolated headless check with synthetic query and fragment values; it returned the origin/path without them. No actual outbound analytics payload was observed during that check, so payload delivery was not independently verified.

## Remaining unknowns

- On 8 September 2026, the Vercel project Firewall → Rules view showed BotID **Basic** selected and **Deep Analysis** unselected. Source integration is confirmed in `src/instrumentation-client.ts:1-6`, `next.config.ts:1-22`, `src/app/api/generate/route.ts:17,41`, and `src/app/api/checkout/route.ts:5,15`. This resolves the Basic-versus-Deep setting gap; it does not establish provider collection, sharing, diagnostic or retention answers.
- Possible telemetry or diagnostics associated with the Android Billing Library 8.3 dependency are not confirmed.

This record remains a preparation draft and has not been submitted to Play Console.
