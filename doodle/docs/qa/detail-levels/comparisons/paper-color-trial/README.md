# Paper color correction trial

Owner requested a deterministic script trial on the six saved HIGH outputs. This trial adapts the existing marketing normalization method. Original generation files and the store composition remain unchanged. No app code or prompts changed. No provider calls, new dependencies, or paid services were added.

Each image's sampled yellow-paper median reaches sRGB `#FFEB8A` exactly. This describes the sampled base, not every textured pixel. All pixels with maximum RGB below 120 are byte-identical, alpha is unchanged, dimensions remain 1024 by 1024, and PNG decoding preserves the corrected pixel buffer exactly. The manifest records source and output hashes, samples, changed pixels, protected ink counts, and clipping counts.

The shift smoothly fades near light strokes. Lighter ink transitions can shift. Bright red-channel values clip at 255, reducing some red-channel grain variation. This is a review experiment on these six images, not a proven classifier for arbitrary colored artwork or a production-ready normalization guarantee.

Visual inspection covered all six original/corrected pairs at 320 px drawing size, plus full-size corrected detailed cat, simple cooking, and detailed cooking images. Hatching, filled hair, contours, and visible grain remain. No obvious erased strokes or color halos were observed in those views. Owner visual acceptance remains pending.

The public comparison is at [Paper color trial](https://doodle-layout-review-93zm997hb-codenamez.vercel.app/colors.html). Anonymous Chromium checks at 320 and 390 px decoded all six images, verified both toggle states and no horizontal overflow. The 390 px rendered page was visually inspected. All six full-resolution remote corrected files match local hashes. Actual iPhone display is awaiting owner review.

This is a static preview deployment to the existing isolated `doodle-layout-review` project under the `codenamez` Hobby team. The attempted stable-alias production update returned `Not authorized`; the normal preview deployment succeeded. The original stable gallery is unchanged. No Doodle app production deployment, billing settings, DNS, or Play Store upload occurred. Local processing and writing previews took approximately 6.6 seconds. No server functions or hosted image transformation service are used by the page.

Reproduce with Node and the already installed Sharp and Playwright packages:

```sh
node docs/qa/detail-levels/trial-paper-color.mjs
node docs/qa/detail-levels/check-paper-trial.mjs --live https://doodle-layout-review-93zm997hb-codenamez.vercel.app
```

Live hosting is a separate manual operation. The scripts do not deploy or read credentials.
