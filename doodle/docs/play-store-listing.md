# Google Play listing draft

Prepared September 7, 2026. Draft only; nothing in this document has been submitted or published. Copy reflects the current Doodle feature set. Release access, billing configuration and store assets still need completion.

## Paste-ready English copy

### App name

```text
Doodle: Simple AI Drawings
```

### Short description

```text
Turn little moments into AI doodles to copy onto cards, notes and journals
```

### Full description

```text
A little drawing can make someone's day.

Doodle turns a short description into a simple AI-generated drawing you can share, save or copy by hand. Describe one small moment, such as a dog in a party hat or two people dancing in the kitchen, and see it become a friendly doodle.

Ideas for everyday kindness
Make a drawing for a greeting card, a lunchbox note, a journal page or a small thank-you. Doodle focuses on simple scenes and clear lines that give you a starting point for your own drawing.

From words to a doodle
• Describe a small scene or choose a suggested idea.
• Open the result for a closer look.
• Download your doodle or share it using the options available on your device.
• Try another version or start a new scene.

Two free doodles to start
Try two doodles without signing in. After that, sign in with Google to buy a pack of 10 more. Credit packs are one-time purchases, not subscriptions. The purchase screen shows the price before you pay. Failed generations do not use a doodle credit.

Doodle uses AI, so results can vary. An internet connection is required to create drawings. You can report a generated doodle from the result screen and delete your Doodle account from the Account menu or the account-deletion page.

Made by Sami Studio.
Support: hello@samistudio.nl
Website: https://samistudio.nl
```

Character limits are 30 for name, 80 for short description and 4,000 for full description. [Google's listing fields](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en). The free allowance is attached to the anonymous browser identity; do not advertise a daily reset, unlimited free generation or a free allowance for an existing signed-in paid account.

## Store fields

| Field | Draft value / status |
| --- | --- |
| Developer display name | Sami Studio (samistudio.nl); personal-account legal operator: Ahmed Sami Ibrahim Mohamed Shata, Netherlands (user-confirmed from Console) |
| Support email | hello@samistudio.nl; mailbox restored and email verified earlier in this task |
| Developer website | https://samistudio.nl |
| Product website | https://doodle.samistudio.nl |
| Privacy policy | https://doodle.samistudio.nl/privacy |
| Account deletion | https://doodle.samistudio.nl/delete-account |
| Package | nl.samistudio.doodle |
| Category | Draft: Art & Design; choose available Console category/tags |
| Monetization | Free download with in-app purchases; no subscription |
| Audience | People making simple personal notes/cards/journal drawings. Do not select children's age groups or claim Families compliance without completing that assessment. Content rating is not yet assigned. |

Local source now uses the confirmed operator/contact details, and the privacy page includes Play purchase processing and Vercel Analytics. Those latest legal/privacy changes have not yet been deployed. At the last Console check, identity documents were submitted and Google's review was pending; device and phone verification were still pending. Confirm the live legal pages and Console status before submission.

## Assets: available versus missing

Google requires a 512×512 PNG icon (up to 1,024 KB), a 1024×500 JPEG or non-alpha PNG feature graphic, and screenshots. Screenshots must be JPEG/non-alpha PNG, 320–3840 pixels, with the longer dimension no more than twice the shorter. Prefer four real 1080×1920 phone captures. [Official asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).

| Asset | Actual status |
| --- | --- |
| Store icon | `android/store_icon.png`: verified 512×512 RGBA PNG, 13,030 bytes. Available; visual store-icon review still needed. |
| App launcher icons | Generated regular and maskable sizes under `android/app/src/main/res/mipmap-*`; available. |
| Example drawings | `public/ideas/*.webp` and `public/references/doodle-reference-kiss.png`; available as product illustration references, not screenshots. |
| Feature graphic | No finished 1024×500 store graphic found. Missing. |
| Real Android screenshots | Missing. Existing `test-results/` captures are responsive browser QA with mocked generation/account/purchase state, not evidence of the Play-installed experience. Some 320×740 captures also exceed the allowed 2:1 ratio. Do not upload them as final Android purchase screenshots. |
| Preview video | None found; optional, not needed for this first listing. |

Suggested capture order: composer with a short scene; generated doodle with download/share actions; a second simple example; genuine configured credit-pack offer. Use real product behavior, no invented ratings or testimonials, and no claim that the example outcome is guaranteed. Do not publish mock prices.

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

Exact remaining unknowns: outcome of Google's pending identity review and completion of device/phone verification; deployment of the latest legal/privacy changes; final reviewer-access method; production Play catalog/credentials and license-test purchases; final screenshots/feature graphic; final age targeting/content rating; deployed provider retention and Data safety classifications. The support mailbox and email verification are already complete. No Console changes, uploads, messages or purchases were made for this draft.
