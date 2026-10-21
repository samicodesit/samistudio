# Compact visual detail selector

Local design exploration. No production code changed, no deployment, no paid generation.

The selected real dog-and-balloon example is visible in a 48px control with an explicit Detail label and selected level. Tapping opens a three-column comparison of Simple, Medium and Detailed. Selection updates the label and thumbnail and closes the sheet.

Existing approved gallery images were copied unchanged after verifying their SHA-256 hashes against the gallery manifest. See example-provenance.json.

Verified actual CSS viewports: 320x568, 390x844, 768x1024 and 1440x900. The browser has a 1.2 device scale, accounted for in viewport requests; actual innerWidth/innerHeight were recorded. No horizontal overflow or overlap between the prompt hint and detail control. All three images loaded and the comparison choices fit in each viewport. Composer width and height exactly match the unchanged reference at each size. At 390px its position also matches. At 320px the former header wrapping is removed; desktop heading layout adds approximately 11px above the composer.

Verified choosing Medium updates the displayed level and image, closes the dialog, and resets aria-expanded. Native devices, translations and screen-reader behavior have not been tested in this design-only mock.

Interactive review: index.html. The original two alternatives remain as reference files. Current artifacts: combined.html, combined.css, combined.js, combined-closed.png, combined-open.png and combined-layout-checks.json.
