# Android tester recruitment — draft, not launched

## Current implementation update — 7 September 2026

This update supersedes the initial assessment below. The owner submitted identity documents; Google last showed identity review in progress, not an unfinished upload. Android-device and subsequent phone verification remain. Do not reopen or disturb the owner's verification flow.

PWA/offline fallback, account deletion and in-app reporting are live. Commit `9e4bdef` implements guarded Play catalog/purchase UI, server verification and atomic credit fulfillment, and a local Android billing adapter that preserves account binding. The debug APK builds. Play purchases are disabled; real device/purchase testing, refund reconciliation, signing/domain association, store setup and closed testing still gate publication. No additional budget remains.

## Decision and budget

The owner raised the total budget from US$20 to US$25 for Google Play's one-time registration fee. The authorized US$25 payment succeeded on 7 September and personal developer account `5843530199260119810` was created; US$0 remains. The accepted public developer name is **Sami Studio (samistudio.nl)**, with website `samistudio.nl` and verified public support email `hello@samistudio.nl`. The free Zoho mailbox was restored without a subscription. Three account checks remain: government-issued photo ID plus a valid address document, verification on a real Android device through the Play Console mobile app, and contact-phone verification after identity approval. The Console currently presents a QR handoff for owner submission on their phone. The agent has not submitted or handled identity files. Creating the Play app is disabled until these checks are complete.

The closed-test clock requires an actual uploaded app, configured test track and opted-in testers; account registration alone does not start it. The owner chose the personal Play account route and wants tester recruitment handled when the Android build is ready. Recruitment is not a prerequisite for continuing the build or Console setup. No tester has been recruited or contacted by the agent.

## Recruitment approach

Target 15–20 volunteers to provide a buffer above Google's minimum 12. They should own Android devices, use a Google account to join the test, be willing to try the app meaningfully and remain opted in for at least 14 continuous days. Do not promise guaranteed production approval after day 14.

Prioritize people who would use a little drawing for a card, journal, lunchbox note or message. The owner has explicitly said their personal circle cannot supply testers. Do not base recruitment on friends or family. Seek opt-in interest from the web app's audience and relevant public communities instead; obtaining twelve sustained participants remains unproven. Developer exchanges such as r/AndroidClosedTesting can supplement the group when the owner can genuinely test others' apps in return. Check current community rules before posting.

Volunteer recruitment can have no cash fee. Coordination takes time, and generation still has API costs. Do not buy tester packages under the current budget: the registration fee would use the entire US$25. Do not promise testers unlimited free generations; define a bounded test allowance before an invitation is published.

## Invitation draft

I’m preparing an Android version of Doodle, a small tool that turns a sentence into a simple drawing you can copy onto a note or card.

I’m looking for Android users who would try it, tell me what’s confusing or broken, and stay opted in to a Google Play closed test for at least two weeks. The useful feedback is whether you can make a doodle, save/share it, and easily start a different idea.

Interested? Let me know what Android phone you use. I’ll send the official Google Play test link when the build and testing group are ready.

This is draft copy only. Sending invitations, publishing recruitment posts, collecting contact details or promising reciprocal testing needs explicit authorization for those actions and destinations.

## Meaningful test tasks

1. Join using the official opt-in link and install through Google Play with the same account. Record device and Android version.
2. Use an example prompt. Report how long generation feels and whether progress/error messages make sense.
3. Download a result and find the saved image. Share through an app the tester chooses; do not require messaging a particular person.
4. Choose “Draw something else.” Confirm it is easy to find, clears the prompt and lets the tester enter a different idea without spending a generation immediately.
5. Choose “Redraw this idea” only within the test allowance; confirm the prompt is reused and usage changes correctly.
6. Test rotation, smaller screens, text scaling, screen reader focus, leaving/returning to the app, and a temporary network loss.
7. Exercise sign-in, allowance exhaustion, account deletion and Play test purchases once those Android features are actually implemented. Use licensed test transactions rather than charging testers.
8. Report findings in a private feedback channel, test the fixes, and remain opted in throughout the required period. Do not claim testing occurred when it did not.

Keep an honest feedback log: date, version, device, steps, expected/actual result, severity, fix, and retest. Use that record for Google's production-access questions.

## Official references

- Account types: https://support.google.com/googleplay/android-developer/answer/13634885
- Personal-account testing requirements and recruiting guidance: https://support.google.com/googleplay/android-developer/answer/14151465
- Test-track setup: https://support.google.com/googleplay/android-developer/answer/9845334
- Registration fee: https://support.google.com/googleplay/android-developer/answer/6112435

## Verified recruitment destination — 7 September 2026

The r/GooglePlayDeveloper Weekly Tester Discovery Thread explicitly permits genuine tester requests and asks for app purpose, device requirements, track type, desired feedback and participation method. It prohibits paid engagement and review/rating/vote/referral exchanges. Current thread: https://www.reddit.com/r/GooglePlayDeveloper/comments/1w3dx60/weekly_tester_discovery_thread_find_testers_help/ . Recheck the current weekly thread and rules at posting time. Use the invitation above only after the actual closed track and Play opt-in link exist. Ask the owner to authorize this exact post and destination before publication; no tester has been contacted.
