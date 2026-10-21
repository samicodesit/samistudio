# Terminal exploded view construction kit

The terminal now explodes directly in the original homepage. The camera, scale, room canvas, headline, screen and keys remain in place. Existing exterior pixels are sampled from the rendered homepage, not a substitute product image. The live screen, keycaps, key legends and pilot stay in their original DOM parents. Only their translations change. There is no modal, replacement background, title, inspector, slider or helper copy.

## Files worth keeping

- `../../assets/terminal-construction.mjs`: original-coordinate clipping paths, front-plane projection, switch registration and editable interior painting.
- `../../assets/terminal-assembly.mjs`: functional assembly order and descriptions.
- `../../assets/terminal-renderer.mjs`: registered compositor layers and translations. It never refits or zooms the device and never reparents or clones its live content.
- `../../assets/terminal-scene-motion.mjs`: critically damped reversible motion and part choreography.
- `../../assets/terminal-room.mjs`: reconstructs only the region previously concealed by the device. The renderer clips this patch to the original device silhouette. The existing room canvas and its cast shadow are unchanged.
- `layers/`: lossless transparent PNG exports of all five assemblies, plus the assembled exterior reference. Each is registered on a 1686 x 933 canvas, matching the source files.
- `layers/source-registration.json`: SHA-256 identities of the original sources and comparison counts. Interior pixels of the exterior layers must match exactly. The antialiased glass perimeter is excluded from the pixel check because it meets an added backing plate.
- `qa-scene/`: current homepage, zero-motion handoff, intermediate frames, open state, restoration, video, lifecycle results and whole-frame pixel checks.
- `materials/`: original generated inner-shell and PCB textures with prompt provenance. Runtime WebP derivatives are registered only to the hidden interior planes. The photographed exterior is unchanged.
- `qa-release/`: independent comparisons against the pre-release live homepage, closing-tail captures and CPU-throttled motion measurements.
- `qa-inspection/`: eight viewport and density combinations, all five draggable assemblies, keyboard resets, touch input and containment checks.
- `previous-modal/` and `qa/`: historical source and evidence from the rejected separate-screen version. They are retained for reuse, not current acceptance evidence.
- `construction-3d/`: the earlier procedural mesh and local Three.js bundle. Retained as an editable construction study. It failed the visual fidelity check and is excluded from production. Do not use it as the canonical terminal exterior.
- `package.json` and `package-lock.json`: pinned helper dependencies. None are downloaded by visitors.

The canonical desktop and phone exterior sources are the existing `assets/terminal-*.webp` files. They are unchanged. The rendered scene's actual viewport pixels provide its exterior textures. Newly revealed internals are a construction interpretation: shell, board, switches, display carrier and ribbon. `mobileConstruction` registers the frontal phone view separately, rather than switching the phone to the desktop perspective.

## Regenerate and check

From the repository root:

```sh
npm ci --ignore-scripts --prefix design-assets/terminal-exploded
node --test tests/studio.test.mjs
node scripts/build-studio.mjs
node scripts/preview-studio.mjs 43128
```

In another terminal:

```sh
node scripts/export-terminal-assets.mjs
node scripts/qa-terminal-lifecycle.mjs
node scripts/qa-terminal-scene.mjs
python scripts/check-terminal-scene-pixels.py
node scripts/qa-terminal-inspection.mjs
node scripts/qa-terminal-performance.mjs
node scripts/qa-terminal-resize.mjs
node scripts/qa-terminal-release.mjs
python scripts/check-terminal-release-pixels.py
```

The helpers default to `http://127.0.0.1:43128`. Set `TERMINAL_QA_URL` for another preview address. Set `TERMINAL_QA_BROWSER` to an installed Chromium executable when Playwright's default binary is unavailable. The current QA used Chromium with phone viewport emulation; it does not claim physical iOS or Android device verification.

The 3D study can be regenerated with `node scripts/bundle-terminal-vendor.mjs` in an environment with the root's esbuild available. It writes only into `construction-3d/vendor/` and retains the MIT license. Its original geometry and material parameters remain editable in `construction-3d/terminal-model.mjs`.

## Registration and layout

All exterior paths use the source artwork's coordinates. At zero separation every part has zero offset. The source camera matrix and scene canvas do not change. Artist layers live inside the existing terminal coordinate system; the original screen and keys receive translations there without being rebuilt. Their original font styling, media rules, depth, colours and live state remain intact.

Canvas textures are prepared on intent, before the deliberate hold completes. Animation frames update transforms and opacity only. A single bounded renderer is reused for reopening. Closing restores original styles and stops the animation loop. Reduced motion sets the endpoint immediately. Failed preparation leaves the original homepage usable. Construction resources are disposed when the controller is destroyed or its responsive source changes.

Each assembly has a transparent, shape-clipped drag target. The original screen and key nodes remain in their parents and follow the same movement as their assembly. Arrow keys move a focused assembly; Home or double click resets it. Closing smoothly removes the inspection offsets. On short screens, part travel uses the available space between the introduction and Motion control. The camera and native device scale stay fixed. There is no artificial 3D rotation of the flat photographic sprites.

Closing uses one opaque assembly compositor and a single original-art cover. The previous simultaneous fades of room, product and reference caused a luminance pulse. Below a subpixel visual threshold, the original scene is restored before the controller settles. Closing-tail frames verify the stable endpoint rather than only comparing the final screenshot.

The former 255397-pixel surface comparison only established source-pixel preservation inside selected exterior regions. It did not establish complete device fidelity. Current acceptance compares entire homepage PNGs at the handoff and after reassembly, checks native element rectangles, and compares unchanged page regions across six intermediate frames. The current baseline is 36 comparisons, 10347588 pixels checked, zero changed pixels. This covers desktop, phone and the current in-app preview dimensions. It does not claim verification of untested physical devices.
