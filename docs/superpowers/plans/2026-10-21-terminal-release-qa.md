# Terminal release QA, 21 October 2026

The user authorized production deployment after proper visual and functional QA, then reported a closing flash and requested draggable or rotatable parts. Work stays inline. The existing live homepage is the independent surface baseline.

## Corrections made during this review

- Reproduced a luminance pulse in the closing tail. Several translucent layers were being composited over the old photographed device. Replaced this with opaque construction beneath one original-art cover, and restored the original surface before final spring settlement. The former 500ms frame had a larger mean pixel difference than the 300ms frame. The corrected sequence converges and every captured frame from 700ms to 1800ms equals the endpoint exactly.
- Replaced flat hidden shell and PCB fills with registered material textures generated with the built-in image tool. Original PNGs and complete prompts remain in `design-assets/terminal-exploded/materials/`. The five original exterior photos are unchanged. The new WebP textures add 373498 bytes, loaded only on inspection intent.
- Added shape-clipped drag targets for all five assemblies. Mouse and touch dragging preserve the native exterior and live DOM. Arrow keys move a focused part; Home or double click resets it. Reassembly removes inspection offsets smoothly and reopening starts registered. Rotation is omitted because these exterior photos have a fixed perspective.
- The short-screen visual review caught clipping and overlap with the Motion control. The separation now contracts and uses available space between existing text and controls. Native device size and camera remain fixed. The frontal mobile view follows a vertical mounting axis.

## Fresh evidence

1. Homepage surface: Work, About and Contact at 1440x900, 393x852 and 685x846. Nine comparisons against the actual pre-release live site, 6631038 pixels, zero differences.
2. Opening and reassembly: 36 comparisons of complete handoff/restoration frames and unchanged regions through six intermediate frames. 10347588 pixels, zero differences. Original background canvas is byte-identical throughout.
3. Inspection: all five assemblies reachable, draggable and keyboard-resettable at eight sizes/densities: 1440x900 DPR1, 393x852 DPR3, 685x846 DPR1, 320x568 DPR2, 844x390 DPR2, 768x1024 DPR2, 1024x768 DPR1 and 2560x1080 DPR1. Actual browser touch events exercised at the phone viewport. Moved parts reassemble and reopen with zero offsets. All initial expanded bounds fit the viewport.
4. Existing behavior: hold/release/cancellation, Escape, repeated entry, interrupted reversals, reduced motion, playground state and project gallery navigation pass. Deferred loading cancellation, resource reuse, failure recovery and balanced disposal pass.
   A delayed-load orientation test also caught an old-profile activation race. The controller now discards construction for the previous photograph and prepares the current one. Orientation during construction, orientation while open, resize while open and restoration pass.
5. Motion: four-times CPU throttling in installed Chrome, desktop and phone. Both runs have no animation long tasks. 95th-percentile frame interval is below 9ms; measured worst frame is below 48ms. This is an emulated stress check, not a physical mobile benchmark.
6. Exterior layer registration: 255397 opaque interior pixels from housing, display and keys remain exact. This is supporting source evidence, not a substitute for the whole-page checks above.
7. Homepage suite: 163 tests passed, zero failures. Public build: 76 explicit runtime files. Construction sources, tests, QA output, dependencies and unrelated applications are excluded from deployment.

The actual in-app browser was inspected as well as current saved screenshots. QA scripts and reports remain under `scripts/` and `design-assets/terminal-exploded/`. Phone coverage uses browser emulation; physical iOS Safari and Android devices were unavailable. The unseen internals are a plausible construction interpretation of the illustrated terminal.

## Release procedure

Reuse the existing `codex/studio-gallery-release` checkout, based on remote main `c180e97085552acfdd286965c3b612300154f5fc`. Copy only this change and reusable construction assets. Do not alter root main or unrelated Doodle changes. Run required tests, syntax and packaging in the release checkout, push without force, check Studio CI, then deploy the exact allowlisted prebuilt output to the existing Vercel project. Verify public response hashes and real live behavior afterward. Deployment result is recorded separately after publication.

## Published result

- Runtime release: `89289153ae8fca53d0f8dba8b83ce205af424d88`, pushed without force from the isolated release checkout. Root main and unrelated work remain untouched.
- Studio CI passed: https://github.com/samicodesit/samistudio/actions/runs/39601079661.
- Vercel reported Ready and aliased https://samistudio.nl to https://samistudio-4mon71mmo-ahmed-samis-projects-e6ef0336.vercel.app.
- All 76 anonymous public responses returned HTTP 200 and matched the tested build byte-for-byte. No access controls were changed.
- Live desktop, phone and preview checks pass for opening, pointer dragging, closing, gallery return and reduced motion. No page errors. Actual in-app browser opening, keyboard part movement and reassembly were also inspected.
- Six complete live homepage/restored screenshots match the original pre-release live homepage: 4420692 pixels checked, zero differences. Screenshots and reports are retained under `design-assets/terminal-exploded/qa-live/`.
