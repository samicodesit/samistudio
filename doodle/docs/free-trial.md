# Free trial

The server owns the trial allowance. Change `FREE_DOODLE_LIMIT` in `src/lib/generation/free-allowance.ts` and deploy the backend with `npx vercel --prod`. Current total: 4 successful doodles per retained trial identity, not per day. Stored use counts stay intact, so a trial with two previous successes has two remaining. Paid credits and abuse limits are unchanged.

Android build 7 removes its fixed upper quota check and displays the server remaining balance. Intro and share copy no longer embed a fixed number. Later quota changes need no Android release for this client.

For build 6 and earlier, guest bootstrap reports at most two remaining unless the client sends `X-Doodle-Trial-Policy: dynamic`. This header changes only the bootstrap display response, never the actual entitlement. The account refresh and generation response expose the actual remaining allowance for every version. Existing guest identity and attestation requirements are retained.

Verification: isolated Redis checks four concurrent holds maximum, rejection of a fifth success, idempotent finalization, failed-hold release and preservation of two existing uses. Backend suite: 496 passed, one opt-in image test skipped. Native suite: 56 passed, including server allowances 4 and 5. Native and backend typechecks passed; backend lint has no errors and two pre-existing card image warnings. Release and live verification results are recorded below after delivery.
