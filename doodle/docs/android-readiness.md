# Android / Google Play readiness

_Assessment date: 7 September 2026_

## Decision

Doodle is useful enough to qualify as a mobile app: it is an interactive, mobile-first text-to-image product with generation, account, download, and sharing flows. The smallest sensible Android version is a **Trusted Web Activity (TWA) generated with Bubblewrap**, backed by the existing hosted Next.js application. A full native rewrite would add weeks of duplicate UI and state work without improving the core product, while a generic WebView wrapper would create avoidable authentication, payment, and review risk.

Proceed with the policy and PWA preparation now. Do **not** submit the current site in a wrapper. It has unresolved Play policy requirements because the packaged experience would sell consumable digital credits through Stripe and has no in-app AI-output reporting feature. Google Play normally requires Play Billing for digital goods sold in a Play-distributed app, and generative AI apps must let users report offensive output without leaving the app.

Google Play personal developer account `5843530199260119810` was created on 7 September after the authorized US$25 registration payment succeeded. The full budget is spent and US$0 remains. The public developer identity is **Sami Studio**, with website `samistudio.nl` and verified public support email `hello@samistudio.nl`. The free Zoho mailbox was restored without a subscription. Three account checks remain: government-issued photo ID plus a valid address document, verification on a real Android device through the Play Console mobile app, and contact-phone verification after identity approval. The Console currently presents a QR handoff for the owner to submit identity documents on their phone. The agent has not submitted or handled identity files. Creating the Play app is disabled until these checks are complete. A new personal account also requires a closed test with at least 12 testers opted in continuously for 14 days before production access. The owner wants recruitment handled when the Android build is ready. Aim for roughly 15–20 willing testers when recruiting, to protect the 12-person continuous minimum if a few drop out. The owner cannot recruit from a personal circle, so this remains an unresolved acquisition problem, not an assumed source of free testers.

The recommended first implementation slice is bounded and remains useful even if Play onboarding takes longer:

1. Make the hosted app a proper installable PWA with a web manifest, production icons, theme metadata, and an offline/network-error fallback. Do not cache prompts, generated images, account responses, or payment responses.
2. Add an in-app “Report this image” action and a server endpoint that accepts the generated image and prompt only after explicit submission, records a limited report, and gives the user a confirmation in the app.
3. Add a dedicated public account-deletion web page that works after uninstall, then update the privacy policy for reports, analytics, Google Play purchases, retention, and deletion.

After the developer account type and package name are settled, add Play Billing and generate the TWA. This order avoids building an Android shell around flows that Play would reject.

## Why TWA is the right architecture

The repo is a hosted Next.js 16.3.1 application with server routes for generation, Google authentication, Redis-backed balances, Stripe checkout, and account deletion. It cannot be bundled as a static offline Capacitor application without replacing those server dependencies. A TWA is specifically designed to open an owned PWA fullscreen using the user's browser, with ownership proven by Digital Asset Links. Google documents Bubblewrap as the easiest way to generate that Android wrapper. The existing Web Share work should then invoke Android's native share sheet from the same web UI.

Use one product and backend, with two payment adapters:

| Runtime | Purchase method | Required behavior |
| --- | --- | --- |
| Normal web browser | Existing Stripe checkout | Keep the current €4.99 web offer and webhook flow. |
| Play-installed TWA | Google Play Billing through the Digital Goods API and Payment Request API | Query and display Play's localized product price. Never show or fall back to Stripe inside the packaged Play experience. If Play Billing is unavailable, leave purchasing disabled and allow existing credits to be consumed. |

The Play product should be a repeatable **consumable one-time product**, for example `doodle_credits_10`. The Android path should call the existing balance service only after the backend verifies a Play purchase token. Store each purchase token as an idempotency key, atomically add ten credits once, then consume the product so it can be bought again. Reconcile pending and interrupted purchases on launch with `listPurchases()`. Google recommends server-side verification before granting the entitlement and requires the purchase to be acknowledged or consumed; otherwise it may be refunded after three days.

Do not trust a client success callback or a user-agent string to grant credits. A secure Play endpoint should require the signed-in Doodle account, verify package name, product ID, token, purchase state, and prior use through the Google Play Developer API, then update the same Redis account balance used by Stripe. Add provider and transaction/token fields to a purchase ledger so refunds and voided purchases can be reconciled without confusing Stripe and Play orders.

For the wrapper:

- Proposed package name: `nl.samistudio.doodle`, subject to final owner approval and Play availability. Package names are durable, so create the app only after confirming it.
- Target Android 16 / API 36. Since 31 August 2026, new apps and updates must target API 36 or higher.
- Use a currently supported Play Billing Library. Version 7's normal submission deadline ended on 31 August 2026, so the generated project must resolve version 8 or newer.
- Publish `/.well-known/assetlinks.json` with both the local upload certificate and the Play App Signing certificate as applicable. Verify that the TWA opens without a browser toolbar on a Play-installed build.
- Keep the requested Android permissions minimal. The current app needs network access; file sharing can use browser/TWA capabilities and should not require broad storage access.

## Initial repo readiness (before foundation implementation)

| Area | Evidence in the repo | Readiness |
| --- | --- | --- |
| Mobile utility | `README.md` describes a public mobile-first generator; the app supports generation, retry, download, account, and two anonymous free uses. Native Web Share is being added in the current working tree. | Strong enough for a focused mobile app; Google still expects a stable, responsive, meaningful experience. |
| PWA/Android shell | Only `src/app/favicon.ico` exists. There is no web app manifest, service worker/offline route, Android project, Bubblewrap config, Gradle wrapper, or Digital Asset Links file. | Not ready. |
| Payments | `/api/checkout` and the purchase dialog redirect signed-in users to Stripe for a €4.99 pack of ten digital credits. | Blocking for Play distribution until a Play Billing path is implemented or all in-app purchasing is removed. |
| AI safety | The OpenAI request can return a safety refusal, and the UI tells the user when a request is refused. No result reporting/flagging path exists. | Blocking. Upstream filtering helps, but Play separately requires in-app user reporting. |
| Privacy/data safety | `/privacy` describes Google sign-in, prompts sent to OpenAI, Stripe, Vercel, Upstash, cookies, IP-derived abuse hashes, retention, and account deletion. Vercel Analytics is loaded in `root-document.tsx`. | Good base. Update it for Analytics explicitly, Play purchases, submitted reports, their retention, and Android distribution. Complete a matching Play Data safety form. |
| Account deletion | Signed-in users can permanently delete their account and credit balance from the Account menu through `DELETE /api/account`. The privacy page offers email for rights requests. | In-app half exists. Add a prominent, dedicated external web deletion resource that can be used after uninstall; enter that URL in Play Console. |
| Authentication | Google Identity creates a server-verified account and stores the session in an HttpOnly cookie. | Likely reusable because TWA content runs in the browser, but sign-in, popup return, cookie persistence, sign-out, and deletion need tests on physical Android devices. |
| Local Android tools | OpenJDK 23 is present in WSL. Gradle, Android SDK command-line tools, `sdkmanager`, and `adb` were not found. | Web work can start. Building and device-testing the TWA needs a supported JDK plus Android SDK/API 36 and platform tools; Bubblewrap can provision its expected dependencies after this report is accepted. |

## Play policy work before submission

### AI-generated content reporting

Doodle is directly in scope because it creates images from text prompts. Add a report button next to the generated result, a short reason list, optional detail, and a submit action that completes inside Doodle. A `mailto:` link alone would make the user exit the app and is insufficient. Because ordinary outputs currently stay only in browser memory, report submission must clearly explain that the reported image and associated prompt will be uploaded for review. Retain the minimum needed, restrict access, set a deletion schedule, and use reports to improve prompt filtering or block patterns.

### Privacy, Data safety, and deletion

Google requires every app to link a comprehensive privacy policy in both Play Console and the app, and the Data safety answers must include data handled by third-party code. Audit at least: Google account email/identifier, OpenAI prompt and image processing, Play purchase token/order data, Stripe data used by the web service, cookies/account IDs, IP-derived abuse data, submitted reports, Vercel Analytics, BotID, hosting logs, and support messages.

The current in-app delete action is useful. Add a public `/delete-account` resource that names Doodle/Sami Studio and lets a signed-in user complete deletion on the web, or submit a deletion request without reinstalling the app. Explain any legally retained transaction or anti-fraud records. The privacy page's general contact email is supporting evidence, but a dedicated, discoverable flow is much safer for review.

### Payments and account restoration

Never route a Play user to Stripe for these credits. Existing web-purchased credits may be consumed after sign-in, but the packaged app must use Play Billing for any new in-app purchase unless Sami Studio deliberately enrolls in and fully implements a region-specific alternative billing program. That program adds reporting, fees, and geographic branching, so it is not the smallest launch path.

Add recovery tests for: purchase succeeds but the network drops before crediting; pending payment; repeated callback/token; reinstall/new device; Play refund/void; account deletion with an unconsumed token; and a Stripe balance visible inside Android. Review and refund copy must distinguish Play purchases from Stripe purchases and direct users to the right refund route.

### Store and review material

Prepare a high-resolution app icon, feature graphic, phone screenshots, concise listing copy, support email, website, privacy URL, deletion URL, category/tags, content-rating questionnaire, ads declaration, target-audience declaration, Data safety form, and app-access instructions. The two anonymous free generations give reviewers access to the core feature; also provide a test account or precise instructions for reviewing account, billing, and deletion flows.

## Account choice and Console configuration

Personal and organization accounts have the same Play functionality and can both monetize. Choose based on the legal publisher:

- Choose **Personal** if this is Sami publishing as an individual or hobby/semi-professional developer. It is valid for a paid Doodle app, but a newly created personal account needs identity/contact verification, verification through the Play Console Android app on a real device, and the 12-testers-for-14-days closed test before production access.
- Choose **Organization** only if Sami Studio is the actual registered business publisher and its legal name/address can be matched to a D-U-N-S profile and official organization documents. Do not choose it merely to avoid the personal testing gate.

Choose the individual who will really own the app, receive payouts, handle tax/support obligations, and keep the account long term. Use that person's verified legal residence and payments profile; citizenship or a partner's country should not be used as a shortcut around onboarding. Align the privacy-policy operator, store publisher, merchant/payout details, and support identity before submission. The current legal pages assert a Slovak operator and governing law; those assertions have not been verified against the actual publisher. Do not infer the operator from partner location or citizenship, and do not invent a replacement identity. Resolve this before Play submission. Use `Sami Studio` as the public developer name if that accurately matches the product. Configure a verified support email, phone, website, legal payments profile, and merchant account. Monetized developer listings display legal-address information from the linked payments profile, so review it before completing setup.

Console configuration then needed:

1. Create the app with the final package name and enable Play App Signing.
2. Create the `doodle_credits_10` consumable one-time product and regional pricing.
3. Link the Google Play Developer API/service account used by the backend; configure Real-time Developer Notifications and void/refund reconciliation.
4. Upload an API-36 Android App Bundle built with Play Billing Library 8 or newer to internal testing first.
5. Add license testers and exercise actual test purchases. For a new personal account, recruit 12 legitimate closed testers and keep all 12 opted in continuously for 14 days, then apply for production access and answer the testing/readiness questions.

## Concrete delivery plan and effort

1. **PWA and policy foundation (1–2 engineering days):** manifest, 192/512 and maskable icons, theme metadata, safe offline fallback, in-app report flow/backend, dedicated deletion page, and privacy changes. Validate installability, offline/error behavior, report submission/deletion, mobile layout, and that no generated content enters caches.
2. **Dual billing backend (2–4 days):** provider-neutral purchase ledger, Play token verification/idempotent credit grant/consume, pending recovery, and refund/void reconciliation. Keep Stripe's web path intact. Validate all failure and replay cases with tests.
3. **TWA wrapper (1–2 days):** provision Android tools, generate with Bubblewrap, set API 36 and supported Billing Library, configure package/signing/Digital Asset Links, and build the AAB. Validate on at least one current Android device and one lower-supported Android device or emulator.
4. **Console and release QA (1–2 days plus review):** product/catalog setup, internal purchase test, forms/assets, Android vitals/pre-launch report, then the personal-account closed test if applicable. The tester gate adds at least 14 calendar days and production-access review time.

A native Kotlin or Compose rewrite would more realistically take several weeks and would still need the same backend billing, AI-reporting, privacy, account deletion, store, and tester work. It is not justified by the current acquisition evidence. The Play release should be treated as a distribution experiment; the product's viral loop still comes from a successful creation followed by a compelling native share. Track generation success, share-sheet opens/completions, install source, first-generation completion, and purchase conversion. A store listing alone does not create growth.

## Remaining Android release work

**Can build now without further Play spending:** all PWA and policy work, the provider-neutral billing data model and endpoints behind feature flags, listing assets/copy, Android project source, unit/integration tests, and a locally signed debug build after installing the free Android toolchain.

**Requires further Console state:** completing any outstanding identity/device verification, reserving/confirming the package, obtaining the Play App Signing certificate, configuring the one-time product/catalog, merchant and API credentials, license-test purchases, Play-generated app bundle testing, Data safety submission, pre-launch report, closed test, and production release.

**Cannot honestly publish on Play yet:** the three account verification tasks remain and app creation is disabled, Play Billing and AI reporting are absent, an Android bundle has not been built, and no physical-device or Play purchase test has run. The PWA and public account-deletion foundation are deployed at `doodle.samistudio.nl`; combined unit checks, lint, production build, responsive browser checks, and production smoke checks pass.

## Official sources

- [Get started with Play Console — fee, account type, verification, and personal-account device check](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
- [Choose a developer account type — same functionality, personal vs organization, D-U-N-S](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en)
- [Manage verified developer information — public developer and merchant details](https://support.google.com/googleplay/android-developer/answer/13634081?hl=en)
- [Testing requirements for new personal accounts — 12 testers for 14 continuous days](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google Play Payments policy — digital goods and external payment restrictions](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en)
- [TWA Play Billing with Digital Goods and Payment Request APIs](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing)
- [Trusted Web Activity overview and Bubblewrap quick start](https://developer.chrome.com/docs/android/trusted-web-activity)
- [Play Billing integration — verify, grant, and consume purchases](https://developer.android.com/google/play/billing/integrate)
- [Play Billing Library version support deadlines](https://developer.android.com/google/play/billing/deprecation-faq)
- [AI-Generated Content policy — prohibited output and in-app reporting](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en)
- [User Data policy — privacy, Data safety, and account deletion](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- [Target API requirements — API 36 from 31 August 2026](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [Functionality, content, and user-experience requirements](https://support.google.com/googleplay/android-developer/answer/9898783?hl=en)
- [Create and set up a Play app and store listing](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en)
