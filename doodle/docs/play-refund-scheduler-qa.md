# Play refund scheduler QA

Date: 30 September 2026

The authenticated Node route at `/api/internal/play/reconcile-voids` runs the existing Google Play void reconciliation in `apply` mode over an overlapping almost-30-day window. It requires a configured `CRON_SECRET` of at least 32 characters and a constant-time bearer comparison. Missing or short configuration fails closed, and an incorrect bearer receives no billing or Redis work. Responses, logs and the Redis heartbeat contain only fixed status values, timestamps and aggregate counters. The heartbeat key is `doodle:play:voids:reconciliation`.

`vercel.json` schedules the route daily at `03:00 UTC` with the current Vercel `crons` object shape and schema URL. A distributed lease was not added because the existing atomic token-hash void transition is idempotent, so an overlapping invocation cannot reverse the same purchase twice. The route records running, successful aggregate, and failed heartbeat states for operational monitoring.

Verification completed:

- Focused route, cron-schema, void-reconciliation, credit-ledger, and isolated-Redis tests: 24 tests passed.
- Full `npm test`: 429 tests passed, 1 intentional live-generation test skipped.
- `npm run typecheck`: passed.
- Focused ESLint on the route and new tests: passed.
- `npm run lint`: passed with four pre-existing warnings outside this scope.
- `npm run build`: passed. Next listed `/api/internal/play/reconcile-voids` as a dynamic Node route.
- Read-only operator preview using the private Play service-account environment plus the repository KV environment, with `PLAY_BILLING_ENABLED=true` scoped to that process and no `--apply`: `mode=dry-run`, `fetched=1`, `tombstoned=1`, `reversed=0`, `recovered=0`, `unrecovered=0`. No receipt token or account identifier was printed.
- The cron schema and UTC semantics were checked against [Vercel's current cron quickstart](https://vercel.com/docs/cron-jobs/quickstart) and [vercel.json reference](https://vercel.com/docs/project-configuration/vercel-json).

Release evidence audit:

- `docs/native-android-delivery.md` records the canonical Play-installed build 5 AAB as version `0.1.3`, code `5`, 62,069,342 bytes, SHA-256 `c59290bff96a5b4aed67a32793113566d657f160260a916b7b335da4204c694b`. It records production native generation HTTP 200, a zero-charge Play license-test purchase verified and consumed with balance 15 to 25, restart persistence, and 54 native tests plus typecheck and release checks. This is test-card evidence, not a real monetary charge or refund.
- `docs/physical-phone-qa.json` records the owner-reported Play reinstall followed by correlated production generation request `zrl2v-1790762010778-f1e169da4081` with HTTP 200. The installed version, final balance, and physical screenshot were not independently read back, so that evidence remains distinct from the emulator build 5 record.

Production verification completed inline after owner approval:

- Live deployment `dpl_2uKrrG5KusyPn5TQRDmhFfpviSTd` is READY and promoted to `https://doodle.samistudio.nl`. Its 208 uploaded source files comprise the 206 previous live files plus only the new route and `vercel.json`. The halo prompt, native configuration and purchase-verification source hashes are unchanged.
- A random private Production `CRON_SECRET` was configured with explicit owner approval. Its value is not recorded here. Unauthenticated requests returned HTTP 401 with `Cache-Control: no-store`. Independent cloud review confirmed the enabled daily `0 3 * * *` cron on the current deployment.
- Final focused checks passed: 31 tests, typecheck and focused ESLint. The production build passed. Fresh independent review separately passed 21 targeted tests and focused ESLint, including the residual-replay monitoring regression.
- Every heartbeat now includes the persistent review queue's `residualCount`, `attentionStatus`, sanitized `failureCode`, and cleared aggregate defaults. An idempotent replay cannot hide a previous unrecovered refund merely because this run recovered zero new credits.
- The emulator remained Google Play-installed version 0.1.3, code 5, installer `com.android.vending`. The Doodle account was the separate reviewer, starting at 19; the owner account remained at 23 throughout the refund test. Play checkout used the owner's Google account, explicitly displayed **Test card, always approves** and **This is a test order, you will not be charged**. The owner's existing separate email list was enabled for license testing, with `RESPOND_NORMALLY`; no Play Integrity override was added for the owner.
- A zero-charge order was confirmed at 11:08:40 UTC and processed by Google at 11:08:41. The app was force-stopped immediately after confirmation, before any server ledger grant. A read-only ledger check showed no new purchase and unchanged balances. Reopening the actual installed app recovered the unfinished purchase at 11:09:37.200 UTC, created one consumed ledger record and changed the reviewer balance 19 to 29. A second restart retained 29 without another grant. This proves app-interruption recovery; no network-outage test is claimed.
- Google Play Console refunded that exact test order at 11:12:20 UTC with **Remove entitlement** selected and reason **Other**. Its rendered status became Refunded and total EGP 0.00.
- The authenticated production cron invocation at 11:12:26.584 UTC returned HTTP 200: fetched 2, alreadyVoided 1, reversed 1, recovered 10, unrecovered 0. The new ledger became voided from prior state consumed; the reviewer returned to 19 and owner stayed 23. The review queue was empty.
- A second authenticated invocation at 11:12:37.426 UTC returned HTTP 200: fetched 2, alreadyVoided 2, reversed 0, recovered 0, unrecovered 0. Both balances stayed unchanged. Heartbeat status was ok, attention clear, residualCount 0. Restarting the installed app displayed the reviewer balance of 19.
- Cancellation of an earlier payment sheet left 19 credits and created no order. It displayed the existing generic checkout-start error; this is a non-blocking wording issue, not evidence of a failed completed payment or lost credits.

Operation: inspect the Vercel cron invocation log and safe Redis heartbeat after the daily run. Investigate an HTTP failure, `status=failed`, a stale running/completed heartbeat beyond the daily interval, or `attentionStatus=attention_required`. Review the persistent residual queue with the existing operator CLI. Vercel does not automatically retry failed cron invocations; rerun after resolving an incident. A nearly-30-day overlapping window and atomic void records make reruns safe. This record establishes an enabled schedule and manual production execution, not a future timed invocation or automatic alert subscription.

Minimal visual evidence is preserved under the local `release-diagnosis` directory: `final-refund-testcard.png`, `final-refund-recovered29.png`, `final-refund-confirmed.png`, and `final-refund-restored19.png`. Receipt tokens and account identifiers are not included in this record.
