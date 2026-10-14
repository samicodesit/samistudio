# Studio glass and fluid scenes, October 13, 2026

Local acceptance: passed for the checked phone, tablet and desktop matrix. Production push and deployment were authorized in the portfolio handoff. The older report below describes superseded layouts.

The selected target is exec-b3b84238-7eb4-412d-8387-36ec6a57d67d.png from the prior chat. The final UI uses a feathered 12% tinted, 16px blurred optical veil behind native DM Serif Display and Inter text, one horizontal divider and an unboxed Open link. The physical artwork is centered between measured controls. Desktop retains the existing approved layout.

## Continuous photographs

The inherited P1 reproduced by opening 390x844 and resizing to 390x676: the cached tall photo shrank within a separately generated room and exposed rectangular side boundaries. The final portrait camera uses one oversized continuous photograph per project. It fits protected artwork and clamps the photograph to cover every viewport edge. There is no separate portrait wallpaper, edge feathering or assembled room. Height changes reuse that same photograph. Landscape uses the existing dedicated continuous photographs. The new images are faithful photographic adaptations, not literal pixel-identical outpaints of every original object.

## Evidence and checks

Evidence directory: C:/Users/Sami/.codex/visualizations/2026/10/13/samistudio-continuous-final/. Chrome captures and checks.json supersede the mismatched in-app browser captures. Chrome reported device pixel ratio 1 and the exact requested CSS viewport sizes.

All three projects were checked at 320x480, 375x559, 393x676, 390x844, 442x958, 768x1024, 820x1180, 1024x1366, 844x390, 1024x768, 1366x1024 and 1280x720. Descriptions and links stayed above the fold, images loaded, and the gallery had no horizontal or vertical scroll. All responsive photographs covered all four viewport edges. The desktop reference uses its original environment layer and is evaluated separately. Contact sheets were inspected for photographic seams, missing objects and distortion. Cryptik retains both spy faces and the complete five-by-five word card grid; table bases can naturally leave the landscape crop.

Each project was also opened at 390x844 and resized to 390x676 without reloading. Saved browser-bar captures show no photograph boundary. Rotation switched each scene to its landscape source. Back and Escape restored Work and the selected row; arrow keys and Enter selected and reopened a project; Tab reached Back and Open; browser Back/Forward closed and reopened the gallery. The Doodle external link opened the correct new tab. All three destination URLs and noopener/noreferrer behavior were checked. Chrome console had no errors or warnings during the interaction sequence.

The responsive controls use 44px Back and 48px Open hit targets, measured native header/caption heights, visualViewport at scale 1, safe-area padding on all sides, and reduced-motion/transparency fallbacks. Native iOS Safari, actual browser chrome and nonzero hardware safe-area insets were not available. Height changes are desktop browser viewport simulations, not physical-device certification.

The required studio suite passes 28 tests, including a failing-then-passing regression for continuous portrait coverage and single-photo loading. Runtime packaging remains an explicit 52-file allowlist. Only the active portrait or landscape photograph is loaded, and SaveData/slow-connection settings disable speculative downloads. No dependency was added. Final syntax, build, isolated worktree tests and production verification are recorded in the release chat.

## Historical review

# Studio visual review, October 12, 2026

Historical local review, superseded by the October 13 report above.

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
# Mobile browser fold correction, 13 October 2026

The previous portrait layout placed copy at fixed coordinates near the bottom of an 1844-pixel photograph. A real browser with expanded controls provides a shorter visible viewport than the tall mockup, so the project introduction could disappear below the fold.

All three portrait views now place the native title and description on the upper wall, with a visible Open link beside the title. Copy uses readable viewport-independent sizes and safe-area spacing. The scene's scroll extent follows the photographed artwork rather than leaving the old caption area empty. Dynamic viewport sizing and visualViewport resize updates handle browser controls; unchanged image sources are not reassigned during those updates. Opening any project resets its scroll position.

Doodle's existing supplied artwork and stationary note are preserved. Cryptik uses a clean dedicated mobile photograph with room for the introduction and no text replacement plates. Its original mobile assets remain as design references and are omitted from the runtime build. Desktop compositions and copy positions are preserved.

Checked the built introductions at 393 x 676, matching the uploaded browser's content area, plus 375 x 559 and 320 x 480 phone views and a 599 x 320 landscape view. Doodle's title starts at 66 pixels and its description finishes at approximately 166 pixels in the 393 x 676 view. Its Open link is fully visible with a 44-pixel target. AutoLister and Cryptik introductions also fit above the fold without horizontal overflow. Studio verification passed 20 tests.
# Reachable mobile project footer, 13 October 2026

The top-right Open link was difficult to reach with one hand, and the introduction crossed photographic foliage and shadows. All mobile projects now place native copy on a solid, project-colored footer. The Open action has an approximately 96 x 48 CSS-pixel target near the bottom. Footer body text uses 16-pixel Inter with 22-pixel leading and at least 13.80:1 computed contrast against its opaque surface. Target sizing and contrast guidance: [Apple buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) and [W3C contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

The original photographs are retained. Unused upper wall is trimmed to start the physical showcase below navigation, while an independent photo scroller preserves access to the entire composition on shorter screens. The header and footer stay visible. Navigation and bottom safe-area spacing are measured when fitting the photo window. Browser viewport changes resize the photo window without moving the copy into the image. Opening a different project resets its photo scroll position, and the scroller is keyboard accessible.

Reviewed all three projects at 393 x 676 or 393 x 710, plus 320 x 480, 375 x 559, 430 x 844 and 599 x 320 mobile viewports. The Open action stays 48 pixels tall and fully inside each visible viewport. Verified scrolling, Back to work, reopening at scroll position zero, no horizontal overflow, no browser errors, and the original desktop layout at 1280 x 720. The studio suite passes 22 tests, including artwork scroll extent and safe-area navigation geometry. No image assets were changed.
Landscape follow-up: at 844 x 390, the wide photograph is retained and the native introduction uses a solid side footer at the lower right. Its Open target remains approximately 96 x 48 pixels and copy no longer crosses room shadows. The regular 1280 x 720 desktop treatment is unchanged.


# Gallery interaction polish, 14 October 2026

Added a vertical project cycle with wheel-burst accumulation, momentum suppression, a 650 ms minimum interval, vertical touch intent, pointer cancellation and keyboard up/down or Page Up/Down. Cycling replaces the current gallery history entry, preserving a single Back to work action. Assets decode before the scene changes. Native view transitions use a directional 520 ms handoff and hold the header steady; older browsers use a lightweight Web Animations fallback. Reduced motion bypasses scene motion. Pinch zoom remains available. Resizing or browser viewport changes skip an active scene snapshot and recompute the existing camera. No scene assets or camera geometry were changed.

The header has a feathered glass wash and fine divider, including reduced-transparency and no-backdrop-filter fallbacks. Terminal loading uses a small stepped spinner beside the project title; the loading announcement remains available to assistive technology without displaying extra copy.

Validation: all 32 studio tests passed, including four new gesture regression tests. Browser-tested real mouse wheel bursts, keyboard cycling, forward wrap, Escape and a single return to the terminal after cycling. A disposable localhost harness exercised the actual touch handlers with synthetic pointer sequences: vertical swipe, horizontal rejection, multi-touch rejection and cancellation passed in native-transition, fallback and reduced-motion modes. Native transition readiness was confirmed and browser errors were absent. These synthetic checks do not claim physical iPhone testing. Delayed image responses confirmed the inline loading indicator and visually hidden announcement.

All three scenes passed no-overflow and header/caption/action containment checks at 320 x 480, 844 x 390 and 820 x 1180. Visual review also covered 393 x 676 and 1280 x 720. Browser API references: [wheel delta units](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/deltaMode), [touch-action and pinch zoom](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action), [native view transitions and fallback](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition).


# Native scrolling and lighter glass, 14 October 2026

Replaced gesture-triggered view-transition snapshots with a native CSS scroll-snap track. Three real project panels sit next to one another vertically. The current and adjoining scene move together under direct browser scrolling, without opacity transitions, per-frame transforms or a scroll animation library. The fixed header lives outside the scroll container, so its live backdrop filter stays present during movement. Header blur is reduced from 16 to 6 CSS pixels, its tint is lighter and its feather is shorter. Footer blur is reduced to 8 pixels. Scene assets, camera geometry, text and external links are preserved.

The ring recenters only after a full snap has settled and no touch remains down. Partial scrolls do not change the URL or active project. Native scrollend is supplemented by an idle fallback for older browsers. Browser viewport changes preserve fractional scroll progress during movement; settled views remain centered after resizing. Offscreen panels are inert and the settled project is announced once. Native touch panning and pinch zoom remain available, while keyboard navigation respects reduced motion. Back to work still uses one history action. Only the visible orientation is downloaded, neighboring scenes use low-priority loading after the gallery opens, and data-saving or slow connections defer neighbors until they enter the viewport.

Validation: the complete studio suite passes 31 tests, including replacement tests for ring order, partial-scroll settlement and viewport changes. Real browser wheel navigation, forward and backward wrapping, keyboard scrolling, Back, Escape and reopening were exercised. During a real native smooth scroll, two scenes were simultaneously visible with exactly adjoining bounds; the header stayed at y=0 with blur(6px). The browser console had no errors. A disposable localhost harness used synthetic touch lifecycle events around actual browser scroll positions to verify held-touch protection, release settlement, partial-scroll protection, adjoining geometry, persistent glass and snapback. All six checks passed in standard and reduced-motion modes. These are not claims of physical iPhone testing. The data-saving run requested only Doodle's portrait photograph before scrolling.

All three scenes passed caption, header and Open-link containment, centered-track and no-outer-overflow checks at 320 x 480, 844 x 390, 820 x 1180, 1280 x 720 and 1280 x 900. Each gallery contains exactly three panels.

Browser behavior references: [CSS scroll snap](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll_snap), [scroll-snap-stop](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-snap-stop), [scrollend](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event).


# Material project separator, 14 October 2026

Selected visual target: the second displayed separator concept, exec-2e4c1cf1-c962-4169-9495-d58fa495cebc.png. The owner chose the version without additional text, then requested a more noticeable but elegant shadow.

Implemented a four-pixel warm stone edge with a fine highlight, darker contact line, tight contact shadow and two broader cast shadows. It is an absolute, non-interactive pseudo-element on each of the three existing project panels. It appears during the existing scrolling state and is hidden when a scene settles. No new text, image assets, layout spacing, animation, event handling or scroll behavior was added. Forced-colors mode uses native Canvas and CanvasText with no shadow.

Design QA: compared the selected concept and the rendered AutoLister-to-Cryptik seam in one normalized side-by-side image at 393 x 711. The first pass was too pale and shallow. Warmed the rim and deepened the contact and cast shadows in response to owner feedback, then captured and compared again. The final shadow is intentionally stronger than the original concept.

Fidelity surfaces: existing native fonts, type weights, wrapping and text are preserved. The separator has zero layout footprint, so caption and artwork spacing are unchanged. The warm highlight and shadow match the selected material direction. Original photographic artwork and image quality are preserved; differences in the generated concept's artwork and type are outside this separator-only scope. No extra chapter label, number, navigation or content block was added.

Browser checks: all three phone boundaries at 393 x 711 showed the four-pixel separator during motion and hid it at rest. Each remained pointer-events:none and the native track remained exactly three pages. Tablet check at 820 x 1180 retained the same material treatment without outer overflow. Laptop rest check at 1280 x 720 hid the edge. Real mouse-wheel snapping, Back to work, reopening and returning to a settled scene passed, with no console errors.

Final result: passed.


## 2026-10-14: First-open scroll responsiveness

- Root cause: gallery scrolling stayed disabled until the aperture and all caption entrance animations finished. The longest caption ran for 1120 ms, with no interactive escape when animation completion was delayed.
- Enabled native scrolling immediately after the prepared scene is shown. Wheel, touch and keyboard input cancel the decorative entrance using passive input listeners where appropriate.
- Deferred neighboring-scene preloading for 1400 ms and serialized their image decode instead of starting all scenes during the first paint. Visible neighbors still load on demand during native scrolling. No new runtime dependency or image download added.
- Five controller regression tests hold animation promises unfinished and cover immediate readiness, wheel/touch interruption, keyboard input, deferred downloads and cancellation on close. The original controller failed the three initial regressions; the fix passes all five.
- Verification: 36 tests, browser module syntax checks and the 53-file production build passed. Chrome browser checks at 393x711 and 844x390 covered input during the entrance, forward and reverse project navigation, resize, close and reopen. A real iPhone Safari session was unavailable, so physical-device touch performance is not claimed verified.
