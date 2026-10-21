# Terminal in-place revision

## Binding brief

The user rejected the separate teardown page and clarified that everything visible must remain 1:1: device, scale, camera, background, lighting, live screen, keys, type and layout. Only the parts should explode. Remove the added visible text and make motion direct, smooth and reversible. Retain construction resources and helpers. Execute inline; no publishing or deployment.

## Implementation decisions

- Keep the original scene canvas, camera matrix and page structure. No modal, refitting, replacement backdrop or new visible controls.
- Keep the original screen, keys, labels and indicator in their original DOM parents. Apply translations only.
- Capture exterior textures from the actual rendered viewport. Preserve the separately registered frontal phone view.
- Reconstruct only the room previously hidden by the device. Clip the patch to its silhouette. Existing room pixels and ground shadow remain unchanged.
- Pre-render textures on pointer/focus intent. Animate compositor transforms with a critically damped spring and small part timing offsets. Reversal retains velocity.
- Use the original amber indicator and Escape to reassemble. Keep original playground state and project navigation.

## Completed sequence

- [x] Write failing motion and room-region tests, implement the rigid translation contract and reversible spring.
- [x] Retain the previous source in `design-assets/terminal-exploded/previous-modal/`.
- [x] Replace the modal controller, layout and canvas animation loop with the inline scene.
- [x] Register both source views and preserve live nodes, IDs, dimensions, styles and state.
- [x] Correct the measured subpixel origin mismatch and remove the reparenting that changed text rendering.
- [x] Verify zero changed pixels in complete handoff and restoration frames at 1440 x 900, 393 x 852 and the current 685 x 846 in-app preview dimensions.
- [x] Verify unchanged background and type regions across six intermediate frames per viewport.
- [x] Exercise interrupted reversals, pointer hold/release/cancellation, keyboard entry, reduced motion, resource reuse, deferred-load cancellation, failure recovery, playground state and existing gallery navigation.
- [x] Run homepage suite, syntax checks and public packaging. Retain current screenshots, movies, reports and regeneration helpers.

## Acceptance evidence

`qa-scene/pixel-report.json`: 36 comparisons, 10347588 checked pixels, zero mismatches. Complete frames are compared at zero-motion handoff and after reassembly. Intermediate checks cover page regions not occluded by moving parts. The actual scene canvas is byte-identical during the open state. Native screen/key dimensions at handoff are equal. Browser runs also cover reversal and state preservation. This supersedes the narrower earlier source-surface check. The homepage suite passes 160 tests; public packaging includes 74 explicit runtime files.

## Scope of evidence

Chromium browser and the actual in-app preview were inspected. Phone checks use viewport emulation. No physical device claim or universal rendering claim is made. The unseen interior is a construction interpretation; the existing exterior and page are preserved. No subagents, commit, push or deployment.
