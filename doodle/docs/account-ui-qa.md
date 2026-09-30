# Account UI QA record

Date: 2026-09-08
Release status: **DEPLOYED**
Production URL: https://doodle.samistudio.nl
Deployment URL: https://doodle-4zd17ra3z-ahmed-samis-projects-e6ef0336.vercel.app
Inspect URL: https://vercel.com/ahmed-samis-projects-e6ef0336/doodle/Fr3SUf54Nj5ziKtHujVtpWRKJAoQ

## Scope

- Web keeps the language selector and places the account action beside it.
- Installed app places one account action in the top-right host across Create, Ideas, and Settings.
- Existing refill/top-up access remains available from the signed-in account menu.
- Account hosts reserve a 44px row while account state settles, and the app host is overlaid in compact landscape so the loading card remains reachable above the fixed navigation.
- Google sign-in uses the reviewed fixed 44px control, settled sheet, and scroll/focus behavior. No auth, purchase, or generation was completed during QA.

## Evidence

Isolated local headless Chromium captures (synthetic account responses; no shared browser or emulator):

- Web 320px: `/tmp/doodle-visual-audit/account-web-320.png`
- App Settings 390px: `/tmp/doodle-visual-audit/account-app-390-settings.png`
- App signed-in popover 320px: `/tmp/doodle-visual-audit/account-app-320-auth-popover.png`
- Real Google GIS cold/warm render: `/tmp/doodle-visual-audit/gis-cold-320.png`, `/tmp/doodle-visual-audit/gis-warm-390.png`
- Loading card at 640×360, 720×400, and 800×500: `/tmp/doodle-visual-audit/loading-640x360.png`, `/tmp/doodle-visual-audit/loading-720x400.png`, `/tmp/doodle-visual-audit/loading-800x500.png`

The GIS captures used the actual Google iframe and rendered sign-in button; the loading captures used a delayed synthetic image response to hold the real loading state. At 640×360 the loading stage measured y=28–276 and the fixed nav began at y=287; at 720×400 it measured y=28–316 and the nav began at y=327. No horizontal overflow was observed.

## Verification

- Focused Vitest: 32/32 passed.
- TypeScript: passed.
- Production build: passed.
- `git diff --check`: passed.
- Production web header: passed at 320px and 1440px; language selector and account menu stayed inside the viewport.
- Production runtime account: passed at 320px and 390px; account host stayed outside the Create form on Create, Ideas, and Settings with 17-credit synthetic account data.
- Production real GIS: passed in English and Dutch at 320px, 390px, and 1440px; Google iframe sizing preserved its inline width and margins, with complete labels and visible edges.
- Production GIS proof captures: `/tmp/prod-en-320.png`, `/tmp/prod-en-390.png`, `/tmp/prod-en-1440.png`, `/tmp/prod-nl-320.png`, `/tmp/prod-nl-390.png`, `/tmp/prod-nl-1440.png`.
- Production GIS opening: passed cold and warm; panel y/height and scroll remained stable, sheet opacity stayed 1, and no sign-in transform was applied.
- Production GIS opening captures: `/tmp/final-gis-cold-0.png`, `/tmp/final-gis-cold-300.png`, `/tmp/final-gis-cold-1000.png`, `/tmp/final-gis-warm-0.png`, `/tmp/final-gis-warm-300.png`, `/tmp/final-gis-warm-1000.png`, `/tmp/prod-resize.png`.
- Remaining live visual issue: Google GIS first paints a fallback DOM button (`Doorgaan met Google`) and later swaps it for the iframe (`Continue with Google`) during cold and warm opens; this label replacement is the observed blink. Panel geometry and opacity remain stable.
- Production 640x360 loading: passed with the existing doodle fixture and intercepted response (`intercepted=true`); loading stage measured x=196-444 and y=28-276 within the viewport, with no horizontal overflow.
- Production 640x360 loading capture: `/tmp/final-loading-640x360-proof.png`.
- Auth, purchase, and generation against production: not performed.
- Deployment: completed at the URLs above.

## Canary deployment and real GIS recheck — 8 September 2026

- Deployment: `BVKPHBch1jWv9tYd5MnK16HiVkat`
- Production URL: https://doodle-22a7xj9bb-ahmed-samis-projects-e6ef0336.vercel.app
- Alias used for Google GIS authorization: https://doodle.samistudio.nl
- Inspect: https://vercel.com/ahmed-samis-projects-e6ef0336/doodle/BVKPHBch1jWv9tYd5MnK16HiVkat
- Vercel build completed successfully with Next.js 16.3.1, TypeScript, and 33 generated pages.

Isolated headless Chromium opened the real Google GIS script on the authorized production alias with an intercepted anonymous account response. No Google button, authentication, purchase, or generation action was clicked. Cold and warm openings were sampled at 0, 100, 250, 500, 800, 1200, and 1600 ms and captured at 320, 390, and 1440 CSS pixels:

- Screenshots: `/tmp/gis-320-cold-0.png`, `/tmp/gis-320-cold-500.png`, `/tmp/gis-320-warm-250.png`
- Screenshots: `/tmp/gis-390-cold-0.png`, `/tmp/gis-390-cold-500.png`, `/tmp/gis-390-warm-250.png`
- Screenshots: `/tmp/gis-1440-cold-0.png`, `/tmp/gis-1440-cold-250.png`, `/tmp/gis-1440-warm-250.png`
- At 320, final Google iframe: x=11, width=298, right=309; control: x=21, width=278, right=299.
- At 390, final Google iframe: x=11, width=368, right=379; control: x=21, width=348, right=369.
- At 1440, final Google iframe: x=529, width=382, right=911; control: x=539, width=362, right=901.
- Final iframe height was 44px in all viewports and its rendered English label was complete in the screenshots. The sign-in sheet and slip kept stable top/height across each opening; document scroll stayed at 0.
- The `Not now` target measured 75x44px at all tested viewports in both cold and warm openings.
- Cold load briefly created a GIS fallback role button in the DOM, but the loading cover kept it visually hidden; no captured frame exposed its temporary Dutch label. Warm load reached the final iframe sooner. The fallback and iframe are contained within the fixed 44px row and the final screenshot shows all four iframe edges.

The `.vercel.app` hostname was not used for GIS acceptance because the OAuth client is authorized for `doodle.samistudio.nl`; the alias was used for all real-widget measurements above.

## UX delta canary — 8 September 2026

- Deployment: `HBvb8oUnAi5PZXEMfscxMTg3n9re`
- Production URL: https://doodle-izrm1dd0n-ahmed-samis-projects-e6ef0336.vercel.app
- Alias used for Google GIS authorization: https://doodle.samistudio.nl
- Inspect: https://vercel.com/ahmed-samis-projects-e6ef0336/doodle/HBvb8oUnAi5PZXEMfscxMTg3n9re
- Vercel build completed successfully with Next.js 16.3.1, TypeScript, and 33 generated pages.

The authorized production alias was checked in isolated headless Chromium at 390×844 and 1440×900. Each viewport opened the sign-in dialog cold and warm, sampling 0, 50, 120, 250, 500, 800, and 1200ms. No Google button, authentication, purchase, or generation action was clicked.

- At every opening sample, initial focus was the `Sign in` heading (`#purchase-title`); `Not now` never received focus or a focus ring. Document scroll stayed at 0.
- While GIS loaded, the fixed 44px control visibly showed the localized `Loading sign-in…` label. The temporary GIS fallback role button was present only behind the loading cover; no captured frame exposed its temporary Dutch label.
- Once ready, the real iframe visibly rendered the complete English `Continue with Google` label. At 390px its final bounds were x=11..379, width=368, height=44, within the 390px viewport; at 1440px x=529..911, width=382, height=44. The enclosing controls were x=21..369 (348px) and x=539..901 (362px), respectively.
- The sign-in dialog and slip kept stable top/height through cold and warm opening; `Not now` measured 75×44px in both viewports.
- Captures: `/tmp/tmp/ux-390-cold-0.png`, `/tmp/tmp/ux-390-cold-250.png`, `/tmp/tmp/ux-390-warm-0.png`, `/tmp/tmp/ux-390-warm-250.png`, `/tmp/tmp/ux-1440-cold-0.png`, `/tmp/tmp/ux-1440-cold-120.png`, `/tmp/tmp/ux-1440-warm-0.png`, `/tmp/tmp/ux-1440-warm-120.png`.
