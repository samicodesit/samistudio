# Compact detail picker delivery

Implemented for web and shared iOS/Android UI on 21 October 2026.

## Behavior

The selected real dog example, Detail label and chosen level remain visible in a compact control. Opening it compares Simple, Medium and Detailed, with brief translated descriptions. Native reuses NativeModalFrame, including its existing backdrop, safe areas, reduced-motion handling, entrance and exit transitions. Web uses a modal dialog with matching 180ms entrance and 160ms exit, keyboard radio navigation, Escape/backdrop dismissal and focus restoration.

Medium is the default when no valid preference exists. The storage key is unchanged, so saved Simple, Medium or Detailed choices remain intact. Gallery-specific detail and generation retries/redraws keep their explicit inputs. Updated native requests send Medium explicitly; omitted legacy requests retain their existing Simple interpretation for compatible attestation.

The composer input, photo controls and footer retain their existing dimensions and responsive rules. Native control width was increased slightly after actual Android inspection caught Medium wrapping. At large font scales the picker becomes vertical rows inside the shared scrollable drawer. Its title supports scaling up to 200%, while the body/options retain the platform text setting.

## Evidence

- Actual running web layouts: 320x568, 390x844, 768x1024, 1440x900, Arabic at 320 and all ten supported languages at 320. All three images loaded, all cards fit, no page overflow. See layout-checks.json. At 390 the composer remains x20,y164,350x166.
- Production build: new preference starts at Medium; choosing Simple survives reload; choosing Medium again updates the thumbnail; dialog motion and focus behavior work. Console error log was empty. No generation was submitted.
- Real iOS fixture builds: iPhone 17 and iPhone SE 3. XCTest covers open/select/relaunch, all three options, and identical composer input frames before/after. Largest accessibility text on SE 3 passes with scrolling. Final logs: ios-ui-verified.log, ios-small-ui.log and ios-accessibility-pass.log.
- Real Android fixture: regular emulator, 360x640 dp, and 150% text. All options are accessible. Saved Simple survives force-stop/relaunch, then Medium is restored. The original emulator size and font setting are restored. See android screenshots and android-layout-checks.json. A transient accessibility dump during startup was corrected to require fresh snapshots before interaction.
- Artwork comes from the existing approved gallery. Identical 320px thumbnails are bundled in native; hashes and provenance are in asset-manifest.json. No provider generation ran.

## Verification

Web and native production/fixture builds, TypeScript, full unit suites and lint were run. Lint has three pre-existing warnings and no errors. The paid provider test remains skipped. Final counts and deployment identity are added in verification.json after the release checks finish.

Browser E2E source was updated for the new dialog contract. This task used direct browser verification through the app browser rather than claiming the entire Playwright suite ran. Native screens use fixture builds and do not establish Play/App Store release, production attestation, paid generation quality or spoken VoiceOver/TalkBack acceptance.

## Source scope

The source push checkpoints the current app source, including the earlier local color and iOS dependencies, so the remote source matches the tested application. Existing unrelated marketing and documentation work remains in the checkout. No native store upload is part of this delivery.
