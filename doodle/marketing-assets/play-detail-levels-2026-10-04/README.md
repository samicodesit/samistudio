# Detail-level store draft

Draft replacement for phone screenshot 2 for the upcoming detail-level release. The owner identified paper-color drift, then clarified that slight drift is acceptable. A correction is optional and has not been implemented. Not uploaded to Play Console or approved for publication.

The 1080 x 1920 opaque PNG uses the three actual HIGH cooking outputs from the approved six-generation comparison. The images retain their colors and square proportions, with a small vertical corner overlap. Labels stay upright. There were no further provider calls.

The headline and palette match the current submitted four-image gallery. Bricolage Grotesque and IBM Plex Sans are loaded from the native app's font assets. `manifest.json` records source and output hashes, the existing screenshot being replaced, dimensions, and review status. Screenshots 1, 3 and 4 remain the current submitted assets recorded in `marketing-assets/play-gallery-2026-10-02/manifest.json` in the main checkout.

This is a composed illustration of actual generation results, not an installed-app screen capture. The owner explicitly liked the visible hatching and dark fills in these outputs. Preserve that artwork. Do not publish before the feature ships and the owner approves the whole asset and store update.

Reproduce from the project root with the existing dependencies:

```sh
node marketing-assets/play-detail-levels-2026-10-04/render.mjs
```

Visual review on October 4 checked the export and its 390 px preview. The levels are distinguishable, labels are readable, the cooking actions remain visible, and no text is clipped. The draft was uploaded as a native PNG image to the owner's private review Page alongside the eight selector captures. File access and Page insertion were confirmed. ChatGPT mobile rendering is still awaiting confirmation from the owner.

Dimensions and content were checked against [Google Play's asset guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en) on October 4. This comparison emphasizes actual output content. Retain app UI in the surrounding gallery, as Google recommends prioritizing it in the first three images.
