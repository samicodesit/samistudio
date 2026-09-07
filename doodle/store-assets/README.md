# Google Play store assets

`feature-graphic.html` is the editable source for the 1024 × 500 Google Play feature graphic. It composes the existing `birthday-dog.webp` and `lunch-high-five.webp` examples without altering their pixels, using Doodle's cream, graphite, green, and paper-card styling.

Render from the repository root:

```sh
npx playwright screenshot --viewport-size="1024,500" --wait-for-timeout=500 \
  "file://$PWD/store-assets/feature-graphic.html" store-assets/feature-graphic.png
```

The graphic makes no pricing, rating, download, or customer claim. The examples are disclosed as AI-generated.

The feature PNG is 1024 x 500 opaque RGB, SHA-256 0651a7e3e634f4d30a2470333b0efecdfd91ce8953ab862f01dc7c455238a6cf. play-icon-512.png is the unchanged live /pwa/icon/512 asset, 512 x 512 PNG, SHA-256 c69929d0d3f36ce2d6b2c5c80870a5cdbca211577d30258b170ddb56809da169. Both were visually inspected.

## Phone screenshot drafts — September 7, 2026

Open `phone-drafts/index.html` to review the four screenshots together, or view `phone-drafts/contact-sheet.png`. The individual numbered PNGs are each 1080 × 1920, 24-bit opaque RGB (verified with `file`), in this order:

1. Describe a little moment — actual composer with a short birthday scene.
2. A doodle for a birthday card — existing dog-and-balloon drawing in the result UI.
3. Find a small scene to draw — actual Ideas tab with example cards.
4. Take a closer look — actual enlarged birthday result dialog, including download action.

`05-settings-preview.png` is an additional optional QA preview of the Settings language screen, also 1080 × 1920 opaque RGB. It is included in the contact sheet after the four primary listing screenshots.

These are **browser-rendered drafts**, captured from the local updated application in its `?runtime=play` app workspace at a logical 360 × 640 viewport and device scale factor 3. They are not Android emulator/device or Play-installed captures. Only the account allowance and generation network responses are fixtures: two anonymous free doodles and the existing `public/ideas/birthday-dog.webp` image. The Ideas tab uses its actual gallery data. No fresh generation was purchased or performed. The script hides Next's development indicator; it does not modify the shipped interface, add device chrome, prices, reviews or features. A fixture result illustrates the existing output and is not a promise of identical AI output.

Reproduce with a running local app:

```sh
node store-assets/capture-phone-drafts.mjs 'http://localhost:3100/?runtime=play'
```

The capture script writes provenance and timestamp to `phone-drafts/manifest.json`. Final visual review checked all five rendered screenshots on the contact sheet: matching scene/drawing, readable controls, spacing, image integrity, selected navigation state, app-specific Ideas wording and the installed-mode full-width Download action. Composer and result actions fit above the bottom navigation at 360 × 640; the enlarged modal has no navigation overlap. Gallery and Settings continue scrolling naturally below the viewport. Final installed Android appearance and billing remain unverified by these assets. Replace or verify the drafts against the actual Android app before store submission. No assets have been uploaded.

Dimensions and opaque format follow [Google Play's screenshot requirements](https://support.google.com/googleplay/android-developer/answer/9866151). The contact sheet is a review aid and must not be uploaded as a phone screenshot.
