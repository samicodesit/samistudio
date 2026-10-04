# Joined detail drawer design QA

Source visual truth: [Owner-selected option 2](docs/qa/detail-levels/design-target.png). Generated source 853 x 1844 pixels, normalized to a 390 x 844 viewport for comparison. Latest owner correction places the strip as close to the trailing edge as reasonable (right in LTR, left in RTL); implementation uses 4 px/dp.

Implementation: [Installed web, expanded](docs/qa/detail-levels/web/app-en-390-2.png), 390 x 844 CSS pixels, device scale factor 1, fixture account/image responses. Source and implementation are shown together in [the full comparison](docs/qa/detail-levels/design-comparison.png) and [the selector comparison](docs/qa/detail-levels/design-comparison-detail.png).

Scope: the selector and its integration with the existing prompt input. Existing web/native layout, reference image, suggestions and Create placement were preserved. This is real component rendering with fixture service responses, not provider or Play Integrity verification.

## Comparison history

1. Earlier implementation had three separate tiles, an external chevron and space above the input. Replaced with a single yellow strip, two thin dividers and the centered tab. Removed the visible heading and heavy selected border. Preserved radio semantics and a small corner check.
2. First joined render placed the control too far inward and added extra space above it. Set 4 px/dp trailing inset and tightened its integration with the hint/input.
3. A closing-frame capture showed the handle separating from the moving strip. Fixed with one shared progress value: the tab remains attached to the visible strip or input edge throughout the slide. [Post-fix transient evidence](docs/qa/detail-levels/web/app-en-390-transition.png).
4. Native inspection showed the compact visible handle clipping its touch target. Preserved the same visible geometry using a full 48 dp target in the input stack. Explicitly removed hidden native radio semantics/focus. Final hierarchy shows zero hidden radio controls.

## Required surfaces

- Typography: actual Bricolage Grotesque, IBM Plex Sans and Alexandria loaded on web; existing embedded brand fonts retained on native. No new visible level labels. Tooltip and screen-reader names remain localized.
- Spacing/layout: zero gap between drawer and input, joined choices, restrained 6 px upper corners, 4 px/dp edge inset. Checked 1280, 390 and 320 px plus native 200% text. Input provides the foreground mask; no extra drawer shadow.
- Colors: Doodle yellow #FFEB8A, graphite lines, moss selection check and existing sage/paper surfaces retained. No gradients added.
- Artwork: reused coordinated vector-source flowers and matching native PNGs. Same subject/composition, distinguishable detail at actual control size. Source mockup's approximate flowers intentionally replaced by the established source assets.
- Copy/content: existing scene and app copy preserved. Suggestion wording varies because the app samples ideas. Native has its existing reference image and footer arrangement, outside this scoped selector change.
- Interaction: click/tap and up/down handle swipes, radio arrows/Home/End on web, focus/tooltips, persistence, hidden choices, retry/redraw and loading covered. Reduced motion is effectively immediate. Native hardware focus and accessibility hierarchy inspected; actual spoken TalkBack remains unverified.

## Verification

Production web build, native fixture APK build, both TypeScript checks, lint and selector tests passed. Six production browser tests passed. English/Arabic native 200% captures reviewed. The broader release browser failures and real Play-installed Integrity verification remain separate gates recorded in [verification.json](docs/qa/detail-levels/verification.json).

No actionable P0/P1/P2 visual differences remain in this scoped selector comparison. Remaining P3: the generated mock uses approximate typography and a slightly flared tab join; implementation retains exact brand fonts and a conventional rounded control. Owner approval of rendered output, independent release review and deployment/publishing approval remain pending.

final result: passed

## RTL edge correction

The drawer, centered tab and selection check mirror to the left in RTL. The inset remains 4 px/dp and the slide, foreground mask and joined dividers are unchanged.

Prior landing review preserved in [the October 2 report](docs/qa/landing-october-2-design-qa.md).

## Compact hint row and stable input

The hint now shares the row beside the flowers, with a 12 px/dp gap above the input. At 320 px it wraps within its available width. Removed the separate full-width hint band. The drawer and tab translate 56 px/dp behind the stationary input instead of resizing the composer. Production browser regression compares input coordinates before and after collapse/reveal in LTR and RTL. Native hierarchy verifies identical input bounds after collapse; full 48 dp handle target retained.

Final compact-row verification: 584 web/backend tests passed (1 paid test skipped), 101 native tests passed, 6 production browser tests passed, web production build and native fixture APK build passed. Enlarged Arabic hint spacing corrected and inspected. Two unrelated existing lint warnings remain. UI captures use fixture services. No deployment or publishing.
