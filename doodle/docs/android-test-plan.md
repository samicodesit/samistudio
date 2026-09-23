# Android tester recruitment â€” draft, not launched

## Current implementation update â€” 7 September 2026

This update supersedes the initial assessment below. The owner submitted identity documents; Google last showed identity review in progress, not an unfinished upload. On a fresh read of Console Home at 10:45 UTC, Google still showed identity review and subsequent phone verification; the Android-device task was no longer listed. Create app was disabled. Do not reopen or disturb the owner's verification flow.

PWA/offline fallback, account deletion and in-app reporting are live. Commit `9e4bdef` implements guarded Play catalog/purchase UI, server verification and atomic credit fulfillment, and a local Android billing adapter that preserves account binding. The debug APK builds. Play purchases are disabled; real device/purchase testing, refund reconciliation, signing/domain association, store setup and closed testing still gate publication. No additional budget remains.

## Current route and rule check â€” 8 September 2026

Google's current [personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
require a closed test with at least 12 testers opted in continuously for the
preceding 14 days before applying for production access. Internal testing is an
optional starting point and does not satisfy that closed-test gate. A tester who
opts out and later opts back in starts a new consecutive period. Google asks for
the recruitment difficulty, tester engagement, feature coverage, feedback summary
and production-readiness changes in the application. Insufficient engagement or
fewer than 12 opted-in testers can lead to continued testing. Review usually
takes seven days or less after applying, but can take longer; this is guidance,
not a guarantee.

Google's [testing-track guidance](https://support.google.com/googleplay/android-developer/answer/9845334?hl=en)
allows a closed track to use either a Play Console email list or a Google Group.
The track must be published before its opt-in link appears; users of a Google
Group must join the group before opting into the test. Anyone still opted into
an internal test must opt out of that internal test before joining a closed test.

### One recommended route: public discovery, private Google Group

Use the current [r/GooglePlayDeveloper Weekly Tester Discovery Thread](https://www.reddit.com/r/GooglePlayDeveloper/comments/1w9s9pl/weekly_tester_discovery_thread_find_testers_help/)
to find volunteers, then manage accepted testers through one owner-created
Google Group. The live thread asks for the app purpose, Android/device
requirements, test-track type, requested feedback and participation steps. Its
rules prohibit paid testing, paid reviews, ratings, votes, referral exchanges
and other paid engagement, and ask people not to post personal information
publicly. Recheck the thread and rules immediately before posting.

The owner does the setup: create a private-member [Google Group](https://support.google.com/groups/answer/2464926), configure the
closed track to use that group, add a feedback email or form, publish the track
and copy the opt-in link. Interested people should reply or send a private
message without posting a Google account address publicly. The owner approves
the group request and confirms that the same Google account is used for Play;
each volunteer then joins the group, opts in, installs, and records their own
opt-in date. Aim for 15â€“20 volunteers so ordinary drop-off does not take the
count below 12.

This is volunteer testing only. The bounded ask is the app's normal first two
free doodles, using one card, one lunchbox-note or one journal-note idea, then
testing Download, Share, the next-idea control and return-to-app behavior. No
purchase, paid tester package, rating, review, vote, reciprocal test or unlimited
free use is requested. Testers should remain opted in for the full 14 days and
send honest feedback through the stated channel. The already-completed paid-pack
test does not need to be repeated by volunteers.

### Live channel comparison

- **Recommended â€” r/GooglePlayDeveloper weekly thread:** current tester-only
  thread, clear anti-paid-engagement rules, and direct fit for a transparent
  volunteer request. Use the thread above.
- **Secondary â€” [r/AndroidAppTesters](https://www.reddit.com/r/AndroidAppTesters/):**
  public community with a current welcome post explicitly inviting tester
  requests and links. Its retrieved material does not establish the same
  detailed anti-paid rule set, so use only the clean volunteer wording below
  and avoid any exchange or review language.
- **Rejected for this route â€” [r/AndroidClosedTesting](https://www.reddit.com/r/AndroidClosedTesting/):**
  public and active, but its current feed is dominated by test-for-test offers;
  its visible rules also prohibit links to other subreddits. It is a poor fit
  for an unpaid, non-reciprocal request and is not needed when the recommended
  thread is available.

The official requirements page identifies personal/professional networks,
target communities and social media as recruitment routes; it does not document
a Google-provided tester-matching service. Recruitment must come from relevant
communities or the developer's own audience; do not buy testers or claim that a
community guarantees production access.

### Channel-specific post draft â€” do not publish

**Title:** `[Closed test] Doodle â€” simple drawing ideas for cards and notes`

**Body:**

I'm preparing Doodle, a small Android app that turns one sentence into a simple
drawing idea you can copy onto a card, lunchbox note or journal page.

I'm looking for 15â€“20 Android volunteers for a genuine Google Play closed test.
The minimum is 12 testers continuously opted in for 14 days. You would try a
card or note idea, test Download/Share and starting a different idea,
then send honest feedback about anything confusing or broken. No purchase is
required, and no rating, review, vote, payment or
reciprocal testing is requested.

When the closed track is published, I will send the official Google Play opt-in
link and the private tester-group instructions. Please reply here or message me
if you genuinely use an Android phone and can stay opted in for the full 14
days. Please do not post your Google account email publicly.

This is a draft. Publish only after the closed-track link, Google Group and
feedback channel exist and the owner authorizes this exact post and destination.

## Current recruitment execution checkpoint: 8 September 2026

- The Google Groups creation form is prepared for `Doodle Android Testers` at
  `doodle-android-testers-2026@googlegroups.com`. Its description states that
  the group is for the Doodle Android closed test, join requests are reviewed
  by the owner, member email addresses are not public, and feedback can be
  sent to `hello@samistudio.nl`.
- Privacy settings entered: group search is limited to group members; joining
  is set to `Anyone can ask`; conversations, posts, and member visibility are
  limited to group members. No members were entered and no invitations were
  sent.
- Clicking `Create group` produced a Google `Captcha required` dialog with an
  unchecked `I'm not a robot` reCAPTCHA. The group has not been created, so it
  has no verified group join URL. The existing Play opt-in URL remains
  `https://play.google.com/apps/testing/nl.samistudio.doodle`. The Closed
  testing - Alpha track, its existing email list and tracks remain unchanged;
  no group was attached and the group-based join path was not verified.
- Recruitment has not been published. The Reddit destination remains the
  current Weekly Tester Discovery Thread linked above. Manual completion of the
  reCAPTCHA is required before resuming group creation and the dependent track
  and recruitment steps.

## Live setup verification: 8 September 2026

- Google Group creation is complete. The rendered group page shows `Doodle
  Android Testers` with 1 member at
  `https://groups.google.com/g/doodle-android-testers-2026`.
- The saved group settings show group visibility limited to group members,
  joining set to `Anyone on the web can ask`, and member email addresses
  visible only to group managers.
- The Alpha track remains active with release `0.1.0 - Doodle closed QA`.
  Play Console offers Email lists and Google Groups as mutually exclusive
  tester sources. Email lists is still selected with `Doodle owner testing`
  and 2 users. Selecting Google Groups showed one group email field and would
  replace the email-list source, so the choice was discarded and no track
  mutation was saved.
- The official Play opt-in URL remains
  `https://play.google.com/apps/testing/nl.samistudio.doodle`. The group was
  not attached to Alpha, and no recruitment post was published because doing
  so before an attached tester source would misstate the available test path.
- An authorized attempt to add the two existing tester accounts directly to
  the group opened a new `Captcha required` dialog. The two entries remain
  staged in the persistent browser tab, but the Add members action is blocked
  until the owner completes that CAPTCHA. The group still visibly has 1
  member, so access preservation is not yet verified.

Prepared natural recruitment copy after removing the first-two-free wording:

> I'm preparing Doodle, a small Android app with simple drawing ideas for a
> card, lunch note or journal page.
>
> I'm looking for 15â€“20 Android volunteers for a genuine Google Play closed
> test. Please stay opted in for 14 days, try a few ideas, and send honest
> feedback about anything confusing or broken. No purchase is required, and I
> am not asking for a rating, review, vote, payment or reciprocal testing.
>
> If you use an Android phone and can take part for the full 14 days, please
> reply here or message me. Please don't post your Google account email
> publicly. I will send the private group instructions and official Play
> opt-in link after the test setup is ready.

### Production-access handoff

After 14 consecutive days with at least 12 opted-in closed testers, the owner
applies from the Play Console Dashboard. Keep the test running while Google
reviews the application, summarize real feature use and feedback, and describe
what changed as a result. Production access is a review decision, not an
automatic consequence of reaching day 14. The current official guidance says
review usually takes seven days or less, but it may take longer.

## Decision and budget

The owner raised the total budget from US$20 to US$25 for Google Play's one-time registration fee. The authorized US$25 payment succeeded on 7 September and personal developer account `5843530199260119810` was created; US$0 remains. The accepted public developer name is **Sami Studio (samistudio.nl)**, with website `samistudio.nl` and verified public support email `hello@samistudio.nl`. The free Zoho mailbox was restored without a subscription. Three account checks remain: government-issued photo ID plus a valid address document, verification on a real Android device through the Play Console mobile app, and contact-phone verification after identity approval. The Console currently presents a QR handoff for owner submission on their phone. The agent has not submitted or handled identity files. Creating the Play app is disabled until these checks are complete.

The closed-test clock requires an actual uploaded app, configured test track and opted-in testers; account registration alone does not start it. The owner chose the personal Play account route and wants tester recruitment handled when the Android build is ready. Recruitment is not a prerequisite for continuing the build or Console setup. No tester has been recruited or contacted by the agent.

## Recruitment approach

Target 15â€“20 volunteers to provide a buffer above Google's minimum 12. They should own Android devices, use a Google account to join the test, be willing to try the app meaningfully and remain opted in for at least 14 continuous days. Do not promise guaranteed production approval after day 14.

Prioritize people who would use a little drawing for a card, journal, lunchbox note or message. The owner has explicitly said their personal circle cannot supply testers. Do not base recruitment on friends or family. Seek opt-in interest from the web app's audience and relevant public communities instead; obtaining twelve sustained participants remains unproven. Do not rely on exchange-based tester communities or reciprocal testing. Check current community rules before posting.

Volunteer recruitment can have no cash fee. Coordination takes time, and generation still has API costs. Do not buy tester packages under the current budget: the registration fee would use the entire US$25. Do not promise testers unlimited free generations; define a bounded test allowance before an invitation is published.

## Invitation draft

Iâ€™m preparing an Android version of Doodle, a small tool that turns a sentence into a simple drawing you can copy onto a note or card.

Iâ€™m looking for Android users who would try it, tell me whatâ€™s confusing or broken, and stay opted in to a Google Play closed test for at least two weeks. The useful feedback is whether you can make a doodle, save/share it, and easily start a different idea.

Interested? Let me know what Android phone you use. Iâ€™ll send the official Google Play test link when the build and testing group are ready.

This is draft copy only. Sending invitations, publishing recruitment posts, collecting contact details or promising reciprocal testing needs explicit authorization for those actions and destinations.

## Meaningful test tasks

1. Join using the official opt-in link and install through Google Play with the same account. Record device and Android version.
2. Use an example prompt. Report how long generation feels and whether progress/error messages make sense.
3. Download a result and find the saved image. Share through an app the tester chooses; do not require messaging a particular person.
4. Choose â€œDraw something else.â€ Confirm it is easy to find, clears the prompt and lets the tester enter a different idea without spending a generation immediately.
5. Choose â€œRedraw this ideaâ€ only within the test allowance; confirm the prompt is reused and usage changes correctly.
6. Test rotation, smaller screens, text scaling, screen reader focus, leaving/returning to the app, and a temporary network loss.
7. Exercise sign-in, allowance exhaustion, account deletion and Play test purchases once those Android features are actually implemented. Use licensed test transactions rather than charging testers.
8. Report findings in a private feedback channel, test the fixes, and remain opted in throughout the required period. Do not claim testing occurred when it did not.

Keep an honest feedback log: date, version, device, steps, expected/actual result, severity, fix, and retest. Use that record for Google's production-access questions.

## Official references

- Account types: https://support.google.com/googleplay/android-developer/answer/13634885
- Personal-account testing requirements and recruiting guidance: https://support.google.com/googleplay/android-developer/answer/14151465
- Test-track setup: https://support.google.com/googleplay/android-developer/answer/9845334
- Registration fee: https://support.google.com/googleplay/android-developer/answer/6112435

## Historical recruitment destination â€” 7 September 2026

The 7 September thread at https://www.reddit.com/r/GooglePlayDeveloper/comments/1w3dx60/weekly_tester_discovery_thread_find_testers_help/ was checked previously and is superseded by the current 8 September thread in the route section above. No tester was contacted. The invitation remains unpublished pending the closed-track link and explicit owner authorization.

## Pre-submission tester source verification: 8 September 2026

- The Google Group `Doodle Android Testers` is live at https://groups.google.com/g/doodle-android-testers-2026. The rendered member list shows 2 members: the owner account and `doodlereview889@gmail.com`. Pending members shows 0.
- Play Publishing overview still shows `Submit 1 change for review`. The pending change is `Testers: Set testers to be managed by Google Groups: doodle-android-testers-2026@googlegroups.com`. The group source is saved but is not approved or live for tester access yet.
- The existing Reddit comment remains at https://www.reddit.com/r/GooglePlayDeveloper/comments/1w9s9pl/comment/p8jkjvm/. It was saved with four spaced paragraphs, a native clickable `Request to join the tester group` link, and the truthful note that the install link will be shared after Google approves the group update. No install link was shown while review is pending.
- Visual verification was performed on the rendered Reddit comment after save. No literal Markdown syntax or wall of text remained.

## Alpha tester source review submission: 8 September 2026

- At 2026-09-08 15:58:20 +02:00, the owner Console showed exactly one pending change: Closed Alpha testers managed by Google Groups at `doodle-android-testers-2026@googlegroups.com`.
- The owner submitted that single change through the confirmation dialog. Publishing overview now shows `Changes in review` and `1 change sent for review`.
- The group remains live at https://groups.google.com/g/doodle-android-testers-2026 with 2 members and 0 pending members. The owner is Owner and `doodlereview889@gmail.com` is Member.
- The tester source is now submitted for review, but tester access is not yet approved. The official opt-in URL remains `https://play.google.com/apps/testing/nl.samistudio.doodle`.


## Prepared tester welcome and feedback checklist: 8 September 2026

Status: draft only. Do not send until the submitted Google Groups tester source is approved and the opt-in path is live.

### Welcome draft

Thanks for helping test Doodle. Please request access to the private tester group first. Once the request is approved, opt in through Google Play and install Doodle with the same Google account. Please stay opted in for the full 14 days.

You can start with two free doodles, so no purchase is needed. Try a couple of small ideas for a card, lunchbox note, or journal. Check that you can download a doodle and open the downloaded image. You can also try the share button and check whether your remaining doodles are easy to find. Come back to the app during the test and tell us if anything stops working. There is no need to generate something every day or buy credits.

### Feedback checklist

Please answer these three questions after trying the app:

1. What did you try, and what were you hoping to make?
2. What was confusing or harder than expected?
3. What broke, failed, or produced an unexpected result?

Your phone model and Android version are useful but optional. Please do not include personal data or your Google account email in public feedback.

### Owner record

Record tester reported opt-in dates with a clear label, the Play account count, the group membership evidence, and the feedback received. An individual opt-in date may not be visible in Console, so keep the tester report separate from Console evidence. Google production access requires at least 12 testers to remain continuously opted in for 14 days. Group creation and review submission do not start that clock. Do not invent a start date, claim that a tester completed 14 days without evidence, or promise Google approval. The Google Groups source change was submitted at 2026-09-08 15:58:20 +02:00 and remains pending review.


## Latest tester recruitment verification: 8 September 2026, 16:13 +02:00

- Play Publishing overview currently shows `Changes in review` for the Closed Alpha tester source change. The listed item is `Set testers to be managed by Google Groups: doodle-android-testers-2026@googlegroups.com`. The change is not approved yet, so the install link remains withheld from the recruitment comment.
- The live group at https://groups.google.com/g/doodle-android-testers-2026 shows 2 members: `samicodesit@gmail.com` as Owner and `doodlereview889@gmail.com` as Member. Pending members shows 0.
- The existing Reddit comment remains at https://www.reddit.com/r/GooglePlayDeveloper/comments/1w9s9pl/comment/p8jkjvm/. The thread currently shows 3 comments and no reply under Doodle's comment. Its native tester-group link and approval-pending note remain unchanged.

## Latest tester recruitment verification: 8 September 2026, 16:28 +02:00

- Play now shows the submitted Google Groups change as published. Closed Alpha is Active with release `0.1.0 - Doodle closed QA`, Google Groups selected, and `doodle-android-testers-2026@googlegroups.com` listed as the tester source. The Console shows no unpublished changes.
- The owner account's official opt-in page at https://play.google.com/apps/testing/nl.samistudio.doodle renders `Doodle: Little Drawing Ideas` and `You are a tester.` This verifies the current member path for the owner account. A fresh outsider account was not tested.
- The group at https://groups.google.com/g/doodle-android-testers-2026 has 2 members and 0 pending members. Group settings now show `Anyone on the web can join`, group visibility `Group members`, conversations visible to group members, and member email visibility retained at the existing manager-only level.
- The existing Reddit comment at https://www.reddit.com/r/GooglePlayDeveloper/comments/1w9s9pl/comment/p8jkjvm/ was edited in place. It now has four short paragraphs, a native `Request to join the tester group` link to https://groups.google.com/g/doodle-android-testers-2026/about, and a native clickable `Opt in and install through Google Play` link to https://play.google.com/apps/testing/nl.samistudio.doodle, followed by the same-account instruction. The rendered post was checked after save. No new volunteer replies were present and no membership approvals were needed.

## Reddit tester post delivery: 8 September 2026

- The one authorized post is live at https://www.reddit.com/r/droidapptesters/comments/1waq5bx/looking_for_android_testers_for_doodle_a_little/ with title `Looking for Android testers for Doodle, a little drawing app` and the `Beta Test` flair.
- The live post was visually inspected in the subreddit feed and on its direct page. The rendered DOM contains three separate paragraph blocks, with no literal Markdown syntax or wall of text. No held or blocked status appeared.
- The first CTA is native clickable text `Join the tester group` with destination https://groups.google.com/g/doodle-android-testers-2026/about. The second is native clickable text `opt in and install through Google Play` with destination https://play.google.com/apps/testing/nl.samistudio.doodle.
- The post states the three requested paragraphs and the same-account instruction. The post is published and visible; tester participation remains unmeasured.

## Latest group visitor access verification: 8 September 2026, 18:46 +02:00

- The live Google Group at https://groups.google.com/g/doodle-android-testers-2026 now has `Anyone on the web` selected for who can see the group and `Anyone on the web can join` selected for who can join.
- Privacy remains restricted: conversations and members are limited to group members, and member email visibility remains at the existing manager-only setting. The group shows 2 members and 0 pending members.
- A separate public browser context was unavailable to the agent, so a non-member visitor landing was not tested directly in the agent session. The earlier owner view had shown the group unavailable while visibility was member-only. The exact public group URL is therefore recorded as configured.
- The owner account still reaches the official opt-in page at https://play.google.com/apps/testing/nl.samistudio.doodle and sees `You are a tester.`

## User-reported group visitor verification: 8 September 2026

- The user tested the recruitment route from another email account and reported completing the sequence through the canonical About URL https://groups.google.com/g/doodle-android-testers-2026/about: Google sign-in, group join, then Play opt-in. This is user-reported end-to-end verification; the agent did not operate that account.
