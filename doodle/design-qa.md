# Combined hero design QA

Date: 2026-10-04.

final result: passed

Owner direction: combine option 1's desktop composition with option 2's compact spacing. Retain the flower cat and three pastel paper examples as closely as practical. Phones use the compact title/helper beside the joined drawer. Latest owner correction: "What's your idea?", with equivalent wording in all ten languages.

## Source and rendered comparison

The [hybrid target](docs/qa/detail-levels/hero/hybrid-target.png) is an illustrative 1090 x 1443 Image Gen board. Its desktop region was cropped to 1001 x 642 and compared with the 1440 x 900 CSS pixel production browser capture, normalized to 1000 px wide. [Combined desktop comparison](docs/qa/detail-levels/hero/desktop-comparison.png). The [phone comparison](docs/qa/detail-levels/hero/phone-comparison.png) normalizes the source phone region to 390 px wide beside the matching implementation region. Both comparison inputs were visually inspected.

These references establish composition, not exact copy or pixel specifications. The implementation retains existing localized desktop copy, substantive SEO content and suggestion behavior. The source's invented guides, gradients and redundant native wordmark were not adopted. Artwork was extracted with Image Gen and exported proportionally with transparency; small drawing differences remain. [Artwork provenance](docs/qa/detail-levels/hero-assets.json).

The initial comparison captures used the production Webpack app with fixture account/generation responses. Current follow-up web captures use the development Webpack app; the manifest records the distinction. Native captures use the isolated presentation package on the Play API 36 emulator, at 320 dp and 100%/200% text. This is UI verification, not live provider, payment or Integrity validation. [Current screenshot manifest](docs/qa/detail-levels/hero/manifest.json).

## Findings and corrections

1. P2: the first desktop render clipped the cat's feet. Set explicit frame/image height and object-fit contain. Revised desktop and tablet captures show the entire drawing; regression checks cover 768, 1280 and 1440 px.
2. P2: inherited header margins split utility links across the header. Removed the extra automatic language margin. Examples, language and sign-in now form one group.
3. P2: at 320 dp and 200% Android text, the credit label broke into fragments beside Create. Stack credit text and Create at enlarged text sizes. Revised English and Arabic captures are readable.
4. P2: enlarged Arabic suggestion-heading descenders were clipped. Increased its line height for Alexandria and inspected the installed fixture again; the full heading is visible.
5. Drawer and tab stay joined to the input, with thin dividers and a 4 px/dp trailing inset. The original native input bounds were identical before and after collapse: [49,612][791,922]. The compact-heading follow-up also remains stationary at [49,608][791,918]. Browser checks cover the stationary input, all selections, RTL, focus and reduced motion.
6. Inspected phone, installed web, tablet and desktop captures, Arabic direction and native enlarged text. No unresolved P0/P1/P2 presentation findings. Very large text remains scrollable; narrow headings and navigation labels can wrap.

## Verification

- Full production browser suite: 83 passed. Covers all ten public and installed translations, drawer states, keyboard, storage failures, loading/error/retry/redraw, checkout returns, downloads, sharing fallback, grids and example navigation.
- After the final idea wording: rebuilt production web and Android fixture; reran 47 component tests and six production browser tests, including all public translations at 320, 390 and 1280 px. All passed.
- Web/backend suite: 614 passed; one paid provider test intentionally skipped. Android logic suite: 101 passed.
- Web and native TypeScript passed. Web production build passed with 84 static pages. Lint: zero errors, two existing image warnings in card-composer.tsx.
- Android fixture built and installed. Separately inspected 320 dp, normal/enlarged text and collapse geometry. Production signing is unchanged. Fixture uses the existing debug signing configuration.
- Shared native source inputs now participate in Gradle's bundle cache, preventing an incremental APK from retaining stale shared copy. Metro watches shared dependency symlink targets in worktrees.
- Browser font loading checks and Chromium platform font inspection verify brand fonts. Native uses existing bundled Bricolage Grotesque, IBM Plex Sans and Alexandria assets.
- Canonicals, hreflang, structured data and localized guide content remain. Metadata assertions passed.
- Animated hints retain typing/backspacing, focus suppression and reduced motion. Native's existing placeholder remains. The generous yellow loading card, animation and rotating in-card messages are unchanged.

Initial browser failures expected the old heading, fixed font size and visible phone hero image. Tests now exercise the approved layout and reachable examples. A revised test initially read the decorative plus into its expected scene; it now reads only the scene text. The final full suite passes without skipping those workflows.

## Delivery and release boundaries

[Phone-accessible image gallery](https://doodle-layout-review-9atjkigyb-codenamez.vercel.app/implemented.html). Only current manifest-listed captures are included. Anonymous requests returned HTTP 200 for the gallery and all thirteen current UI images with matching hashes. All images decoded, with no gallery overflow at 390 CSS px. The isolated Hobby preview is static, with no app functions. [Delivery verification](docs/qa/detail-levels/hero/preview-verification.json).

Owner final visual acceptance, independent release review, separate production deployment/publishing approval and real Play-installed generation/Integrity verification remain release gates. No live Doodle deployment or Android publication occurred.

Previous selector-specific QA is preserved in [the joined-drawer record](docs/qa/detail-levels/joined-drawer-design-qa.md).

## Owner follow-up, October 4

Removed the visible Drawing guides column from the supporting row. The existing guide pages, footer link and expandable supporting content remain. The desktop row now has two balanced columns, with pastel artwork capped at 540 px. On phones, removed the supporting section top border and its padding, keeping the suggestion-list divider and a 28 px section gap. Inspected desktop and phone renders directly.

Narrow native screens below 380 dp use a full-width heading. At normal text sizes, its margin uses 24 dp of the selector's empty upper area, keeping the heading connected without moving the input when the drawer collapses. Enlarged text keeps its own space. Replaced the Arabic heading with the owner-requested casual phrase, and used 34 dp line height for Alexandria descenders. Inspected the installed fixture at 320 dp with normal and 200% text, in English and Arabic.

Fresh checks for this follow-up: four localized page component tests and two browser layout tests passed. Browser checks cover all ten public languages at 320, 390 and 1280 px, plus tablet/desktop artwork and stationary drawer input. Web and native TypeScript passed, the changed page lint check passed, and the final Android fixture built and installed. Earlier full-suite counts above describe the preceding implementation, not a new full-suite run for this small revision.

The [four current store screenshot candidates](https://doodle-layout-review-9atjkigyb-codenamez.vercel.app/store.html) remove the counter text from slots 1 and 4 using built-in Image Gen edits restricted to a local blank-panel patch. Color-matched and feathered the patches; verified zero decoded pixel differences outside each region and no dark counter remnants. Slots 2 and 3 are byte-identical to their selected sources. Full-size exports and the 390 px browser gallery were visually inspected. [Current release asset manifest](marketing-assets/play-counter-cleanup-2026-10-04/manifest.json). Original files and raw edits are retained. These are marketing-only candidates; app usage/credit behavior is unchanged. Nothing was published to Doodle or Play Console.


## October 4 comparison gallery

Owner requested historical and current UI side by side. The [comparison preview](https://doodle-layout-review-qy40o9i2e-codenamez.vercel.app/implemented.html) includes ten cases: desktop, 390/320 px web, installed web, Arabic, native open/hidden, 200% text, Arabic enlarged text, and the simplified store screenshot 3. Web first-screen crops are declared. Older desktop and Android dimensions differ from current captures and are labeled. Historical captures are allowed only as comparison inputs, not current marketing candidates. All account and generation responses in UI captures are simulated.

Rendered the gallery at 320, 390 and 1440 CSS px, checked both brand fonts loaded, all 20 images decoded, aligned side-by-side pairs and no horizontal overflow. Inspected desktop and phone output, Arabic enlarged text and store comparison. Anonymous hosted file responses and all image hashes match reviewed local assets. Hosted browser rendering could not be separately inspected because browser controls were unavailable. [Comparison asset manifest](docs/qa/detail-levels/hero/comparison-manifest.json).

Screenshot 3 now removes the repeated introduction and uses three shorter labels beside enlarged original artwork. Its outer caption and background are pixel-identical to the original. This supersedes the earlier record that slot 3 was unchanged. Owner visual acceptance and release gates remain pending. No fresh full app test run was needed for this static gallery update.


## October 4 native hero spacing refinement

Matched the native hero to the connected web composition by allowing the heading to use the leading part of the drawer upper space. It stops before the full 48 dp pull-tab target. Removed the negative-margin title workaround. Normal text uses one grouped heading/helper/drawer row; enlarged text keeps the full-width heading. Footer stacking now depends on width and font scale independently. No web or backend behavior changed.

Fresh checks: 101 native tests passed, TypeScript passed, and Gradle assembleFixture passed with exit 0. Installed the isolated fixture APK. Inspected English at 320, 360 and about 390 dp, English/Arabic at 200%, Arabic at 320 dp, and longer Portuguese wording. Drawer hide/reveal preserves identical input bounds and responds through its full 48 dp target. Hidden options are disabled, non-clickable and non-focusable, but their old labels remain in the uncompressed hierarchy; spoken TalkBack remains unverified.

The [native spacing review](https://doodle-layout-review-k0z48mnf3-codenamez.vercel.app/spacing.html) includes matched prior/new 320 dp captures and a web reference. The [whole comparison page](https://doodle-layout-review-k0z48mnf3-codenamez.vercel.app/implemented.html) is refreshed too. Local gallery checks passed at 320, 390 and 1440 CSS px with brand fonts loaded, all images decoded, aligned pairs and no overflow. Hosted authored HTML and image hashes match reviewed files; Vercel appends its standard feedback script. Hosted browser rendering was not separately inspected because browser controls were unavailable. [Current native spacing asset manifest](docs/qa/detail-levels/hero-spacing/manifest.json). Owner visual acceptance and all existing release gates remain pending.

Restored emulator font scale and display configuration, closed the owned emulator and isolated ADB server, and removed disposable captures/logs and the fixture APK. Preserved current reviewed images, historical comparison inputs, sources and minimal QA records. No production deployment or Android publication.


## October 4 mobile art and parity QA

Implemented the owner-selected faint flower-cat accent with one transparent 21 KB asset shared byte-for-byte between mobile web and native Android. Kept existing hero, input and drawer positions. Visual QA found the first export too small and disconnected, especially on Android. Refined native art to 64 x 80 dp on narrow phones and 72 x 90 dp on wider phones, aligned the visible drawing to the heading edge, and adjusted its offset within the existing header space. Mobile web uses a smaller 48 x 60 px decoration because the public header also contains a wordmark and language control. Native art is hidden for text scaling above 130%, on other tabs, during generation and on results. Arabic mirrors placement.

Native now shows the original three pastel cards below suggestions, using shared localized supporting copy and the existing modal for a closer view. The Android language control remains in Settings, following the owner's preference for a clean header. Confirmed language selection and persistence through restart.

The 320 px Arabic web inspection exposed overlapping header language text and Sign in. Narrow public headers below 380 px now show the existing flag without a permanent language label, retain the full selected language in the accessible control name, preserve full menu labels and use a 44 px target. A regression assertion verifies that wordmark, language and account controls remain on screen and do not overlap across all ten locales.

Fresh verification: 101 native tests, four language-switcher component tests, six hero/detail browser tests, changed-source lint, native TypeScript and production web build passed. The build includes web TypeScript. The earlier whole web suite for this implementation had 614 passing tests and one gated real-generation skip; it was not repeated for the final decorative sizing and header-label adjustment. Installed the final fixture APK, inspected 320 and 390 dp, English/Arabic normal and 200% text, hidden drawer, examples and modal. Input bounds remain [49,570][791,881] before and after collapse at 320 dp. Native Settings at 200% can wrap its tab label, an existing enlarged-text behavior outside the decorative change. Actual Play-installed generation and Integrity remain unverified.

Signed-out fixture idea selection, Create, waiting and result completed without sign-in. This fixture simulates responses and returns an existing reference image. It does not prove real provider or Integrity behavior. Read-only production checks on October 4 returned native enabled=true, guestEnabled=true and four free doodles for a new anonymous account. Source creates a guest session silently at the first generation and requests sign-in only after the free allowance is exhausted when purchasing. No first-time authentication change is needed.

Current captures, asset provenance and gallery checks are in docs/qa/detail-levels/mobile-parity/manifest.json. The gallery contains current reviewed captures, with the selected concept explicitly illustrative. Owner rendered acceptance and all existing production/publishing gates remain pending. No production app deployment, Play publication or paid generation was performed.

[Mobile parity review](https://doodle-layout-review-of2om17hy-codenamez.vercel.app/mobile.html) anonymously returned 200. Authored gallery HTML, all 18 current image assets and both font bytes match reviewed local files. Local gallery rendered at 320, 390 and 1440 px without overflow. Hosted rendering was not separately inspected. Verification is recorded in docs/qa/detail-levels/mobile-parity/preview-verification.json.
