# Studio visual review, October 12, 2026

Final result: passed for local review. Gallery production publication remains unauthorized. Owner acceptance is pending.

This assessment compares the four selected AutoLister and corrected Cryptik references with the rendered implementation. It does not claim literal pixel identity for browser text or every possible viewport.

## Targets and evidence

Source directory: `C:/Users/Sami/.codex/generated_images/01a130b2-d18c-7ad1-a04f-0cce5bb3b5fd/`.

Evidence directory: `C:/Users/Sami/.codex/visualizations/2026/10/12/01a130b2-d18c-7ad1-a04f-0cce5bb3b5fd/samistudio/`.

| Target | Source PNG | CSS viewport and capture |
| --- | --- | --- |
| AutoLister desktop | `exec-9d884a5b-0482-4fa6-886e-8d3f63cb72e2.png` | 1505 x 1045 |
| AutoLister mobile | `exec-8d37bc2d-75f8-4bfb-bef9-1673a83b87b2.png` | 853 x 1844 |
| Cryptik desktop | `exec-05d93805-d871-4cd5-b57a-665b3740fffe.png` | 1506 x 1045 |
| Cryptik mobile | `exec-8ee8a5f0-60ec-4174-8a58-a60b98c3a309.png` | 853 x 1844 |

Device pixel ratio was 1. Each source/capture pair has equal dimensions. One initial default screenshot was 34px too short and was replaced with an explicit clip before comparison.

Final comparisons: `[project]-[desktop|mobile]-comparison-04.jpg`. Focused type comparisons: `[project]-[desktop|mobile]-type-comparison-04.jpg`. Source is left, actual browser rendering is right. Delivery boards: `autolister-implementation-review.jpg` and `cryptik-implementation-review.jpg`.

## Findings and iterations

- [P1, fixed] Rejected disconnected prop arrangements were replaced with the selected complete scenes and independent mobile compositions.
- [P2, fixed] AutoLister's desktop description wrapped into three lines, and mobile broke after the wrong word. Native text spans restore the selected two-line wording and measured width.
- [P2, fixed] Initial title sizes, baselines, caption spacing and underlines drifted. Ink bounds were measured and corrected. Comparisons 02/03 show corrections; 04 verifies the final state.
- [P2, fixed] A classic scrollbar consumed 15px of the 320px phone scene. The dialog now retains native vertical scrolling with a full 320px client width and no horizontal overflow.
- [P2, fixed] Containing a narrow photo in widescreen left plain bars. Stitching generated extensions introduced seams and a doubled vase. That composition was rejected. Wider screens now use one continuous expanded room image, while the original approved photograph remains at the reference aspect ratio.
- [P2, fixed] Short landscape text became too small when scaled with the photograph. It now retains 16px body/link text and 44px controls. The 820 x 390 view has no vertical or horizontal overflow.
- [P2, fixed] A quick Back/Forward reversal during closing could ignore the new project. Closing is now token-guarded and can be interrupted by the requested route.
- [P3, expected] Generated letterforms differ slightly from native fonts. Final measured main-title, first-description-line and link bounds are within approximately 1 to 3 source pixels. This is not literal whole-image pixel equality.

## Required fidelity surfaces

- Typography: two locally hosted families, DM Serif Display and Inter. Headline, copy, navigation and links are real HTML. AutoLister desktop copy has a measured horizontal adjustment. Focused comparisons verify hierarchy, wrapping and underlines.
- Spacing: source-sized frame coordinates preserve the chosen arrangements. Header, caption and links were measured against the references. No generic card grid or shared set of decorative props was introduced.
- Color: site ink remains near-black `#20211e`; product-specific muted descriptions match their reference treatments. JPEG browser captures introduce small compression differences.
- Image quality: approved PNGs were encoded as lossless WebP and read back with pixel equality verified. Continuous photography preserves panel bevels, floor shadows, stone, garment and word cards. Clean plates replace only website-text regions. Widescreen artwork is a responsive adaptation, not a pixel-identical copy of the narrower source.
- Copy: AutoLister says “Listing titles and descriptions from your item photos.” Cryptik says “A word game to play with friends.” Links resolve to the real products. Cryptik contains complete words on rectangular cards, not letter tiles.

## Responsive and motion checks

Inspected viewports: reference dimensions above, laptops 1280 x 720, 1366 x 768 and 1440 x 900, phone 390 x 844, small phone 320 x 640 and landscape phone 820 x 390. Both project compositions were visually inspected at all three laptop sizes. Laptop and normal phone scroll dimensions equal their viewports. The 320 x 640 portrait scene is approximately 692px tall and scrolls vertically when needed. The external link remains reachable by keyboard and touch. No visible scrollbar or horizontal overflow was found in these inspected views.

Short landscape intentionally crops the lower photographic foreground while preserving readable navigation and copy. It does not stretch the artwork or introduce nested scrolling. Wider desktop uses a continuous room render, avoiding stitched edges and duplicate props. Other viewport/browser combinations were not individually verified.

The reveal expands from the photographed terminal screen over 850ms. The room camera settles from scale 1.065 to 1 over 1100ms. Title, description and link enter with staggered deceleration and return to identity transforms. `gallery-motion-entry.json` and its screenshot record the opening state. The browser verified identity transforms and full opacity at rest. Reduced-motion branches bypass these effects; OS preference emulation was not exercised.

Doodle keeps a separate note figure at layer 0 behind the grounded panel at layer 1. `doodle-regression-final.jpg` confirms the preserved composition. The separate Doodle application was not changed.

## Verification and release boundary

15 asset, build, geometry, route and source tests pass. JavaScript syntax and scoped whitespace checks pass. Browser checks covered keyboard project selection, Enter, Escape, focus return, direct routes and rapid Back/Forward reversal. Error logs were empty.

The build contains 34 explicitly allowed runtime files. Repository sources, documentation, tests, secrets and the Doodle application are excluded.

Only the earlier typography-only release is live at `samistudio.nl`. The gallery remains local at `http://localhost:8090/`. The published ChatGPT design-review site still shows mockups. Neither production site was changed by this implementation turn.

final result: passed

## Quality and loading audit, 2026-10-13

Local implementation polished and verified. Production gallery deployment remains pending owner authorization.

### Flow results

1. Hero and terminal, healthy in checked viewports. Two local font families, native sharp text and controls, no horizontal overflow. About, Work and Contact remain inside the terminal. Work activation no longer downloads every project. Redundant full canvas repaints at unchanged dimensions are skipped.
2. Project opening, healthy. The visible layout determines the image requests. Widescreen AutoLister and Cryptik load one continuous room photograph. Reference and portrait layouts load the approved lossless photograph plus three lossless text patches. Speculative loading waits 220 ms for deliberate hover or focus and is disabled for Save-Data and reported 2G/3G connections.
3. Doodle composition, repaired. The room extension now follows the reference scale and position, with overlapping edge coverage to avoid fractional-pixel seams. The note remains its own DOM element and shadow layer. Its shadow crop excludes a stray piece of the original caption. Phone and tablet composition follows the original object coordinates and includes the source ground shadow, so the note drawing remains visible and the panel has a floor contact.
4. Navigation, healthy in browser checks. Arrow/End selection, Enter opening, Tab traversal, Escape, focus return, Back, Forward and interrupted Back/Forward all checked. Escape during a slow pending load cancels the opening. Returning after a download does not cause a delayed modal to appear. Email, WhatsApp and three project destinations verified without sending messages.
5. Responsive behavior, healthy within the tested matrix. 320x640, 390x844, 820x390, 768x1024, 1280x720, 1366x768, 1440x900 and source-sized captures at 1505/1506x1045 and 853x1844 checked. No horizontal overflow in sampled views. Normal portrait phones and laptops fit their composition. At 320x640 the tall project image needs approximately 52 px of vertical scrolling; portrait tablet AutoLister needs 636 px. This preserves the approved artwork's proportions. The external link is reachable by natural scrolling and keyboard navigation. Landscape foreground is cropped by the short viewport while the caption and navigation remain readable.

### Actual asset budgets

Unique initial files, before HTTP compression: desktop 447,714 bytes; phone 193,318 bytes. Browser preload and cache behavior can affect actual transferred totals. Project art loads after project intent rather than with the hero.

| Project | Layout | Before bytes | After bytes | Reduction |
| --- | --- | ---: | ---: | ---: |
| AutoLister | Reference desktop | 2,533,856 | 1,388,428 | 45.2% |
| AutoLister | Portrait | 2,683,654 | 1,581,606 | 41.1% |
| AutoLister | Widescreen | 3,840,118 | 1,306,262 | 66.0% |
| Cryptik | Reference desktop | 2,884,420 | 1,572,674 | 45.5% |
| Cryptik | Portrait | 3,072,736 | 1,771,788 | 42.3% |
| Cryptik | Widescreen | 4,482,262 | 1,597,842 | 64.4% |

The twelve text patches total 552,806 bytes. Each was cropped from the existing source clean plate and encoded losslessly. Decoded RGB bytes were asserted equal to the exact source region. Full project photos retain their previous pixel-identical encodings. Four full clean plates are excluded from the runtime build but retained as source material.

A separate localhost QA server enforced an aggregate 1.6 Mbps transfer budget and 150 ms response latency. Request logs confirmed no gallery requests when Work was activated. AutoLister wide artwork transferred 1,306,262 bytes in 6,706 ms. Pending Escape, subsequent opening and the completed native reveal were checked. This is a constrained local transfer test, not a Lighthouse score or a measurement of a user's mobile carrier.

### Verification and limits

`node --test tests/studio.test.mjs`: 19 passing tests, no failures. Includes geometry, direct links, selected-layout requests, connection preferences, a 256 KiB clean-patch budget, asset integrity, exact deployment contents and production build configuration. `node scripts/build-studio.mjs`: 43 explicit runtime files. Browser console errors: none in final captures. Reduced-motion handling retained and reviewed in code; no OS preference was changed for this pass.

Reference-size AutoLister and Cryptik source versus browser comparisons were regenerated after optimization for both desktop and portrait. Native browser glyph rendering retains the previously documented small raster differences from generated text. Widescreen remains a documented adaptation of the approved scene, rather than a claim of pixel equality to a differently proportioned source.

Sharpness remains bounded by the source photography. Project portrait art is 853x1844, desktop art 1505/1506x1045, wide art 1672x941. The original mobile hero photograph is only 416x932. It looks clean in the checked logical phone view, but this does not establish perfect photographic detail at 2x/3x density or on every physical device. Native site text is independently rendered. No artificial upscaling or new compression was used to imply extra detail.

Evidence: `C:/Users/Sami/.codex/visualizations/2026/10/12/01a130b2-d18c-7ad1-a04f-0cce5bb3b5fd/samistudio/audit-2026-10-13/`. Retained final screenshots, source comparisons, viewport measurements and the laptop/phone polish review. Disposable slow server stopped; normal localhost:8090 preview retained. No production deployment performed.
# Doodle artwork update, 13 October 2026

Replaced the Doodle portrait, reference desktop and wide room photographs with dedicated ImageGen scenes using the owner's birthday puppy, pancake cooking, reading and gardening artwork. The generated compositions are encoded as lossless WebP. Their source prompts and supplied drawings are retained in assets/gallery/source; only the optimized scene for the visible layout is requested by the browser.

Doodle's photographic scene stays stationary, including the note. Its native headline, description and link use the same staggered entrance as the other projects. The continuous scene replaces the old segmented room and note overlays.

Reviewed the built page at 390 x 844 and 1280 x 720. The phone view has no horizontal overflow. The laptop photograph loads cleanly, with a straight panel edge and continuous floor. Switching from Doodle to both other mobile project scenes restores their three text plates correctly. The required studio checks passed: 19 tests. Push and production publication were explicitly authorized by the owner.
