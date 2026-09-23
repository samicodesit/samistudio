# Google Play Console current checkpoint

Updated September 8, 2026.

This is a read-only record of the current official Android Publisher API staging state. It is separate from historical Play Console UI notes in `docs/play-store-listing.md`; it does not claim that earlier Console-saved changes were lost or replaced.

## Ephemeral API edit

- Package: `nl.samistudio.doodle`
- Language: `en-US`
- Listing: `Doodle: Little Drawing Ideas`
- Short description: 71 characters
- Full description: 1,290 characters as staged, including product URL `https://doodle.samistudio.nl`
- Icon: 1 staged item; source `store-assets/play-icon-512.png`; SHA-256 `c69929d0d3f36ce2d6b2c5c80870a5cdbca211577d30258b170ddb56809da169`
- Feature graphic: 1 staged item; source `store-assets/feature-graphic.png`; SHA-256 `0866e0861a73dd5014caa571d6b78c14a4d6e76507c24759dec9d0e79408ba79`
- Phone screenshots: 4 staged items, in order Result (`04-result.png`), Create (`01-create.png`), Ideas (`02-ideas.png`), View larger (`05-larger.png`); API SHA-256 values matched each local source.

The edit ID is stored privately at `/tmp/doodle-play-api-edit.json` with restrictive permissions and is not repeated here. The edit has not been committed, sent for review, published, attached to a track, or used for a purchase.

## API checks and limitation

Listing and image uploads returned HTTP 200, and subsequent listing/image reads returned the staged fields and counts above. `edits.validate` returned HTTP 403 `PERMISSION_DENIED` for the existing service account, so API validation is unresolved and no permission change was made. One protected `edits.commit` attempt used `changesNotSentForReview=true` and `changesInReviewBehavior=ERROR_IF_IN_REVIEW`; it returned HTTP 400 `INVALID_ARGUMENT` with the message that changes are sent for review automatically and `changesNotSentForReview` must not be set. After explicit owner approval to submit, the staged edit and hashes were rechecked successfully, then one commit attempt using only `changesInReviewBehavior=ERROR_IF_IN_REVIEW` returned HTTP 403 `PERMISSION_DENIED`. No commit, review submission, release or track change succeeded, and no fallback parameters were attempted. The official API documentation describes `edits.validate` as a validation call and `edits.commit` as the commit boundary.

The September 7 Console records in the listing draft remain the authoritative historical record of what was visually saved in the Console UI at that time. This API checkpoint records only the later ephemeral edit and does not establish current public visibility.

## Console UI save and review checkpoint â€” September 8, 2026

- In the owner Console UI for app `4973301025063263916`, the Default store listing was saved as a draft with the English title `Doodle: Little Drawing Ideas`, the approved 71-character short description and the 1,290-character full description ending in `https://doodle.samistudio.nl`.
- The rendered review screen showed the existing app icon and feature graphic plus four phone screenshots, in order: Result (`04-result.png`), Create (`01-create.png`), Ideas (`02-ideas.png`), View larger (`05-larger.png`). The editor showed `4 / 8` and no phone-asset validation error. The saved draft produced the Console toast `Draft saved` and the status `Change saved. Send for review in Publishing overview.`
- The four matching local upload-folder files were verified by SHA-256: `04-result.png` `9C1FCC49A7E75F449B7DFD8972A21596210D6F5201529151BE3081466459BF1F`; `01-create.png` `DB7F2D957B1CC3CB6ADFA55DE0CD930BAB34C6954567B91A68AF9580982B2D0E`; `02-ideas.png` `0F70903710CAB21F66B5C10FA88A8435EA3DA67E68C48FE91F16FE7FF4A6DB5A`; `05-larger.png` `71017304FBE1E65E46C19D06B3075163E28288CA0EADEADA095265613BB30E19`.
- Publishing overview visibly lists the store-listing change under â€œChanges not yet submitted for review.â€ `Send app for review` is disabled because required dashboard steps remain. The overview also shows pending Privacy policy, Ads declaration, Health apps, and App category items, plus previously reported government-apps and financial-features declarations. No send-for-review action was taken.
- The service accountâ€™s Doodle app permissions remained unchanged: View app information, View app quality information (read-only), View financial data, and Manage orders and subscriptions; `Manage store presence` and release/admin permissions remain unchecked.

## Reviewer access and setup checkpoint â€” September 8, 2026

- Reviewer account `doodlereview889@gmail.com` is registered. The password was
  user-confirmed and is stored encrypted outside the repository at
  `C:\Users\Sami\.codex\private\doodle-review-account\`; the credential itself
  is not recorded in project documentation.
- In the owner account's Users list, the reviewer is selected for internal and
  license testing. The reviewer opted in to the install page.
- App access is saved in the owner Console for `doodlereview889@gmail.com` with
  reviewer-only sign-in details and the literal checkbox `Sign in details in
  this declaration provide full access to all the features and content within
  this app, including premium or paid content` checked. The password is not
  recorded here. Full access is supported by the user's report of a successful
  license-test purchase adding 10 doodles; the transaction was not observed by
  this agent.
- Target audience is saved as `18 and over`.
- The Data safety editor produced the Console toast `Change saved. Send for
  review in Publishing overview.` after the truthful questionnaire mapping was
  entered, but the current Publishing overview still lists `Complete Data safety
  questionnaire`. Treat its final review status as unresolved until that
  overview row clears; no unsupported declaration is claimed here.
- Content ratings are saved: All other online content and Digital goods;
  PEGI 3, ESRB Everyone, and USK All ages.
- Vercel Pro is confirmed. The eight-row Data safety mapping uses the aggregate
  Device/other IDs row for the observed browser/device security signals,
  including fraud prevention, security, and compliance purposes where
  applicable; no separate BotID data claim is made. The current overview still
  carries the Data safety questionnaire row described above.
- The existing email list `Doodle owner testing` contains exactly two users,
  `samicodesit@gmail.com` and `doodlereview889@gmail.com`, and is selected for
  Closed testing - Alpha. Countries/regions are saved as `Targeted (177)`.
- The reviewable Closed testing - Alpha release was submitted for Google review
  at `2026-09-08 14:37:35 +02:00` after the owner-approved confirmation. It is
  release `0.1.0 - Doodle closed QA`, version code `1`, version `0.1.0`, API
  `23+`, target SDK `36`, screen layouts `4`, ABIs `All`, required features
  `1`, and 958 KB new-install size. Release notes are the en-US block
  describing create-from-scene, Ideas, view/save/share, and the 10-doodle
  license-test pack. The Publishing overview shows `Changes in review` and
  `14 changes sent for review`; the Alpha track shows `Active` and
  `Release 0.1.0 - Doodle closed QA in review`.
- Before submission, the overview listed `Submit 14 changes for review` and
  the Alpha rows `Add 176 countries / regions`, `Add rest of world`, `Unsync
  from production`, `Resume track`, and `Set testers to be managed by email
  lists: Doodle owner testing`. No rollout control was clicked. The Console
  still shows the temporary app name `nl.samistudio.doodle (unreviewed)`.
  The reviewer web opt-in URL is
  `https://play.google.com/apps/testing/nl.samistudio.doodle`; the Android
  listing URL is `https://play.google.com/store/apps/details?id=nl.samistudio.doodle`.
No blocking error appeared during submission.

## Latest live Console verification â€” September 8, 2026

- Publishing overview now shows `Last published on September 8, 2026` and no
  pending changes. Submission activity shows submission `1` as `Published` for
  the changes covering Closed testing - Alpha, Store Listing, App Content, and
  Store settings. The historical submission timestamp remains
  `2026-09-08 14:37:35 +02:00`; the activity table displays a rounded UI time
  and is not reconciled here.
- Closed testing - Alpha is `Active`. Release `0.1.0 - Doodle closed QA` is
  `Available to selected testers`, with one version code, released September 8
  at 14:46, and available in 177 countries/regions.
- The `Doodle owner testing` email list contains two users, while the Dashboard
  reports `0 testers currently opted-in` toward the required `12`. Production
  is `Inactive`, and the 14-day closed-test requirement has not started.
- Grow users > Store listings reports `Default listing active`.

Policy-blocked launch rule: stop after the block; do not retry the same launch
through Run, Explorer, shell, or another tool.

## Tester group verification: September 8, 2026

- Google Group creation completed after the owner finished the CAPTCHA. The
  rendered group page shows `Doodle Android Testers` with 1 member at
  `https://groups.google.com/g/doodle-android-testers-2026`.
- Saved group settings show group visibility limited to group members, joining
  set to `Anyone on the web can ask`, and member email addresses visible only
  to group managers.
- The Alpha Testers panel exposes Email lists and Google Groups as mutually
  exclusive sources. Email lists remains selected with `Doodle owner testing`
  and 2 users. Google Groups was selected only to inspect its form, then
  discarded. No Alpha source, track, release, or publishing state changed.
- The official Play opt-in URL remains
  `https://play.google.com/apps/testing/nl.samistudio.doodle`. The group is
  not attached to Alpha, and no recruitment post was published because the
  attached tester source is still unresolved.
- A direct-add attempt for `samicodesit@gmail.com` and
  `doodlereview889@gmail.com` opened a fresh Google Groups `Captcha required`
  dialog. The entries remain staged in persistent Chrome tab `1554977938`,
  while the group still visibly has 1 member. No Alpha change was made.

## Pre-submission tester source verification: 8 September 2026

- The live Google Group `Doodle Android Testers` has 2 members: `samicodesit@gmail.com` as Owner and `doodlereview889@gmail.com` as Member. The group page is https://groups.google.com/g/doodle-android-testers-2026. Pending members is 0.
- Publishing overview still shows `Submit 1 change for review`. The only listed pending change is `Set testers to be managed by Google Groups: doodle-android-testers-2026@googlegroups.com`. This proves the source is saved in the review queue, not yet approved for live tester access.
- The existing Reddit comment at https://www.reddit.com/r/GooglePlayDeveloper/comments/1w9s9pl/comment/p8jkjvm/ is saved and visually verified. It has four spaced paragraphs and a native link labeled `Request to join the tester group` pointing to the group URL. The install link is omitted until Google approves the pending group update.

## Alpha tester source review submission: 8 September 2026

- At 2026-09-08 15:58:20 +02:00, the owner Console preflight showed exactly one pending item for app `4973301025063263916`: `Set testers to be managed by Google Groups: doodle-android-testers-2026@googlegroups.com`.
- The owner submitted that single change. The resulting Publishing overview shows `Changes in review` and `1 change sent for review`; no production, pricing, release, or unrelated item was changed.
- The group membership check after submission shows 2 members: `samicodesit@gmail.com` as Owner and `doodlereview889@gmail.com` as Member. Pending members is 0.
- The group source is submitted for review and is not yet confirmed approved for external tester access.


## Latest tester recruitment verification: 8 September 2026, 16:13 +02:00

- Live Play Publishing overview shows `Changes in review` for the single Closed Alpha tester-source item: `Set testers to be managed by Google Groups: doodle-android-testers-2026@googlegroups.com`. The group-source change is still pending review and is not confirmed live for external tester access.
- Google Group `Doodle Android Testers` at https://groups.google.com/g/doodle-android-testers-2026 shows 2 members: `samicodesit@gmail.com` as Owner and `doodlereview889@gmail.com` as Member. Pending members shows 0.
- Existing Reddit comment https://www.reddit.com/r/GooglePlayDeveloper/comments/1w9s9pl/comment/p8jkjvm/ remains saved with its native group link and approval-pending install note. The thread shows no new reply under the comment, so no edit was made.

## Latest Alpha tester access verification: 8 September 2026, 16:28 +02:00

- Publishing overview now shows the Google Groups Alpha tester-source change published, with no unpublished changes. The Active Alpha track serves release `0.1.0 - Doodle closed QA` and the Testers tab shows Google Groups selected with `doodle-android-testers-2026@googlegroups.com`.
- The owner account can open https://play.google.com/apps/testing/nl.samistudio.doodle and sees `Doodle: Little Drawing Ideas` and `You are a tester.` This confirms the current member eligibility path for that account. A fresh outsider account was not tested.
- Google Group `Doodle Android Testers` has 2 members and 0 pending members. The saved join policy is `Anyone on the web can join`; group visibility remains `Group members`, conversations remain limited to group members, and member email visibility remains at the existing manager-only setting.
- The existing Reddit comment https://www.reddit.com/r/GooglePlayDeveloper/comments/1w9s9pl/comment/p8jkjvm/ was edited and saved in place. Rendered verification shows the original group link plus a native clickable `Opt in and install through Google Play` link to https://play.google.com/apps/testing/nl.samistudio.doodle and the same-account instruction. No new replies or pending join requests were present.

## Latest group visitor access verification: 8 September 2026, 18:46 +02:00

- Google Group `doodle-android-testers-2026@googlegroups.com` is configured with `Anyone on the web` for group visibility and `Anyone on the web can join` for joining.
- Conversations and members remain limited to group members. Member email visibility remains at the existing manager-only setting. Current group count is 2 members and 0 pending members.
- A separate public browser context was unavailable, so non-member visitor rendering was not directly verified. The owner view had previously shown the group unavailable when group visibility was member-only. The public group URL is recorded, with visitor rendering still unverified.
- The owner account continues to see `You are a tester.` at https://play.google.com/apps/testing/nl.samistudio.doodle.

## Latest native release and tester service status: 10 September 2026

- Closed testing - Alpha is active with release `3 (0.1.1)` available to selected testers, released on 10 September 2026, across 177 countries and regions.
- The existing paid Testers Community Starter submission is active. Its dashboard shows `Doodle: Little Drawing Ideas`, Day 0 of 16, 0% complete and reports pending.
- The submitted form uses the official Play opt-in URL and Doodle icon. It states that no app login is required, two doodles are free, testers should use their own Google account, and no purchase is required. A shared reviewer password is not supplied.
- Testers Community's purchase guide says its testers can use Google's simulated test cards when the service Google Group is added to the account-level Play Console License testing page. The group is already in the Closed Alpha tester source, but the License testing page still has only the owner email list selected. The active brief therefore covers the free and core flows only. Paid purchase coverage remains a separate setup step.

## Current closed-test progress: 10 September 2026, 20:21 CEST

- Testers Community's active Starter run reports 15 of 15 testers, Day 1 of 16, 0% complete and 0 of 2 reports ready. Both reports are pending and no tester failures or messages are shown.
- Play Console marks the task `Have at least 12 testers opted-in to your closed test` as completed. Its current UI does not expose the exact opted-in count or individual opt-in dates in this view. The separate 14-day closed-test task remains incomplete.
- The account home metric `Installed audience 0` is not treated as an opt-in count. The account banner says all apps are registered for Android developer verification. Notifications show the 10 September app update published notice and the 7 September identity verification success notice.
- Closed Alpha is active with release `3 (0.1.1)` serving. The tester source contains both `testers-community@googlegroups.com` and `doodle-android-testers-2026@googlegroups.com`. Play displays non-blocking next-release guidance about deprecated edge-to-edge APIs and large-screen resizability.
