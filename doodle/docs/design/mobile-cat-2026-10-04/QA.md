# Mobile-web cat refinement

The owner accepted the wider example update and requested a better size and placement for the mobile-web hero cat. The same transparent artwork is now 60 by 75 CSS pixels, up from 48 by 60, above the outer flower tile. Logical positioning and image-only mirroring make it face inward in both directions. Opacity is 0.28. The initial title-row prototype was rejected during QA because it created extra empty space when the drawer closed. The final implementation keeps the existing heading, hint, drawer and input layout. The visible web heading also uses the required Bricolage Grotesque font, with Alexandria for Arabic.

This CSS is restricted to the public mobile-web composition below 700 px. Installed web and native Android keep their existing cat layouts. The decoration remains hidden from assistive technology and ignores pointer input. Placeholder typing and generation behavior are untouched.

## Verification

- Fresh local production Webpack build passed, including TypeScript and all 84 routes.
- Eight targeted SceneComposer and DetailLevelSelector tests passed.
- Source lint passed with zero errors and two existing image warnings in card-composer.tsx. The whole-directory lint command encountered inherited scratch builds and diagnostics outside the source tree; those unrelated files were preserved.
- Browser inspection covered all ten supported locales at 320 and 390 px. No horizontal overflow; heading fonts resolved to Bricolage Grotesque or Alexandria. See layout-checks.json.
- Actual English and Arabic captures were inspected at phone size. Open and hidden drawers at 320 and 390 px had identical input bounds. See drawer-stability.json. Larger phone and desktop layouts were also inspected, with the small cat hidden on desktop.
- This is a visual check of actual local production-build UI. Local account configuration was unavailable. No live generation, sign-in, payment, Integrity or installed Android end-to-end test was performed for this CSS-only refinement.

The before and after screenshots, their provenance and review status are recorded in manifest.json. The previous wider example update was accepted; this new cat placement awaits owner visual review. No production app deployment or Play publishing occurred.

[Phone comparison gallery](https://doodle-layout-review-10spczqpp-codenamez.vercel.app/mobile-cat.html) is hosted on the existing separate Hobby preview project. Anonymous HTML returned 200. All eight image downloads matched their recorded hashes, and the rendered phone gallery loaded its images and brand fonts with no horizontal overflow. It contains static images and no Doodle server functions.
