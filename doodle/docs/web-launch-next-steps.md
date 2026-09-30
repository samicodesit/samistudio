# Web launch next steps - draft, not published

Prepared 8 September 2026. This is a small organic web experiment for Doodle,
using the approved 12-second Android demo and two realistic use-case mockups.
The launch is authorized; this document records the execution-ready copy, and
no publication occurred during preparation.

## Assets and message

- Use the verified demo at
  [`marketing-assets/demo/candidate/doodle-real-demo-12s-candidate.mp4`](../marketing-assets/demo/candidate/doodle-real-demo-12s-candidate.mp4).
  Its CTA is clear at phone size and ends at the existing product URL.
- Use the visually accepted realistic mockups:
  [`marketing-assets/launch-realistic/birthday-card-dog-balloon.png`](../marketing-assets/launch-realistic/birthday-card-dog-balloon.png)
  and
  [`marketing-assets/launch-realistic/lunchbox-apple-sandwich.png`](../marketing-assets/launch-realistic/lunchbox-apple-sandwich.png).
  Use Pinterest's AI-modified disclosure when required by the platform; do not
  add an unsolicited AI disclaimer to the visible copy.
- Keep one clear promise: Doodle helps make a drawing idea for a card, lunchbox
  note or journal page. Keep the visible copy human and use-case focused.

## Initial launch sequence

1. **Initial Pinterest batch:** publish the birthday-card mockup through the
   connected Pinterest account, using the exact copy and destination below.
2. **Next appropriate point:** publish the lunchbox-note mockup as a separate
   pin after the initial pin has had time to establish a baseline. Do not halt
   it after an arbitrary two-day low signal and do not promise a calendar slot.
3. Hold the demo pin until its burned-in “first two free” CTA is updated to
   match the current copy direction; do not publish the conflicting asset.
4. Read replies and compare the birthday and lunchbox UTM contents at the same
   measurement point. Do not edit or duplicate the existing published pins.

## Measurement and decision rules

Use existing production events: `Doodle Created`, `Doodle Downloaded`,
`Doodle Shared` and `Doodle Share Link Copied`. Record source, visits, creators,
downloads, shares, and qualitative feedback separately; a click or copied link
is intent, not a completed referral. Review after seven days or 100 attributable
visitors, whichever comes first, and exclude owner/QA traffic.

For each pin, use campaign `doodle_web_launch` and change only `utm_content`
(`birthday_card`, `lunchbox_note`, or `demo`). Compare visit-to-create and
create-to-share behavior,
then decide:

- visits but few creations: clarify the first prompt and card/note use case;
- creations but few downloads or shares: improve the result framing or example;
- useful feedback and repeatable creation: make one more specific example for
  that audience;
- no meaningful signal: stop that channel and preserve the evidence.

Do not open a Product Hunt launch or paid campaign until a small organic test
shows a repeatable reason for people to create and share. The current budget is
US$0, so all work in this draft is volunteer, organic and measurement-first.

## Execution-ready Pinterest package - do not publish

These are new-pin drafts for Pinterest. Attach the visually accepted files listed
above. These physical card and lunchbox compositions materially differ from the existing isolated-note
images, so create new pins and leave the old birthday and lunchbox pins unchanged.

### Pin 1 - birthday card mockup

**Title:** A little birthday-card idea

**Description:** A happy dog with a balloon for your next birthday card. Make a
drawing idea of your own with Doodle.

**Media:** `marketing-assets/launch-realistic/birthday-card-dog-balloon.png`

**Destination:**
`https://doodle.samistudio.nl/doodle-ideas?utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=birthday_card`

### Pin 2 - lunchbox note mockup

**Title:** A little drawing to brighten their lunchbox

**Description:** Turn a small scene into a drawing idea for a lunchbox note.
Try this cheerful apple-and-sandwich idea, or make something of your own with
Doodle.

**Media:** `marketing-assets/launch-realistic/lunchbox-apple-sandwich.png`

**Destination:**
`https://doodle.samistudio.nl/doodle-ideas?utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=lunchbox_note`

### Pin 3 - approved demo video

**Title:** Turn a small idea into a simple doodle

**Description:** Describe a little scene and get a simple drawing idea for a
card, lunchbox note or journal. Try Doodle and make your own.

**Media:** Approved 12-second demo at
`marketing-assets/demo/candidate/doodle-real-demo-12s-candidate.mp4`.

**Destination:**
`https://doodle.samistudio.nl/?utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=demo`

Use Pinterest's normal destination field so the visible domain remains
`doodle.samistudio.nl`; keep UTM parameters only in the destination. Use
Pinterest's AI-modified disclosure when required by the platform. No additional
caption or comment is required. Hold this pin until the burned-in CTA is updated
to remove the conflicting “first two free” wording.

Recommendation: create these two new pins because the realistic card and
lunchbox contexts materially differ from the existing isolated-note images. Keep
those earlier pins and their measurement history unchanged. Publish the birthday
mockup now; publish the lunchbox mockup at the next appropriate point after a
baseline exists. Hold the demo until its burned-in CTA is corrected. No
publication occurred as part of this plan.

## Publication record - 8 September 2026

- Birthday mockup: Published to the connected `samicodesit` Pinterest account at
  [A little birthday-card idea](https://www.pinterest.com/pin/703476404341506155/).
- Destination: The live `Visit site` link was inspected and matches
  `https://doodle.samistudio.nl/doodle-ideas?utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=birthday_card`.
- Verification: The live Pin rendering was inspected after publishing. The
  image, title, description, board, `AI modified` label and destination survived
  publication. The description reads: `A happy dog with a balloon for your next
  birthday card. Make a drawing idea of your own with Doodle.`
- Lunchbox mockup: Published to the connected `samicodesit` Pinterest account at
  [A little lunchbox-note idea](https://www.pinterest.com/pin/703476404341506263/).
- Lunchbox destination: The live `Visit site` link was inspected and matches
  `https://doodle.samistudio.nl/doodle-ideas?utm_source=pinterest&utm_medium=organic_social&utm_campaign=doodle_web_launch&utm_content=lunchbox_note`.
- Lunchbox verification: The live Pin rendering was inspected after publishing.
  The image, title, description, board, `AI modified` label and destination
  survived publication. The description reads: `A cheerful apple and sandwich
  for a little note in their lunchbox. Make a drawing idea of your own with
  Doodle.`
- Demo video: Not published because its burned-in CTA still says `first two
  free`.
