# Doodle growth experiment — 7 September 2026

## Baseline

Vercel production analytics, last seven days (31 August–7 September), read 7 September before this deployment:

- 16 visitors, 26 page views, 63% bounce rate.
- `Doodle Created`: 3 visitors, 5 events.
- Referrers shown: LinkedIn 3 visitors, Bing 1, t.co 1.
- 44% mobile; 44% iOS.

This is a small sample and may include the owner and testing. Three creating visitors out of sixteen is a rough 19% observed activation rate, not a reliable conversion estimate. Bounce rate alone does not prove failure on a single-page tool.

## First experiment

Positioning: **A tiny drawing for someone you love.**

Keep two free doodles, then €4.99 for ten; no subscription. First improve sharing, then seek the first 100 attributable visitors. Do not buy traffic merely to exhaust the budget. Original budget ceiling was US$20 total; the owner later raised it to US$25 for the one-time Google Play registration fee. No advertising spend or card charge has been made. If that fee is paid, the entire current budget is used.

The new result button shares the generated PNG and a localized app link through supported native share sheets. Other browsers copy the app link, with a selectable link if clipboard access is denied. The link deliberately contains no scene, generated image URL, checkout ID or account data. Some destinations may omit parts of a native share payload; downloads remain available separately.

## Ready-to-publish launch copy

The owner explicitly authorized publishing the two Pinterest posts to the available account on 7 September. Other channel copy remains draft only. Do not post as an unaffiliated customer, invent testimonials, send unsolicited DMs, or duplicate posts across unrelated communities.

### Optional short-video caption (Instagram or TikTok)

The owner already posted on LinkedIn and prefers a different audience. Do not repeat that launch. Prioritize Pinterest; use this caption with a real creation demo if an Instagram/TikTok account is authorized.

I built Doodle over a weekend for a very small thing: making a drawing you can copy onto a note for someone.

Describe a tiny scene — a dog in a party hat, a cat with a heart — and it turns it into a simple AI doodle. Copy it by hand onto a birthday card or lunchbox note, or download and share it.

The first 2 doodles are free. After that, it’s €4.99 for 10, with no subscription.

What would you draw, and who would you leave it for?

https://doodle.samistudio.nl/?utm_source=instagram&utm_medium=social&utm_campaign=tiny_note_launch

Demo outline: show the finished birthday dog first; show its short prompt; show the generated result and Download/Share controls. End with “Who would you leave this for?” Clearly label any time-lapse rather than implying generation is instant. If posting to TikTok, change `utm_source` to `tiktok`. Use the actual app image, not a fabricated customer result. A hand-drawn note needs to actually be drawn before showing or claiming that step.

### Reddit r/SideProject: feedback post

Title: I built a tiny AI tool for drawings you can copy onto lunchbox notes and birthday cards

Body:

I made Doodle over a weekend. You describe one small scene and get a simple sticky-note drawing to copy by hand.

The intended use is a little note for someone — a birthday dog, a cat with a heart, that kind of thing. It uses AI to generate the reference; you can download it or use it as a guide for your own drawing.

You can try two doodles free without signing up. After that it’s €4.99 for ten, not a subscription. Generation can take up to two minutes.

I’d like feedback on whether the results are actually simple enough to copy, and what you’d use one for.

https://doodle.samistudio.nl/?utm_source=reddit&utm_medium=community&utm_campaign=tiny_note_launch

Check the community’s current sidebar/rules and any AI-content restrictions before posting. Publish once from the owner’s account, with appropriate disclosure and flair. Do not imply moderator endorsement.

### Pinterest: birthday idea

Title: An easy birthday doodle to copy onto a card

Description: A happy dog with a birthday balloon, ready to inspire a tiny card surprise. Use this AI-generated drawing as inspiration for a card you draw by hand. Try your own small scene with Doodle; the first two doodles are free.

Image: `public/ideas/birthday-dog.webp`

Destination: https://doodle.samistudio.nl/doodle-ideas?utm_source=pinterest&utm_medium=organic_social&utm_campaign=birthday_note

Published and verified on the public board: https://www.pinterest.com/pin/703476404341485239/

Pinterest's website-import composer locks the source URL, so the tracked gallery URL is used. The gallery includes this exact dog example and a “Try this idea” route into the generator.

### Pinterest: lunchbox idea

Title: A little lunchbox doodle to brighten someone’s day

Description: An easy high-five drawing for a lunchbox note. This example is AI-generated; copy the simple shapes by hand and add your own message. Doodle turns small scenes into drawing ideas. First two doodles free.

Image: `public/ideas/lunch-high-five.webp`

Destination: https://doodle.samistudio.nl/doodle-ideas?utm_source=pinterest&utm_medium=organic_social&utm_campaign=lunchbox_note

Published and verified on the public board: https://www.pinterest.com/pin/703476404341485279/

Pinterest is a testable audience hypothesis, not a proven channel for this app. Official guidance favors vertical 2:3 creative; existing square examples can be used for an initial organic post, then formatted if there is a signal. References: https://business.pinterest.com/creative-best-practices/ and https://business.pinterest.com/en-gb/how-to-make-pins/.

## Measurement and next decision

- Use Vercel’s production view and UTM filters to compare each launch source.
- Existing event: `Doodle Created`.
- Added events: `Doodle Downloaded` (result action), `Doodle Shared` (native share resolves; method file/link), `Doodle Share Link Copied` (clipboard resolves).
- A native share completion is browser-reported, not proof of delivery or a new visitor. A copied link is intent, not a completed referral. Use inbound `utm_source=doodle`, `utm_medium=share`, `utm_campaign=made_with_doodle` to look for resulting visits.
- Record visits, visitors who created, and share/referral activity after the first 100 attributable visitors or seven days following publication. This is a review point, not a guarantee of statistical significance.
- If people visit but do not create, inspect the first-run experience. If they create and share but referrals do not arrive, improve the shared artifact and message. If a channel produces creating visitors, make a second specific example for that audience.
- Paid promotion remains optional and currently unfunded if the US$25 Play fee is paid. Prepare a named merchant, fixed campaign end, and an enforced lifetime cap at or below the authorized remaining budget before purchase; do not substitute a recurring daily budget. Ask for any required merchant authorization only once the campaign is reviewable.

## Shipping checks

Unit/integration tests, typecheck, lint, production build, existing browser workflows, and the new narrow-screen sharing fallback test. External native share destinations need real-device verification; automated tests cover API payloads, cancellation, clipboard fallback and accessible manual copying.

## Release record

- Code commit: `9f36e74`; QA rule and content correction: `a68b56a`.
- Deployed to https://doodle.samistudio.nl/ via the existing Vercel project; deployment https://doodle-ko2s1mdp4-ahmed-samis-projects-e6ef0336.vercel.app completed successfully.
- Production smoke test: one real birthday-dog generation succeeded, new share control rendered, link-copy feedback succeeded. One existing paid credit consumed (10 to 9); no new pack purchase or card charge.
- Test traffic includes one `Doodle Created` and one `Doodle Share Link Copied` from this smoke test. Exclude these from any claim of growth.
- Public Pinterest board: https://www.pinterest.com/samicodesit/easy-doodle-ideas-for-cards-notes/.
- Both approved pins are verified on that public board (2 Pins), with matching alt text and AI-modified disclosure selected in the composer. No paid promotion was purchased.
- `AGENTS.md` now requires a quick pre-action QA check for every step, including audience fit, evidence, authorization, budget, factual correctness, and outcome verification.
- Follow-up commit `69abdd5` clarified the result controls: full-width “Draw something else,” quieter “Redraw this idea,” and automatic prompt focus without a generation request. Existing checkout retry wording is preserved. Verified 212 unit/integration tests, lint, production build, and 14 browser tests, including desktop, 320/390 mobile, German and Arabic screenshots. Deployed successfully at https://doodle-6rnycr0hv-ahmed-samis-projects-e6ef0336.vercel.app and aliased to the production domain.
