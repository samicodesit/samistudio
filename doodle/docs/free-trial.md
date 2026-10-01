# Free trial

The server owns the trial allowance. Change `FREE_DOODLE_LIMIT` in `src/lib/generation/free-allowance.ts` and deploy the backend with `npx vercel --prod`. Current total: 4 successful doodles per retained trial identity, not per day. Stored use counts stay intact, so a trial with two previous successes has two remaining. Paid credits and abuse limits are unchanged.

Android build 7 removes its fixed upper quota check and displays the server remaining balance. Intro and share copy no longer embed a fixed number. Later quota changes need no Android release for this client.

For build 6 and earlier, guest bootstrap reports at most two remaining unless the client sends `X-Doodle-Trial-Policy: dynamic`. This header changes only the bootstrap display response, never the actual entitlement. The account refresh and generation response expose the actual remaining allowance for every version. Existing guest identity and attestation requirements are retained.

Verification: isolated Redis checks four concurrent holds maximum, rejection of a fifth success, idempotent finalization, failed-hold release and preservation of two existing uses. Backend suite: 496 passed, one opt-in image test skipped. Native suite: 56 passed, including server allowances 4 and 5. Native and backend typechecks passed; backend lint has no errors and two pre-existing card image warnings. Release evidence follows.

Backend delivery, 1 October 2026: Vercel deployment `dpl_G6kXgdejq8wtZFhVSoyS5BF4upMm` is READY at https://doodle.samistudio.nl. All 228 uploaded source hashes match main. A live unauthenticated account read returns `freeRemaining: 4`; the rendered app shows four remaining at desktop 1280px and mobile 360px. Both inspected layouts have no horizontal overflow and load the brand fonts. Screenshots are retained under `C:/Users/Sami/.codex/doodle-live-evidence/trial-four-1280.png` and `trial-four-360.png`.

Android delivery preparation: signed build 7 (0.1.5), 53,529,507 bytes, SHA-256 `6cc5c45ed4e92e8e4db757b6a32fd48151a0eb058ed3b9049cab7434a57c1cd2`. Google Play upload returned the same hash and version code 7. Embedded config points to the production backend and has `nativeFixtureMode: false`. Brand fonts and the existing R8 resource-shrinking optimization are retained. ProGuard mapping uploaded. Native tests and typecheck passed. No new Play-installed generation or payment end-to-end test is claimed for this quota change.

Submission remains pending. Edit `13975943408303764340` contains the four-free English store description and build 7 production track, but the service account cannot validate or commit (HTTP 403). The browser helper cannot initialize. Production release API still reports build 6 as published. Resume the final submission after browser access is restored; this backend allowance already applies to retained trial identities on the existing app.
