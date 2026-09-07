# Google Play store assets

`feature-graphic.html` is the editable source for the 1024 × 500 Google Play feature graphic. It composes the existing `birthday-dog.webp` and `lunch-high-five.webp` examples without altering their pixels, using Doodle's cream, graphite, green, and paper-card styling.

Render from the repository root:

```sh
npx playwright screenshot --viewport-size="1024,500" --wait-for-timeout=500 \
  "file://$PWD/store-assets/feature-graphic.html" store-assets/feature-graphic.png
```

The graphic makes no pricing, rating, download, or customer claim. The examples are disclosed as AI-generated.

The feature PNG is 1024 x 500 opaque RGB, SHA-256 0651a7e3e634f4d30a2470333b0efecdfd91ce8953ab862f01dc7c455238a6cf. play-icon-512.png is the unchanged live /pwa/icon/512 asset, 512 x 512 PNG, SHA-256 c69929d0d3f36ce2d6b2c5c80870a5cdbca211577d30258b170ddb56809da169. Both were visually inspected. Final phone screenshots still need capture from the actual installed Android app.
