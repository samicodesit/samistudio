# Console setup progress — 7 September 2026

Saved and visually verified three declarations for `nl.samistudio.doodle`: not developed by/on behalf of government; no financial features; no health features. Doodle generates drawings and sells app-specific generation credits, with no financial service or health functionality. These are saved changes awaiting review, not an approved public release.

Dashboard subsequently showed **6 of 11** setup tasks complete. Remaining checklist items: sign-in details, content rating, target audience, Data safety and final store listing. Closed testing still shows zero opted-in testers.

The existing `Doodle owner testing` email list was inspected and contains only `samicodesit@gmail.com`. It is now selected and saved under account License testing, with `RESPOND_NORMALLY`. Internal distribution remains owner-only. Actual billing tests must explicitly use a Google test payment instrument; no real payment is authorized by this setup action.

The `doodle_credits_10` / `ten-doodles` purchase option was activated and visually verified as Active. A separate API check at 18:09:49 UTC confirmed Netherlands EUR 4.99 and US USD 5.99, both available. Product description was updated and saved as: “Create 10 more doodles. A one-time credit pack, with no subscription.”

No public Play release, external tester invitation, or new social post was made in these steps.

## Controlled payment test preparation

The earlier API permission rejection cleared with unchanged service-account permissions; exact probe evidence is in play-api-support-draft.md. Production now has the service-account JSON, stable account-link secret and enabled Play billing switch for the owner-only internal test. Deployment `3mJ4Gowd3SwoN6vnMVZb4129ovfM` includes the refill entry and is live on the production alias.

Account now offers Get 10 doodles before credits run out. It opens the existing purchase flow, closes the menu and restores Account focus when dismissed. The result-screen menu opens upward and aligns to the trailing edge to fit small phones. Independent QA passed mocked Play and Stripe isolation, pending states, positive-credit refill, menu containment and focus restoration. The implementation agent ran 31 relevant tests and lint; production build passed. Root visually inspected the live menu, opened/dismissed refill in desktop Play-preview mode, confirmed Account focus and unchanged seven-credit balance. The preview correctly cannot purchase without the Android Digital Goods service; this is not proof of a real Play transaction.

A separate official Play Store emulator is booted (`emulator-5556`, adb server 5038), preserving the original emulator. Real Phonesky Play Store 45.3.21 and the sign-in screen were verified, with zero Google accounts. Manual owner sign-in is required next. Launcher: `C:\Users\Sami\.codex\doodle-android-preview\show-play-preview.ps1`. No real Play transaction or ten-credit delivery has yet been verified.
