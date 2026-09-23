# Google Play listing draft

Updated September 7, 2026. English store copy, icon and feature graphic are saved in Play Console as a draft. Internal testing release v1 is published with an owner-only tester list; no public release is published. Purchase API access, billing tests, remaining declarations and final installed-app screenshots still need completion.

## Official API staging checkpoint — September 8, 2026

The September 7 Console save and visual-review notes below are historical Console evidence and remain separate from this API check; this checkpoint does not assert that any Console draft was lost or replaced. Using the existing Android Publisher service account, an ephemeral edit for `nl.samistudio.doodle` was updated and read back successfully without committing or sending it for review. The staged `en-US` listing is **Doodle: Little Drawing Ideas** with the paste-ready short and full descriptions below; the full description uses the product URL `https://doodle.samistudio.nl`.

The same edit contains one icon, one feature graphic and four phone screenshots in this order: Result, Create, Ideas and View larger. API SHA-256 values match the local source files in `store-assets/`. `edits.validate` returned `403 PERMISSION_DENIED` for this service account, so validation remains unconfirmed by API. A protected save attempt with `changesNotSentForReview=true` and `changesInReviewBehavior=ERROR_IF_IN_REVIEW` returned HTTP 400 `INVALID_ARGUMENT`: Google said changes are sent for review automatically and that `changesNotSentForReview` must not be set. After the owner's explicit approval to submit, the staged edit was rechecked successfully and one commit attempt using only `changesInReviewBehavior=ERROR_IF_IN_REVIEW` returned HTTP 403 `PERMISSION_DENIED`; no commit, release or review submission succeeded. The staged edit ID is retained outside the repository in a private task record. The staging result is API evidence only and does not make the listing public.

## Console creation record — September 7, 2026

Google's verification gate cleared and Create app became available. With the owner's explicit approval, accepted the policy/export declarations and Play App Signing terms, then created **Doodle: Simple AI Drawings**, package `nl.samistudio.doodle`, English (United States), App, free download. Console confirmed the package name was available. App ID: `4973301025063263916`. Verified successful creation through both the resulting dashboard accessibility tree and a rendered screenshot. No additional charge, bundle upload or publication occurred. The dashboard still requires app setup and a closed test with 12 opted-in testers for 14 continuous days before production access.

[App dashboard](https://play.google.com/console/u/0/developers/5843530199260119810/app/4973301025063263916/app-dashboard)

## Paste-ready English copy

### App name

```text
Doodle: Little Drawing Ideas
```

### Short description

```text
Turn little moments into doodles to copy onto cards, notes and journals
```

### Full description

```text
A little drawing can make someone's day.

Doodle turns a short description into a simple drawing you can share, save or copy by hand. Describe one small moment, such as a dog in a party hat or two people dancing in the kitchen, and see it become a friendly doodle.

Ideas for everyday kindness
Make a drawing for a greeting card, a lunchbox note, a journal page or a small thank-you. Doodle focuses on simple scenes and clear lines that give you a starting point for your own drawing.

From words to a doodle
• Describe a small scene or choose a suggested idea.
• Open the result for a closer look.
• Download your doodle or share it using the options available on your device.
• Try another version or start a new scene.

Two free doodles to start
Try two doodles without signing in. After that, sign in with Google to buy a pack of 10 more. Credit packs are one-time purchases, not subscriptions. The purchase screen shows the price before you pay. Failed generations do not use a doodle credit.

Results can vary. An internet connection is required to create drawings. You can report a doodle from the result screen and delete your Doodle account from the Account menu or the account-deletion page.

Made by Sami Studio.
Support: hello@samistudio.nl
Website: https://doodle.samistudio.nl
```

Character limits are 30 for name, 80 for short description and 4,000 for full description. [Google's listing fields](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en). The free allowance is attached to the anonymous browser identity; do not advertise a daily reset, unlimited free generation or a free allowance for an existing signed-in paid account.

## Store fields

Ads declaration saved September 7: **No, my app does not contain ads**. Checked app source, package dependencies and Android dependencies for advertising integration; existing product flow has no ads. Console confirmed **Change saved. Send for review in Publishing overview**, and the selected answer plus saved confirmation were visually verified. This declaration has not been sent for review separately.

Console update September 7: Art & Design category saved (pending review). Store support email hello@samistudio.nl and product website https://doodle.samistudio.nl saved and published in Console; confirmation **Change published** and rendered values visually verified. Optional public phone left blank. This does not publish the app or complete the store listing.

| Field | Draft value / status |
| --- | --- |
| Developer display name | Sami Studio (samistudio.nl); personal-account legal operator: Ahmed Sami Ibrahim Mohamed Shata, Netherlands (user-confirmed from Console) |
| Support email | hello@samistudio.nl; mailbox restored and email verified earlier in this task |
| Developer website | https://samistudio.nl |
| Product website | https://doodle.samistudio.nl |
| Privacy policy | https://doodle.samistudio.nl/privacy |
| Account deletion | https://doodle.samistudio.nl/delete-account |
| Package | nl.samistudio.doodle |
| Category | Art & Design saved in Console; tags not selected |
| Monetization | Free download with in-app purchases; no subscription |
| Audience | People making simple personal notes/cards/journal drawings. Do not select children's age groups or claim Families compliance without completing that assessment. Content rating is not yet assigned. |

Local source now uses the confirmed operator/contact details, and the privacy page includes Play purchase processing and Vercel Analytics. Those legal/privacy changes are deployed and all four public policy/contact pages returned HTTP 200 with the verified email on September 7. At the September 7 10:45 UTC Console check, Google was still reviewing the submitted identity documents and phone verification remained dependent on approval. The Android-device task was no longer listed on Home; Create app remained disabled. Confirm the live legal pages and Console status before submission.

## Assets: available versus missing

September 7 mobile pass: a dedicated installed-mode Create / Ideas / Settings UI now has four 1080 x 1920 opaque RGB screenshot drafts plus an optional Settings preview in `store-assets/phone-drafts/`. They were visually reviewed in the browser using existing example drawings and local response fixtures. See `store-assets/README.md` for provenance and reproduction. These replace the absence of prepared phone assets below, but actual Android verification is still outstanding; no screenshots have been uploaded to Play.

Google requires a 512×512 PNG icon (up to 1,024 KB), a 1024×500 JPEG or non-alpha PNG feature graphic, and screenshots. Screenshots must be JPEG/non-alpha PNG, 320–3840 pixels, with the longer dimension no more than twice the shorter. Prefer four real 1080×1920 phone captures. [Official asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).

| Asset | Actual status |
| --- | --- |
| Store icon | `store-assets/play-icon-512.png`: unchanged live 512 x 512 PNG, copied and visually reviewed. |
| App launcher icons | Generated regular and maskable sizes under `android/app/src/main/res/mipmap-*`; available. |
| Example drawings | `public/ideas/*.webp` and `public/references/doodle-reference-kiss.png`; available as product illustration references, not screenshots. |
| Feature graphic | `store-assets/feature-graphic.png`: 1024 x 500 opaque RGB, visually reviewed; editable HTML alongside. |
| Real Android screenshots | Verified Create, Result, Ideas, View larger and Settings captures from the Play-installed `nl.samistudio.doodle` TWA: `store-assets/android-captures/01-create.png`, `04-result.png`, `02-ideas.png`, `05-larger.png`, `03-settings.png` (1080×2160 opaque PNG, 2:1). Raw 1080×2400 device evidence, one-generation provenance and hashes are in `store-assets/android-captures/README.md` and `manifest.json`. The result uses one authorized existing credit; no purchase or billing flow was opened. |
| Preview video | None found; optional, not needed for this first listing. |

Suggested remaining capture order: a second simple example; genuine configured credit-pack offer. Use real product behavior, no invented ratings or testimonials, and no claim that the example outcome is guaranteed. Do not publish mock prices. The Create, Result, Ideas and View larger Android captures are ready for review; billing screenshots still require an authorized billing test.

## App access instructions draft

1. Open Doodle with an internet connection. The first two anonymous doodles do not require an account. Enter “a dog wearing a party hat” and tap **Create doodle**.
2. Open the generated image; test Download and Share. The result also offers a report action. Reports only include the drawing/description when the user selects that option.
3. For paid-account functions, choose the credit-pack offer, then **Continue with Google**. Sign-in returns to the offer; tap the purchase button again to launch Google Play payment. The account must match the account that owns the credits.
4. Account deletion is available in **Account** and at the public deletion URL above. It has a separate permanent-deletion confirmation. Use only a disposable review account if testing deletion.

**Not ready to paste as complete access yet:** supply reviewer-access arrangements that allow repeated review after the two free generations, without asking reviewers to make a real purchase or depend on a personal account's 2FA. No dedicated reviewer account, pre-funded balance, login credentials or alternate review-access mechanism was created in this task. Verify the actual Google sign-in and Play-installed billing experience before finalizing these instructions. Do not put secrets in this repository.

## Data safety evidence worksheet

This is an evidence map, not a completed Console declaration. Include the hosted app's behavior and bundled SDKs. Hashed identifiers still count as pseudonymous data; not storing a prompt in Doodle's database does not by itself establish ephemeral processing. Service-provider/user-initiated-sharing exceptions require checking the actual provider relationship and flow. [Google's Data safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

| Candidate data type / purpose | Code evidence | Remaining declaration decision |
| --- | --- | --- |
| Other user-generated content: scene text; app functionality | `src/lib/generation/generate-doodle.ts` sends a generated prompt containing the user's scene to OpenAI. | Confirm provider retention/settings; do not claim no collection or ephemeral processing from app code alone. |
| Email address and user IDs; account management | `src/lib/auth/accounts.ts` stores a protected Google identifier and internal ID; `session.ts` holds email in a signed session cookie. `play-config.ts` derives a separate account-binding HMAC. | Optional for anonymous trial, needed for paid-account features. Hashing is not anonymization. |
| Purchase history; functionality/fraud prevention | `src/lib/billing/play-google.ts`, `play-purchase.ts`, `play-credits.ts` verify purchase tokens with Google and persist a hashed-token ownership/consumption ledger. Web `checkout.ts` uses Stripe. | Declare Doodle's purchase records; do not claim Doodle collects card numbers just because a payment provider does. Confirm the exact shipped web/Play behavior. |
| Report text and optionally images/scene text; safety/support | `src/lib/reports/report-schema.ts`, `report-store.ts`, `src/components/report-dialog.tsx`. Reports expire after 30 days; image/scene attachment is opt-in. | Map report details to other user-generated content, and attached images to photos as applicable. User can use Doodle without reporting. |
| App interactions; analytics | `root-document.tsx` loads Vercel Analytics; Doodle Created, Shared, Share Link Copied and Downloaded events appear in the client. Share events include method/locale, not scene text. | Review deployed analytics configuration, SDK data practices and provider terms before deciding collected/shared/optional. |
| Device/other identifiers and security/network data; fraud prevention | Anonymous allowance cookie/count; IP-derived HMAC in generation/report limits; Vercel BotID in generation route. | Verify hosting/BotID logging and whether any provider derives location. Code alone does not establish a complete diagnostics/location declaration. |
| Support communications | Public email link; messages would be handled by the support inbox outside app code. | Confirm actual mailbox handling and retention. |

Deletion removes the account and remaining credits, not the user's Google account. Play purchase tombstones/transaction records and independently submitted reports have different retention behavior. Do not promise that all data disappears immediately. Public privacy wording, actual retention rules and Console answers must agree.

Remaining launch work: final reviewer-access method; production Play catalog/credentials and license-test purchases; installed-app billing screenshot; final age targeting/content rating; deployed provider retention and Data safety classifications. Create, Result, Ideas, View larger and Settings installed-app captures are recorded above. Identity verification and support email verification are complete.

### Console draft saved — 7 September 2026

Final typography revision: uploaded and selected `feature-graphic-brand.png` using the actual brand font; saved as draft and visually verified the resulting graphic and “Your changes have been saved” confirmation. Current source/hash are in `store-assets/README.md`.

Later owner-directed revision: removed unnecessary AI wording from promotional store text and the feature graphic. Saved title **Doodle: Little Drawing Ideas**, revised short/full descriptions above, and replaced the selected graphic with `feature-graphic-clean.png` (same source as current `store-assets/feature-graphic.png`). Console confirmed changes saved; visually checked title, description fields and replacement image. This remains a draft, not a public title change. Privacy/data declarations retain accurate technical information. Phone draft contact sheet was inspected and contains no promotional AI wording.

Saved the English app name, short description and full description in Play Console. Uploaded and applied `store-assets/play-icon-512.png` (512 × 512) and `store-assets/feature-graphic.png` (1024 × 500). Console confirmed “Your changes have been saved”; visually inspected both images rendered in the saved listing editor. This is a draft, not a public store listing. The refreshed Create, Result, Ideas, View larger and Settings Android captures are verified in `store-assets/android-captures/`; billing and mobile storefront rendering remain unverified.

The feature graphic upload from the WSL UNC path reported an empty file. Copying the same 143,412-byte PNG to the local Windows preview directory and retrying succeeded; no browser extension setting change was needed. The billing service account is Active with the approved Doodle-only permissions, but the latest read-only Publisher API retry still returned HTTP 401. Production Play billing remains disabled.
