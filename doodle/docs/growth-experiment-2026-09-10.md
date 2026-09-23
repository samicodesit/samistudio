# Growth experiment record, 2026-09-10

## Goal and audience

Attract real web users before the Play launch. The intended audience is people making personal cards, lunch notes, and journal pages. The test is for useful drawing inspiration, with no claim of guaranteed reach or virality.

## Baseline

- Vercel, September 3-10: 63 visitors, 153 views, 57% bounce rate, 25 creation events, 3 shares, and 5 downloads. The downloads include our testing.
- Referrers in the same window: Reddit 3 visitors and Instagram 2 visitors.
- Pinterest Business was enabled free on September 10. Historic Pinterest reach is unknown, so zeroes are not evidence of past performance.

## Evidence and channel screen

The following firsthand growth reports are self-reported and are dated for context, not treated as proof of causality:

- [Recite TikTok slideshow report](https://www.reddit.com/r/iOSAppsMarketing/comments/1rfuro1/how_i_got_4m_views_and_2000_signups_for_my_app/), February 27, 2026: 4.4M views, 2,000+ signups, and $0 claimed by the founder.
- [Reflect journal Reddit report](https://www.reddit.com/r/SideProject/comments/1tsvpk7/from_27_to_72_installs_in_5_days_one_reddit_post/), May 31, 2026: 27 to 72 downloads, with one post credited for 17 installs in a day.
- [Dancer app TikTok carousel report](https://www.reddit.com/r/Solopreneur/comments/1sn2rp0/almost_by_accident_ive_created_a_tool_for_solo/), April 16, 2026: 85 carousels in 37 days and roughly 30-50 downloads per day claimed by the founder.

Rejected for this experiment: PlannerAddicts because the opportunity is a roughly three-year-old thread; r/ProductivityApps because its current rules prohibit vibe-coded apps and tester requests; r/bulletjournal because self-promotion and explicit social links are discouraged; r/DigitalArt because AI-generated images are prohibited; cardmaking, journaling, crafts, and parenting communities because their rules restrict the relevant promotion. No current audience-matched free community opportunity is established.

## Publication and limits

- One thank-you Pin was published on September 10 to the existing `Easy Doodle Ideas for Cards & Notes` board: [Easy thank-you card drawing: a little mug and note](https://www.pinterest.com/pin/703476404341546869/).
- The published asset is the existing public `public/ideas/thank-you-mug.webp`, showing a mug beside a folded thank-you card and heart envelope. The Pin was visually inspected after publication. Its title, description, alt text and Pinterest `AI modified` disclosure were saved and read back.
- The live `Visit site` destination was verified as `https://doodle.samistudio.nl/?scene=A%20steaming%20mug%20beside%20a%20folded%20thank-you%20note%20with%20a%20tiny%20heart%20on%20it&utm_source=Pinterest&utm_medium=organic&utm_campaign=small_moments&utm_content=thank_you_mug#composer`.
- The prepared vertical marketing PNG was not used for this Pin. At publication time it remained unavailable at its hosted path, so no claim is made that that asset was published as part of the Pin.
- Safe UTM forwarding is included in the production deployment recorded below. Full-funnel paid UTM detail is currently unavailable.
- A secondary web card experiment is in progress with no charges and a private client message. Its virality hypothesis is unproven.

## Live production spot-check, September 10, 2026

- At 23:33 CEST, the live production site was opened through the published Pin destination with the exact prompt `A steaming mug beside a folded thank-you note with a tiny heart on it`.
- The signed-in session showed 10 doodles left before generation and 9 after one successful generation. The rendered result showed a clear mug, steam and folded note with a heart. No second generation or purchase was made.
- The result's `More options` menu currently exposes `Redraw this idea` and `Report this doodle`. `Make a card` was not present in the production build, so the card creation and card download flow remains unverified until that feature is deployed.

## Final live card QA, September 10, 2026

- After deployment `dpl_Cff6Toh2EaWEEEx6EZC1hseKeHqi` was verified through the production alias. The earlier result was not retained after reload, so one final authorized generation used the exact thank-you prompt above. The signed-in balance changed from 9 to 8, and the result visibly matched the mug, steam, folded note and heart scene.
- The result `More options` menu exposed `Make a card`. The card dialog opened with its heading focused and did not open the software keyboard. The exact message `A little warmth for your day` was entered and the counter showed `28/80`.
- `Download card` created `C:\Users\Sami\Downloads\doodle-card.png` at 221,146 bytes. The PNG was opened and visually checked. It showed the result and message clearly with no clipping or corruption.
- Closing the dialog returned to the result and the balance stayed at 8. Opening, editing, downloading and closing the card caused no additional generation or credit deduction. The desktop dialog also exposed `Share card`; that native share action was not exercised in this check. The browser download event did not surface within its ten-second wait, but the file was present in Downloads and was validated directly.

## Combined web deployment

- The reviewed web changes were deployed to production on September 10 as Vercel deployment [`dpl_Cff6Toh2EaWEEEx6EZC1hseKeHqi`](https://vercel.com/ahmed-samis-projects-e6ef0336/doodle/Cff6Toh2EaWEEEx6EZC1hseKeHqi), at [`doodle-jqaybikay-ahmed-samis-projects-e6ef0336.vercel.app`](https://doodle-jqaybikay-ahmed-samis-projects-e6ef0336.vercel.app) and the production alias [`doodle.samistudio.nl`](https://doodle.samistudio.nl/).
- The deployment contains the reviewed local card composer and canonical PNG preview/export flow, Arabic word-aware wrapping with explicit newline support, grapheme-safe 80-character input, dialog heading focus, full Web Share payload checks, and inline share errors. It also contains the reviewed safe UTM forwarding and analytics redaction changes, the existing medium image-quality profile, and the approved thank-you pin asset.
- Card analytics record only `Doodle Card Opened`, `Doodle Card Download Requested`, and successful `Doodle Card Shared` events. They carry no prompt, message, image, or user identifier. No new audience or conversion result is claimed from QA.
- Local validation passed: the production build completed, 18 focused card/result tests passed, 6 attribution tests passed, TypeScript passed, and scoped lint reported zero errors with two existing Next image warnings.
- Final controlled-fixture evidence is saved as [mobile composer](../marketing-assets/growth-2026-09-10/final-card-composer-mobile-360x844.png), [Arabic composer](../marketing-assets/growth-2026-09-10/final-card-composer-arabic-360x844.png), [mobile export](../marketing-assets/growth-2026-09-10/final-card-export-mobile-1200x1500.png), and [Arabic export](../marketing-assets/growth-2026-09-10/final-card-export-arabic-1200x1500.png). These used the existing `public/ideas/thank-you-mug.webp` fixture and no paid generation.
- Public checks after deployment returned HTTP 200 for the home page, `/doodle-ideas`, and the hosted pin. The pin returned `image/png`, 357,766 bytes, SHA-256 `90bad1548b54a9a1ca8981d2eca974e313b7a9b2551ac385e062901e4b76381a`. Native config returned HTTP 200 with enabled Play Integrity, package `nl.samistudio.doodle`, and minimum version code 2. Unauthenticated `/api/play/config` returned HTTP 401 as required.
- The deployment makes source and card events measurable, but no source-to-creation result is available yet because Vercel paid UTM filters remain unavailable. Continue using the decision rule above before expanding the experiment.

## Channel inventory, September 11, 2026

- X is signed in as `@TheXSami`. The profile showed 72 posts, 35 following and 16 followers. The visible Doodle post from August 22 showed 3 likes and 69 views. The compose surface and photo upload controls were available, so posting capability is confirmed, but the current audience is small and the existing Doodle post has limited visible reach.
- Instagram is signed in as `the.sami.xyz`. The profile showed 1 post, 359 followers and 412 following, with a `New post` control available. No Doodle post or Doodle-specific audience signal was visible on the profile during this inventory.
- TikTok opened its home feed, but no signed-in profile, follower count or posting control was exposed. A logged-in TikTok account and its publishing capability therefore remain unconfirmed.
- The connected Metricool brand returned no connected network data. It cannot currently provide a publishing or cross-channel analytics route for these accounts.
- No post was published during this inventory. Campaign execution is paused for audience and distribution review. The personal Instagram account is excluded from Doodle promotion by the owner's explicit boundary. The next campaign choice should weigh only an audience and account that the owner has designated for Doodle, against a measurable stranger-to-creation path. The existing Pinterest experiment remains the only published Doodle growth asset.

## Final demo artifact QA, September 11, 2026

- The reviewed pilot is [the 9:16 MP4](../marketing-assets/growth-2026-09-10/doodle-thank-you-card-demo-10s.mp4), with [poster](../marketing-assets/growth-2026-09-10/doodle-thank-you-card-demo-10s-poster.png), [contact sheet](../marketing-assets/growth-2026-09-10/doodle-thank-you-card-demo-10s-contact.png), and [manifest](../marketing-assets/growth-2026-09-10/doodle-thank-you-card-demo-10s.json). The encoded file is 1080x1920, H.264, 30 fps, silent, and 9.8 seconds long.
- Frame review confirmed the same `qa-stability/card-export-exact.png` mug card export is shown first and last. The middle shot is the isolated production composer capture, with `A little warmth for your day` visible in the field and card preview. Loaded-font QA reports custom Bricolage Grotesque and IBM Plex Sans for the branded overlay.
- The composer capture replays the production UI with the existing gallery mug fixture and made no provider request or paid generation. It demonstrates the card editing and export presentation, not live generation speed, provider output, or backend generation quality. The separate live production check above remains the evidence for the deployed flow.

## YouTube pilot publication, September 11, 2026

- A separate YouTube channel was created for Doodle under the existing Google account. The requested display name `Doodle` was rejected by YouTube, so the channel uses the fallback display name `Doodle Sami Studio` with the available handle [`@DoodleSamiStudio`](https://www.youtube.com/@DoodleSamiStudio). The verified channel URL is [`youtube.com/channel/UC8PfdsOci8uODRZovDzM70w`](https://www.youtube.com/channel/UC8PfdsOci8uODRZovDzM70w). The existing Ahmed Sami and All Things Interesting channels were not modified.
- The channel profile uses the existing `mobile/assets/doodle-icon.png` asset as its picture. The published description is: `Small drawing ideas for cards, lunchbox notes and journals. Describe a scene, make it your own, and download or share it.` The profile link label is `Try Doodle`, and its verified destination is `https://doodle.samistudio.nl/`.
- One reviewed Short was uploaded and published publicly from the Doodle channel: [A tiny drawing for a thank-you card](https://youtube.com/shorts/w1BRvPWQa70). Its description is `A little drawing and a message of your own. Make a card with Doodle.\n\nTry it through the link on our channel.` The video was classified as not made for kids. YouTube's upload checks reported `No issues found`, and the live Short was visually inspected. The live page showed the Doodle handle, the card and mug scene, the in-video `Try Doodle` CTA, and the `doodle.samistudio.nl` destination text.
- YouTube's [official link guidance](https://support.google.com/youtube/answer/13748639) states that URLs in Shorts descriptions and comments are non-clickable, while channel profile links are clickable. The Short therefore directs viewers to the clickable `Try Doodle` profile link rather than relying on a clickable URL in the Short description.
- This is a single public pilot publication. No additional post, ad, purchase, or personal Instagram/Facebook promotion was made. Reach, clicks, and downstream creation are not yet measured, so no growth result is claimed.

## Future Tools submission, September 11, 2026

- The owner reported that a Future Tools submission had already been made shortly before this browser handoff. During the handoff, the empty form at [futuretools.io/submit-a-tool](https://futuretools.io/submit-a-tool) was filled with the approved Doodle details, including the `Generative Art` category, `Freemium` pricing, and the project email. The newsletter option remained unchecked.
- The agent clicked `Submit Tool` once at approximately 10:46 CEST, before receiving the owner's stop instruction about the earlier submission. The page first showed `Submitting...`, then displayed `Tool Submitted!` and `Thanks for submitting your tool. Matt will review it and, if approved, it will appear in the database soon.` The confirmation was visually inspected in the rendered page.
- This receipt confirms that one submission was accepted for manual review by the form. Because the owner had already submitted shortly beforehand, it may be a duplicate. No approval, listing, traffic, or conversion is claimed. No retry or second submission was made.

## Product Hunt launch, September 11, 2026

- The Product Hunt draft at [producthunt.com/posts/doodle-4/edit](https://www.producthunt.com/posts/doodle-4/edit) was cleaned of the obsolete gallery and saved with exactly three reviewed PNGs in this order: [birthday card idea](../marketing-assets/product-hunt-2026-09-11/final/01-birthday-card-idea.png), [current Doodle flow](../marketing-assets/product-hunt-2026-09-11/final/02-current-doodle-flow.png), and [lunchbox card output](../marketing-assets/product-hunt-2026-09-11/final/03-lunchbox-card-output.png). Their verified SHA-256 values are `aff7f253e226e82c7e4c95c02dca4ff65281ffb909ce57d7d7715c6d0ffc9e1d`, `c24831e399e41305d0d368d4f7a78225fac28fa24fedddbd9738e32e37f18ed7`, and `e1f3df759b34059d14629f0b9d5471d38a48437fe2d24b325870eecfd1ab1de8`.
- The saved editor was visually checked with the birthday card as the main preview, followed by the Doodle flow and lunchbox result. The form retained the name `Doodle`, tagline `Little drawing ideas for cards and notes`, destination `https://doodle.samistudio.nl`, approved description, `Drawing` launch tag, and `Paid (with a free trial or plan)` pricing. No mobile preview control or maker comment field was available in the editor, and the optional video field remained empty.
- Product Hunt required a future date. The owner authorized the earliest free option, so the launch was scheduled once for September 12, 2026 at 12:01 AM PDT (09:01 CEST) for 24 hours. The post now shows `Scheduled` at the editor URL above. The public product URL is [producthunt.com/products/doodle-4](https://www.producthunt.com/products/doodle-4). It is scheduled and remains unpublished until the scheduled window.

## Current public and testing check, September 12, 2026

- The public [Product Hunt listing](https://www.producthunt.com/products/doodle-4) was checked after its scheduled window began. It renders `Launching today`, the approved Doodle tagline and description, `Visit website` to `doodle.samistudio.nl`, and the three approved gallery images in the intended birthday, Doodle flow, and lunchbox output sequence. It shows 1 follower and one visible Maker comment from Sami, posted 1d ago. The signed-in viewer control reads `Upvoted`, which is viewer state rather than a total vote count. No total vote or comment count was exposed in the public accessibility tree, so neither is claimed. No Doodle listing error was visible; the Customer.io block is an unrelated promoted item.
- The public [YouTube Short](https://youtube.com/shorts/w1BRvPWQa70) was checked on its watch page. It renders the 0:09 video under `Doodle Sami Studio`, with `87 views`, `1d ago`, and 0 likes visible. The Shorts surface showed `0` beside View comments; the regular watch page did not expose a comments total, so no comments count is asserted. The Doodle mug and card export, `Try Doodle` call to action, and `doodle.samistudio.nl` destination are visible. This is a single public pilot, not a growth result.
- Play Console was checked in developer account `5843530199260119810` for app `4973301025063263916` (`nl.samistudio.doodle`). Production is `Inactive`; the dashboard marks the closed release and the 12-tester requirement complete, but shows `12 testers have currently been opted in for 1 day`, so the continuous 14-day requirement is incomplete and `Apply for production` is disabled. The active Closed testing Alpha track serves release `3 (0.1.1)` to 177 countries and regions, released September 10 at 1:17 PM. The tester list is configured through two Google Groups, and the Play feedback URL or email field is blank. The current console has no unpublished changes.
- Play Console shows two next-release warnings for release `3 (0.1.1)`: migrate deprecated Android 15 edge-to-edge and window-display APIs, and remove resizability and orientation restrictions before Android 16 ignores them on large screens. These are actionable app follow-ups, separate from the current production-access gate. The immediate gate action is to keep at least 12 testers opted in continuously for 14 days, then complete the production-access questions.
- TestersCommunity campaign `Doodle: Little Drawing Ideas` was checked at its current page. It is `Active` and `In Progress`, submitted September 10, on the Starter plan, with 15/15 testers, 0/2 reports ready, and 1/16 days on the overview. Its Progress tab reports 11%, Day 2 of 16, 14 days remaining, and 15 actively testing. The overview and progress cards disagree by one day, so the detailed progress value is recorded with that limitation. Reports are pending until the service's day 7-10 window. Its instructions require no app login or purchase, two free doodles, 2-3 app updates during the 16-day period, and using the Production Access Report after day 14.
- The existing Vercel analytics dashboard was not readable in this check because the browser surface timed out while loading its current data. The dated September 3-10 baseline remains the only Vercel metric record; no fresh source, visitor, creation, or conversion result is claimed.

## YouTube birthday Short publication, September 12, 2026

- The second Doodle Short was published publicly from Doodle Sami Studio after the independent Max temporal review passed the supplied source hash. YouTube Studio confirmed `Video published` and `Published Sep 12, 2026` after the prepared private draft was changed to public. The public video is [Forgot the birthday card? Make it personal.](https://youtube.com/shorts/m3APUMuTKls).
- The public page was opened and inspected at `2026-09-12 13:25:18 +02:00`. It rendered the approved title under `@DoodleSamiStudio`, exposed the channel link, and loaded the video player. The channel page showed `2 videos`, included this Short, and retained the profile link destination `https://doodle.samistudio.nl/`. At the check, the Short showed 0 visible likes and 0 comments, while the channel listing showed `No views`; these are early observations, not a growth result.
- Upload source: `marketing-assets/birthday-short-2026-09-12/birthday-short-2026-09-12.mp4`. SHA-256: `4a0d42db69559fd27839ff9a86e3e2b29021c94f61030cd031a632d8f5f3544c`. The approved title, description, and `No, it's not made for kids` setting were retained. Studio checks reported `No issues found`.

## Decision rule

Assess meaningful outbound clicks and real use before expanding content. Do not count our QA, a new post alone, or an unverified download as growth. Do not set a fixed invented conversion target or promise viral results.

## Primary references

- [Pinterest organic Pin guidance](https://business.pinterest.com/en-gb/how-to-make-pins/)
- [Pinterest creative best practices](https://business.pinterest.com/creative-best-practices/)
- [Recite founder report](https://www.reddit.com/r/iOSAppsMarketing/comments/1rfuro1/how_i_got_4m_views_and_2000_signups_for_my_app/)
