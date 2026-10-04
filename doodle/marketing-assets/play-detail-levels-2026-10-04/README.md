# Detail-level store draft

Draft replacement for phone screenshot 2 for the upcoming detail-level release. Updated at the owner's request with shared backend paper-color correction, a lavender pastel backdrop, and a short-haired man in the Detailed cooking drawing. Not uploaded to Play Console or approved for publication.

The 1080 x 1920 opaque PNG retains the genuine HIGH Simple and Medium cooking artwork. Detailed includes the owner's requested built-in Image Gen edit of the person on the right, keeping the original cooking roles and kitchen composition to best effort. A subsequent marketing-only edit opens the woman's winking eye, using `edits/cooking-detailed-open-eyes.png`. The exact prior image is retained as its edit input and recorded in `previousEdit`. App generation prompts and behavior are untouched. The other five processed drawings remain byte-identical. The renderer applies the shared `paper-v1` backend helper to all copies before composition. Original provider images are untouched. Square proportions, overlap, labels, fonts and layout are preserved.

The lavender `#EEE7F2` backdrop complements the submitted mint, blue and blush backgrounds while separating the yellow paper from the surrounding surface. Bricolage Grotesque and IBM Plex Sans are loaded from the same native font assets. The heading uses the existing 96 px scale and 42/66 px top/left offsets, with the same 36 px subtitle, charcoal text and moss accents. `manifest.json` records provenance, hashes, dimensions and review status. Screenshots 1, 3 and 4 remain byte-identical to the submitted assets recorded in `marketing-assets/play-gallery-2026-10-02/manifest.json` in the main checkout. `gallery-review.png` shows the four together; `gallery-manifest.json` verifies the unchanged exports.

`coordinated-comparison.png` is the separately requested six-image marketing comparison. The Simple and Detailed cats were edited against the unchanged Medium reference to align open eyes, pose, flower on the right and tail on the left. Detailed keeps its fur marks and surrounding foliage. The cooking row uses the same artwork as screenshot 2. `edits/manifest.json` stores exact prompts, references and raw edit hashes; `coordinated-manifest.json` records processed copies. These edits are marketing artwork, not new production prompt-evaluation evidence. The original six HIGH outputs and evaluation records remain intact.

This is a composed illustration of actual generation results, not an installed-app screen capture. The owner explicitly liked the visible hatching and dark fills in these outputs. Preserve that artwork. Do not publish before the feature ships and the owner approves the whole asset and store update.

Reproduce from the project root with the existing dependencies:

```sh
node --import tsx marketing-assets/play-detail-levels-2026-10-04/render.mjs
node marketing-assets/play-detail-levels-2026-10-04/build-review.mjs /home/mests/projects/samistudio/doodle/marketing-assets/play-gallery-2026-10-02
```

The revised export, 390 px preview, six-image comparison and four-screenshot contact sheet were visually inspected on October 4. Paper colors appear consistent while retaining grain. Subjects, hatching and filled areas remain visible. The short-haired man matches the Medium reference; cooking roles remain as originally drawn. Headings and labels are readable and unclipped. Use the public browser preview for owner review, since the private Page image attachments did not display in ChatGPT mobile. Whole-asset owner acceptance remains pending.

[Current browser review](https://doodle-layout-review-pdp62qn97-codenamez.vercel.app/release.html) contains screenshot 2, the four screenshots together and the coordinated comparison, including the woman's open-eye correction. `browser-preview.json` records anonymous image decoding and no horizontal overflow at 320, 390 and 1280 px, plus exact remote PNG hashes. The 390 px live page was inspected visually. It runs on the existing isolated static review project. No live app deployment or Play Console change occurred.

Dimensions and content were checked against [Google Play's asset guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en) on October 4. This comparison emphasizes actual output content. Retain app UI in the surrounding gallery, as Google recommends prioritizing it in the first three images.

The owner requested counter-free store screenshots before the next publication. The current four-image release candidate set is now recorded in `../play-counter-cleanup-2026-10-04/manifest.json`. Slots 1 and 4 use carefully restricted built-in Image Gen counter removal, with exact pixel preservation outside the local edit regions. Slots 2 and 3 remain unchanged. Select that current candidate set for release review, preserving the originals as provenance. [Review all four current screenshots](https://doodle-layout-review-9atjkigyb-codenamez.vercel.app/store.html). No Play Console upload occurred.
