# Visual detail levels

Implemented in the isolated `codex/visual-detail-levels` branch. Source implementation is ready for owner review; release acceptance is pending the gates below.

## Behavior

The web, installed web shell and native Android composer use three joined 56 px/dp flower choices in one yellow strip, with two thin dividers. The drawer meets the scene input at its trailing top edge (right in LTR, left in RTL), inset 4 px/dp from the edge. Its centered pull tab reveals or hides the choices with a restrained vertical slide. The hint shares the row beside the flowers and wraps at narrow widths. The input stays fixed when the drawer opens or closes. The input masks the drawer as it retracts; one shared animation progress keeps the tab attached throughout. Touch users can swipe the handle up to reveal or down to hide. Hidden choices leave the keyboard and accessibility order; the selected level stays unchanged. Reduced motion removes the slide. Simple is the device default. Medium and Detailed add progressively developed line work. Localized names are available on web hover/focus and through accessibility labels and checked states on both platforms.

The choice uses local storage on web and the existing native session storage abstraction on Android. Restoration gates Create; corrupt or inaccessible storage falls back to Simple. Writes are best effort. Ideas, new scenes, language changes and authentication/payment flows retain the choice. Submission captures the scene and level together. Error retry uses the current input; result redraw uses the input that produced that result.

`POST /api/generate` accepts optional `detailLevel`: `simple`, `medium` or `detailed`. Omission means Simple. Invalid values return 400 before credit reservation or image generation. PNG responses, configured model, quality, dimensions, one-image requests and credit rules are unchanged.

Simple preserves the existing prompt byte for byte. The frozen prompt hash and legacy Android request hash are regression fixtures. Medium and Detailed share subject, paper and style rules with separate complexity instructions. Neither adds automatic grading or regeneration.

Android includes non-Simple levels in both challenge and generation bodies. The challenge hash binds the chosen level; mismatches are rejected before Integrity decoding and credit reservation. Simple omits the additional field in native bodies and hash serialization, preserving older clients and outstanding legacy challenges.

Generation diagnostics record only the validated level and allowlisted prompt version, alongside existing safe correlation fields. Scene content is not added to logs.

## Source and assets

The branch preserves the current native update sources and the deployed diagnostics/privacy baseline before adding this feature. Existing version 0.1.6/versionCode 8 is unchanged. Release versioning and signing remain part of the approved Android publishing step.

`scripts/build-detail-assets.mjs` is the coordinated source for all three flowers. It exports SVGs to `public/detail` and 3x PNGs to `mobile/assets/detail` using the existing Sharp installation. Runtime rendering dependencies and package dependencies are unchanged.

Current asset hashes, provenance and pending owner review are in [the manifest](qa/detail-levels/asset-manifest.json). QA screenshots are fixture evidence, not marketing assets or promises about generated output.

## Verification

See [the verification record](qa/detail-levels/verification.json) for commands and results. Web captures use a production build with mocked account and image responses. Android captures use a separate fixture package on an API 36 emulator. Both retain the real composer and selector UI.

## Release gates

1. Obtain owner visual acceptance of the flower assets and web/native layouts.
2. Review the six authorized HIGH-quality outputs in [the comparison](qa/detail-levels/comparisons/review.md). Both sets increase clearly in complexity, but Medium/Detailed introduce some hatching or filled areas. Strict no-shading acceptance remains unmet. The owner reduced this run to two rounds of three images; it does not establish the original 36-image quality threshold. Further calls require separate spending approval.
3. Complete independent code/visual review and resolve findings. Work in this task was inline, as requested.
4. Verify generation and Integrity on a real Play-installed Android build. Emulator fixture checks do not cover this.
5. Resolve the six remaining broader browser suite failures recorded in the verification report. Feature-specific browser checks passed; the entire legacy suite is not green.
6. Obtain separate production deployment and Android publishing approval. Deploy the compatible backend and web first, then publish Android. Older Android clients continue generating Simple.

Six paid generations were completed with explicit owner approval. No production deployment or store publishing was performed.

The approved six-image run used an explicit HIGH quality override. The local environment file had Low configured; no production configuration was changed or independently verified. Reproducing the run requires fresh spending approval:

```sh
OPENAI_IMAGE_QUALITY=high node --env-file=.env.local --import tsx scripts/evaluate-detail-levels.mts --approved-spend --two-rounds
```

The script saves each completed image and a partial manifest under `tmp/detail-eval`. It does not rerun automatically after failures. Review completed outputs before authorizing any additional paid calls. Do not add secrets or scene content to diagnostics when running it.
